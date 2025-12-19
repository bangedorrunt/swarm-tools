/**
 * LibSQLAdapter - libSQL implementation of DatabaseAdapter
 *
 * Wraps @libsql/client to implement the DatabaseAdapter interface.
 * Supports file-based, in-memory, and remote (Turso) databases.
 *
 * Key differences from PGLite:
 * - Uses ? placeholders instead of $1, $2, etc.
 * - Native vector support with F32_BLOB(N) columns
 * - No extensions needed for vector operations
 * - vector_distance_cos() returns distance (lower = more similar)
 *
 * Based on spike at packages/swarm-mail/scripts/sqlite-vec-spike.ts
 *
 * @example
 * ```typescript
 * // In-memory (for tests)
 * const db = await createLibSQLAdapter({ url: ":memory:" });
 *
 * // File-based
 * const db = await createLibSQLAdapter({ url: "file:./swarm.db" });
 *
 * // Remote (Turso)
 * const db = await createLibSQLAdapter({
 *   url: "libsql://[database].turso.io",
 *   authToken: process.env.TURSO_TOKEN
 * });
 * ```
 */

import type { Client, Config, InArgs, InStatement } from "@libsql/client";
import { createClient } from "@libsql/client";
import type { DatabaseAdapter, QueryResult } from "./types/database.js";

/**
 * LibSQL configuration options
 *
 * Extends @libsql/client Config with type safety.
 */
export interface LibSQLConfig {
	/** Database URL - ":memory:", "file:./path.db", or "libsql://..." */
	url: string;
	/** Auth token for remote Turso databases */
	authToken?: string;
	/** Connection timeout in milliseconds */
	timeout?: number;
}

/**
 * LibSQLAdapter implementation
 *
 * Wraps libSQL client to match DatabaseAdapter interface.
 */
class LibSQLAdapter implements DatabaseAdapter {
	constructor(private client: Client) {}

	async query<T = unknown>(
		sql: string,
		params?: unknown[],
	): Promise<QueryResult<T>> {
		const result = await this.client.execute({
			sql,
			args: params as InArgs | undefined,
		});

		// libSQL returns { rows: Row[] } where Row is Record<string, any>
		// Cast to T[] to match interface
		return {
			rows: result.rows as T[],
		};
	}

	async exec(sql: string): Promise<void> {
		await this.client.execute(sql);
	}

	async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
		// libSQL batch API with "write" mode provides transactional semantics
		// Strategy: collect operations, execute as batch, handle rollback

		let result: T;
		let capturedError: Error | undefined;

		// Create a transaction adapter that collects statements
		const txStatements: InStatement[] = [];

		const txAdapter: DatabaseAdapter = {
			query: async <U = unknown>(
				sql: string,
				params?: unknown[],
			): Promise<QueryResult<U>> => {
				// For queries in transactions, we need to execute immediately
				// because we might need the results for subsequent operations
				const res = await this.client.execute({
					sql,
					args: params as InArgs | undefined,
				});
				return { rows: res.rows as U[] };
			},
			exec: async (sql: string): Promise<void> => {
				txStatements.push({ sql });
			},
		};

		try {
			// Execute the transaction function
			result = await fn(txAdapter);

			// If there are pending statements, execute them as a batch
			if (txStatements.length > 0) {
				await this.client.batch(txStatements, "write");
			}
		} catch (error) {
			capturedError = error instanceof Error ? error : new Error(String(error));
			throw capturedError;
		}

		return result;
	}

	async close(): Promise<void> {
		this.client.close();
	}
}

/**
 * Create a LibSQLAdapter instance
 *
 * Factory function that creates and initializes a libSQL database connection.
 *
 * @param config - LibSQL configuration (url, authToken, etc.)
 * @returns DatabaseAdapter instance
 *
 * @example
 * ```typescript
 * const db = await createLibSQLAdapter({ url: ":memory:" });
 * await db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY)");
 * await db.close();
 * ```
 */
export async function createLibSQLAdapter(
	config: LibSQLConfig,
): Promise<DatabaseAdapter> {
	const clientConfig: Config = {
		url: config.url,
		...(config.authToken && { authToken: config.authToken }),
	};

	const client = createClient(clientConfig);

	// Verify connection with a simple query
	await client.execute("SELECT 1");

	return new LibSQLAdapter(client);
}
