/**
 * Swarm Mail - Actor-model primitives for multi-agent coordination
 *
 * ## Simple API (libSQL convenience layer)
 * ```typescript
 * import { getSwarmMailLibSQL } from '@opencode/swarm-mail';
 * const swarmMail = await getSwarmMailLibSQL('/path/to/project');
 * ```
 *
 * ## Advanced API (database-agnostic adapter)
 * ```typescript
 * import { createSwarmMailAdapter } from '@opencode/swarm-mail';
 * const db = createCustomDbAdapter({ path: './custom.db' });
 * const swarmMail = createSwarmMailAdapter(db, '/path/to/project');
 * ```
 */

export const SWARM_MAIL_VERSION = "0.1.0";

// ============================================================================
// Core (database-agnostic)
// ============================================================================

export { createSwarmMailAdapter } from "./adapter";
export type {
  DatabaseAdapter,
  SwarmMailAdapter,
  EventStoreAdapter,
  AgentAdapter,
  MessagingAdapter,
  ReservationAdapter,
  SchemaAdapter,
  ReadEventsOptions,
  InboxOptions,
  Message,
  Reservation,
  Conflict,
} from "./types";



// ============================================================================
// LibSQL Adapter
// ============================================================================

export { createLibSQLAdapter } from "./libsql";
export type { LibSQLConfig } from "./libsql";

// LibSQL Convenience Layer
export {
  getSwarmMailLibSQL,
  createInMemorySwarmMailLibSQL,
  closeSwarmMailLibSQL,
  closeAllSwarmMailLibSQL,
  getDatabasePath as getLibSQLDatabasePath,
  getProjectTempDirName as getLibSQLProjectTempDirName,
  hashProjectPath as hashLibSQLProjectPath,
} from "./libsql.convenience";

// LibSQL Schemas
export {
  createLibSQLStreamsSchema,
  dropLibSQLStreamsSchema,
  validateLibSQLStreamsSchema,
} from "./streams/libsql-schema";
export {
  createLibSQLMemorySchema,
  dropLibSQLMemorySchema,
  validateLibSQLMemorySchema,
  EMBEDDING_DIM as LIBSQL_EMBEDDING_DIM,
} from "./memory/libsql-schema";

// ============================================================================
// Re-export everything from streams for backward compatibility
// ============================================================================

export * from "./streams";

// ============================================================================
// Hive Module Exports (work item tracking)
// ============================================================================

export * from "./hive";



// ============================================================================
// Memory Module Exports (semantic memory store)
// ============================================================================

export {
  createMemoryStore,
  EMBEDDING_DIM,
} from "./memory/store";
export type {
  Memory,
  SearchResult,
  SearchOptions,
} from "./memory/store";

export {
  Ollama,
  OllamaError,
  getDefaultConfig,
  makeOllamaLive,
} from "./memory/ollama";
export type { MemoryConfig } from "./memory/ollama";

export {
  memoryMigration,
  memoryMigrations,
} from "./memory/migrations";

export {
  legacyDatabaseExists,
  migrateLegacyMemories,
  getMigrationStatus,
  getDefaultLegacyPath,
  targetHasMemories,
} from "./memory/migrate-legacy";
export type {
  MigrationOptions,
  MigrationResult,
} from "./memory/migrate-legacy";

// Memory sync (JSONL export/import for git)
export {
  exportMemories,
  importMemories,
  syncMemories,
  parseMemoryJSONL,
  serializeMemoryToJSONL,
} from "./memory/sync";
export type {
  MemoryExport,
  MemoryImportResult,
  ExportOptions as MemoryExportOptions,
  ImportOptions as MemoryImportOptions,
} from "./memory/sync";
