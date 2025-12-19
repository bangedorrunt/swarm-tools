/**
 * Memory Store - Database-agnostic memory operations
 *
 * Provides CRUD operations and semantic search for memories using
 * an existing shared DatabaseAdapter (PGlite or libSQL).
 *
 * ## Design Pattern
 * - Accept DatabaseAdapter via factory parameter (dependency injection)
 * - Auto-detect adapter type (PGlite vs libSQL) from schema
 * - Schema migrations handled separately (by migrations task)
 *
 * ## Key Operations
 * - store: Insert or update memory with embedding
 * - search: Vector similarity search with threshold/limit/collection filters
 * - ftsSearch: Full-text search (PostgreSQL FTS or SQLite FTS5)
 * - list: List all memories, optionally filtered by collection
 * - get: Retrieve single memory by ID
 * - delete: Remove memory and its embedding
 * - getStats: Memory and embedding counts
 *
 * ## Adapter Differences
 * | Feature          | PGlite                  | libSQL                          |
 * |------------------|-------------------------|---------------------------------|
 * | Params           | $1, $2, $3              | ?, ?, ?                         |
 * | Vector type      | vector(1024)            | F32_BLOB(1024)                  |
 * | Vector param     | $1::vector              | vector(?)                       |
 * | Distance         | embedding <=> $1        | vector_distance_cos(e, vector(?)) |
 * | Score            | 1 - distance            | 1 - distance                    |
 * | JSONB            | JSONB                   | TEXT (JSON.parse needed)        |
 * | Timestamp        | TIMESTAMPTZ             | TEXT (ISO 8601)                 |
 * | FTS              | GIN + to_tsvector       | FTS5 virtual table              |
 */

import type { DatabaseAdapter } from "../types/database.js";

// ============================================================================
// Types
// ============================================================================

/** Embedding dimension for mxbai-embed-large */
export const EMBEDDING_DIM = 1024;

/** Memory data structure */
export interface Memory {
  readonly id: string;
  readonly content: string;
  readonly metadata: Record<string, unknown>;
  readonly collection: string;
  readonly createdAt: Date;
  /** Confidence level (0.0-1.0) affecting decay rate. Higher = slower decay. Default 0.7 */
  readonly confidence?: number;
}

/** Search result with similarity score */
export interface SearchResult {
  readonly memory: Memory;
  readonly score: number;
  readonly matchType: "vector" | "fts";
}

/** Search options for queries */
export interface SearchOptions {
  readonly limit?: number;
  readonly threshold?: number;
  readonly collection?: string;
}

// ============================================================================
// Implementation
// ============================================================================

/** Adapter type detection */
type AdapterType = "pglite" | "libsql";

/**
 * Detect adapter type by checking schema
 * PGlite: has memory_embeddings table with vector(1024) column
 * libSQL: has memories table with embedding F32_BLOB column
 */
async function detectAdapterType(db: DatabaseAdapter): Promise<AdapterType> {
  try {
    // Try SQLite-style pragma (libSQL)
    const result = await db.query(
      "SELECT name FROM pragma_table_info('memories') WHERE name='embedding'"
    );
    if (result.rows.length > 0) {
      return "libsql";
    }
  } catch {
    // Not libSQL, assume PGlite
    return "pglite";
  }
  return "pglite";
}

/**
 * Create a memory store using a shared DatabaseAdapter
 *
 * Automatically detects adapter type (PGlite vs libSQL) and uses
 * appropriate SQL dialect for vector operations.
 *
 * @param db - DatabaseAdapter instance (PGlite or libSQL)
 * @returns Memory store operations
 *
 * @example
 * ```typescript
 * // PGlite
 * import { wrapPGlite } from '../pglite.js';
 * const pglite = await PGlite.create({ extensions: { vector } });
 * const db = wrapPGlite(pglite);
 * const store = createMemoryStore(db);
 *
 * // libSQL
 * import { createLibSQLAdapter } from '../libsql.js';
 * const db = await createLibSQLAdapter({ url: ":memory:" });
 * const store = createMemoryStore(db);
 * ```
 */
export function createMemoryStore(db: DatabaseAdapter) {
  // Detect adapter type on first operation (lazy)
  let adapterType: AdapterType | null = null;

  const getAdapterType = async (): Promise<AdapterType> => {
    if (!adapterType) {
      adapterType = await detectAdapterType(db);
    }
    return adapterType;
  };

  /**
   * Helper to parse memory row from database
   * Handles differences in JSON/timestamp storage
   */
  const parseMemoryRow = (row: any): Memory => {
    // libSQL stores metadata as TEXT (JSON string), PGlite as JSONB (object)
    const metadata = typeof row.metadata === "string" 
      ? JSON.parse(row.metadata) 
      : (row.metadata ?? {});
    
    return {
      id: row.id,
      content: row.content,
      metadata,
      collection: row.collection ?? "default",
      createdAt: new Date(row.created_at),
      confidence: row.confidence ?? 0.7,
    };
  };

  return {
    /**
     * Store a memory with its embedding
     *
     * Uses UPSERT (INSERT ... ON CONFLICT DO UPDATE) to handle both
     * new memories and updates to existing ones atomically.
     *
     * @param memory - Memory to store
     * @param embedding - 1024-dimensional vector
     * @throws Error if database operation fails
     */
    async store(memory: Memory, embedding: number[]): Promise<void> {
      const type = await getAdapterType();
      
      if (type === "libsql") {
        // libSQL: single table with embedding column
        const vectorStr = JSON.stringify(embedding);
        await db.query(
          `INSERT INTO memories (id, content, metadata, collection, created_at, confidence, embedding)
           VALUES (?, ?, ?, ?, ?, ?, vector(?))
           ON CONFLICT (id) DO UPDATE SET
             content = EXCLUDED.content,
             metadata = EXCLUDED.metadata,
             collection = EXCLUDED.collection,
             confidence = EXCLUDED.confidence,
             embedding = EXCLUDED.embedding`,
          [
            memory.id,
            memory.content,
            JSON.stringify(memory.metadata),
            memory.collection,
            memory.createdAt.toISOString(),
            memory.confidence ?? 0.7,
            vectorStr,
          ]
        );
      } else {
        // PGlite: separate memory_embeddings table
        await db.exec("BEGIN");
        try {
          await db.query(
            `INSERT INTO memories (id, content, metadata, collection, created_at, confidence)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               content = EXCLUDED.content,
               metadata = EXCLUDED.metadata,
               collection = EXCLUDED.collection,
               confidence = EXCLUDED.confidence`,
            [
              memory.id,
              memory.content,
              JSON.stringify(memory.metadata),
              memory.collection,
              memory.createdAt.toISOString(),
              memory.confidence ?? 0.7,
            ]
          );

          const vectorStr = `[${embedding.join(",")}]`;
          await db.query(
            `INSERT INTO memory_embeddings (memory_id, embedding)
             VALUES ($1, $2::vector)
             ON CONFLICT (memory_id) DO UPDATE SET
               embedding = EXCLUDED.embedding`,
            [memory.id, vectorStr]
          );

          await db.exec("COMMIT");
        } catch (error) {
          await db.exec("ROLLBACK");
          throw error;
        }
      }
    },

    /**
     * Vector similarity search
     *
     * Finds memories with embeddings similar to the query embedding.
     * PGlite: Uses <=> operator with HNSW index
     * libSQL: Uses vector_distance_cos() function
     *
     * @param queryEmbedding - 1024-dimensional query vector
     * @param options - Search options (limit, threshold, collection)
     * @returns Array of search results sorted by similarity (highest first)
     */
    async search(
      queryEmbedding: number[],
      options: SearchOptions = {}
    ): Promise<SearchResult[]> {
      const { limit = 10, threshold = 0.3, collection } = options;
      const type = await getAdapterType();

      if (type === "libsql") {
        // libSQL: single table, vector_distance_cos()
        const vectorStr = JSON.stringify(queryEmbedding);
        
        let sql = `
          SELECT 
            id,
            content,
            metadata,
            collection,
            created_at,
            confidence,
            1 - vector_distance_cos(embedding, vector(?)) as score
          FROM memories
          WHERE embedding IS NOT NULL
        `;
        
        const params: any[] = [vectorStr];
        
        if (collection) {
          sql += ` AND collection = ?`;
          params.push(collection);
        }
        
        sql += ` AND 1 - vector_distance_cos(embedding, vector(?)) >= ?`;
        params.push(vectorStr, threshold);
        
        sql += ` ORDER BY vector_distance_cos(embedding, vector(?)) ASC LIMIT ?`;
        params.push(vectorStr, limit);
        
        const result = await db.query<any>(sql, params);
        
        return result.rows.map((row: any) => ({
          memory: parseMemoryRow(row),
          score: row.score,
          matchType: "vector" as const,
        }));
      } else {
        // PGlite: separate embeddings table, <=> operator
        const vectorStr = `[${queryEmbedding.join(",")}]`;

        let query = `
          SELECT 
            m.id,
            m.content,
            m.metadata,
            m.collection,
            m.created_at,
            m.confidence,
            1 - (e.embedding <=> $1::vector) as score
          FROM memory_embeddings e
          JOIN memories m ON m.id = e.memory_id
        `;

        const params: any[] = [vectorStr];
        let paramIdx = 2;

        if (collection) {
          query += ` WHERE m.collection = $${paramIdx}`;
          params.push(collection);
          paramIdx++;
        }

        if (collection) {
          query += ` AND 1 - (e.embedding <=> $1::vector) >= $${paramIdx}`;
        } else {
          query += ` WHERE 1 - (e.embedding <=> $1::vector) >= $${paramIdx}`;
        }
        params.push(threshold);
        paramIdx++;

        query += ` ORDER BY e.embedding <=> $1::vector LIMIT $${paramIdx}`;
        params.push(limit);

        const result = await db.query<any>(query, params);

        return result.rows.map((row: any) => ({
          memory: parseMemoryRow(row),
          score: row.score,
          matchType: "vector" as const,
        }));
      }
    },

    /**
     * Full-text search
     *
     * PGlite: Uses PostgreSQL GIN + to_tsvector('english', content)
     * libSQL: Uses FTS5 virtual table (memories_fts)
     *
     * @param searchQuery - Text query string
     * @param options - Search options (limit, collection)
     * @returns Array of search results ranked by relevance
     */
    async ftsSearch(
      searchQuery: string,
      options: SearchOptions = {}
    ): Promise<SearchResult[]> {
      const { limit = 10, collection } = options;
      const type = await getAdapterType();

      if (type === "libsql") {
        // libSQL: FTS5 virtual table
        let sql = `
          SELECT 
            m.id,
            m.content,
            m.metadata,
            m.collection,
            m.created_at,
            m.confidence,
            fts.rank as score
          FROM memories_fts fts
          JOIN memories m ON m.id = fts.id
          WHERE fts.content MATCH ?
        `;

        const params: any[] = [searchQuery];

        if (collection) {
          sql += ` AND m.collection = ?`;
          params.push(collection);
        }

        sql += ` ORDER BY fts.rank LIMIT ?`;
        params.push(limit);

        const result = await db.query<any>(sql, params);

        return result.rows.map((row: any) => ({
          memory: parseMemoryRow(row),
          score: Math.abs(row.score), // FTS5 rank is negative, normalize to positive
          matchType: "fts" as const,
        }));
      } else {
        // PGlite: PostgreSQL FTS
        let sql = `
          SELECT 
            m.id,
            m.content,
            m.metadata,
            m.collection,
            m.created_at,
            m.confidence,
            ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', $1)) as score
          FROM memories m
          WHERE to_tsvector('english', m.content) @@ plainto_tsquery('english', $1)
        `;

        const params: any[] = [searchQuery];
        let paramIdx = 2;

        if (collection) {
          sql += ` AND m.collection = $${paramIdx}`;
          params.push(collection);
          paramIdx++;
        }

        sql += ` ORDER BY score DESC LIMIT $${paramIdx}`;
        params.push(limit);

        const result = await db.query<any>(sql, params);

        return result.rows.map((row: any) => ({
          memory: parseMemoryRow(row),
          score: row.score,
          matchType: "fts" as const,
        }));
      }
    },

    /**
     * List memories
     *
     * @param collection - Optional collection filter
     * @returns Array of memories sorted by created_at DESC
     */
    async list(collection?: string): Promise<Memory[]> {
      const type = await getAdapterType();
      const placeholder = type === "libsql" ? "?" : "$1";
      
      let query = "SELECT * FROM memories";
      const params: string[] = [];

      if (collection) {
        query += ` WHERE collection = ${placeholder}`;
        params.push(collection);
      }

      query += " ORDER BY created_at DESC";

      const result = await db.query<any>(query, params);
      return result.rows.map(parseMemoryRow);
    },

    /**
     * Get a single memory by ID
     *
     * @param id - Memory ID
     * @returns Memory or null if not found
     */
    async get(id: string): Promise<Memory | null> {
      const type = await getAdapterType();
      const placeholder = type === "libsql" ? "?" : "$1";
      
      const result = await db.query<any>(
        `SELECT * FROM memories WHERE id = ${placeholder}`,
        [id]
      );
      return result.rows.length > 0 ? parseMemoryRow(result.rows[0]) : null;
    },

    /**
     * Delete a memory
     *
     * PGlite: Cascade delete handles memory_embeddings automatically
     * libSQL: Embedding in same table, single DELETE works
     *
     * @param id - Memory ID
     */
    async delete(id: string): Promise<void> {
      const type = await getAdapterType();
      const placeholder = type === "libsql" ? "?" : "$1";
      
      await db.query(`DELETE FROM memories WHERE id = ${placeholder}`, [id]);
    },

    /**
     * Get database statistics
     *
     * PGlite: Count from memories and memory_embeddings tables
     * libSQL: Count from memories (embeddings in same table)
     *
     * @returns Memory and embedding counts
     */
    async getStats(): Promise<{ memories: number; embeddings: number }> {
      const type = await getAdapterType();
      
      const memories = await db.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM memories"
      );
      
      let embeddingsCount: number;
      if (type === "libsql") {
        // libSQL: embeddings stored in same table
        const embeddings = await db.query<{ count: number }>(
          "SELECT COUNT(*) as count FROM memories WHERE embedding IS NOT NULL"
        );
        embeddingsCount = Number(embeddings.rows[0].count);
      } else {
        // PGlite: separate embeddings table
        const embeddings = await db.query<{ count: number }>(
          "SELECT COUNT(*) as count FROM memory_embeddings"
        );
        embeddingsCount = Number(embeddings.rows[0].count);
      }

      return {
        memories: Number(memories.rows[0].count),
        embeddings: embeddingsCount,
      };
    },
  };
}
