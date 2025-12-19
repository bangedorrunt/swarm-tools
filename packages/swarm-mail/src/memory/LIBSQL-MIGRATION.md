# PGlite → libSQL Memory Schema Migration Guide

This document maps PGlite/pgvector patterns to libSQL equivalents for the semantic memory system.

## Quick Reference

| Feature | PGlite (pgvector) | libSQL |
|---------|-------------------|--------|
| **Extension** | `CREATE EXTENSION vector` | Not needed (native) |
| **Vector Column** | `vector(1024)` | `F32_BLOB(1024)` |
| **Insert Vector** | `$1::vector` | `vector(?)` |
| **Distance Function** | `embedding <=> $1::vector` | `vector_distance_cos(embedding, vector(?))` |
| **Distance Meaning** | 0=identical, 2=opposite | 0=identical, 2=opposite |
| **Similarity Score** | `1 - distance` | `1 - distance` |
| **FTS** | GIN index + `to_tsvector` | FTS5 virtual table + triggers |
| **JSON Storage** | `JSONB` | `TEXT` (JSON.stringify) |
| **Timestamps** | `TIMESTAMPTZ` | `TEXT` (ISO 8601) |

## Schema Translation

### PGlite Schema (from migrations.ts)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  collection TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confidence REAL DEFAULT 0.7
);

CREATE TABLE memory_embeddings (
  memory_id TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
  embedding vector(1024) NOT NULL
);

CREATE INDEX memories_content_idx 
ON memories 
USING gin (to_tsvector('english', content));

CREATE INDEX memory_embeddings_hnsw_idx 
ON memory_embeddings 
USING hnsw (embedding vector_cosine_ops);
```

### libSQL Schema (from libsql-schema.ts)

```sql
-- No extension needed!

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',               -- TEXT, not JSONB
  collection TEXT DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now')), -- TEXT, not TIMESTAMPTZ
  confidence REAL DEFAULT 0.7,
  embedding F32_BLOB(1024)                  -- Embedded in same table
);

CREATE INDEX idx_memories_collection ON memories(collection);

-- FTS5 virtual table (replaces GIN index)
CREATE VIRTUAL TABLE memories_fts 
USING fts5(id UNINDEXED, content, content=memories, content_rowid=rowid);

-- Triggers to keep FTS in sync
CREATE TRIGGER memories_fts_insert 
AFTER INSERT ON memories 
BEGIN
  INSERT INTO memories_fts(rowid, id, content) 
  VALUES (new.rowid, new.id, new.content);
END;

CREATE TRIGGER memories_fts_delete 
AFTER DELETE ON memories 
BEGIN
  DELETE FROM memories_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER memories_fts_update 
AFTER UPDATE ON memories 
BEGIN
  UPDATE memories_fts 
  SET id = new.id, content = new.content 
  WHERE rowid = new.rowid;
END;
```

## Query Translation

### Insert Memory + Embedding

**PGlite** (from store.ts):
```typescript
await db.query(
  `INSERT INTO memories (id, content, metadata, collection, created_at, confidence)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [id, content, JSON.stringify(metadata), collection, createdAt.toISOString(), confidence]
);

const vectorStr = `[${embedding.join(",")}]`;
await db.query(
  `INSERT INTO memory_embeddings (memory_id, embedding)
   VALUES ($1, $2::vector)`,
  [id, vectorStr]
);
```

**libSQL**:
```typescript
await db.execute({
  sql: `INSERT INTO memories (id, content, metadata, collection, created_at, confidence, embedding)
        VALUES (?, ?, ?, ?, ?, ?, vector(?))`,
  args: [
    id,
    content,
    JSON.stringify(metadata), // Still stringify, but store as TEXT
    collection,
    createdAt.toISOString(),  // Still ISO string, but store as TEXT
    confidence,
    JSON.stringify(embedding), // vector() expects JSON array string
  ],
});
```

### Vector Similarity Search

**PGlite** (from store.ts):
```typescript
const vectorStr = `[${queryEmbedding.join(",")}]`;
const result = await db.query(
  `SELECT 
     m.id,
     m.content,
     m.metadata,
     m.collection,
     m.created_at,
     m.confidence,
     1 - (e.embedding <=> $1::vector) as score
   FROM memory_embeddings e
   JOIN memories m ON m.id = e.memory_id
   WHERE 1 - (e.embedding <=> $1::vector) >= $2
   ORDER BY e.embedding <=> $1::vector
   LIMIT $3`,
  [vectorStr, threshold, limit]
);
```

**libSQL**:
```typescript
const result = await db.execute({
  sql: `SELECT 
          id,
          content,
          metadata,
          collection,
          created_at,
          confidence,
          1 - vector_distance_cos(embedding, vector(?)) as score
        FROM memories
        WHERE 1 - vector_distance_cos(embedding, vector(?)) >= ?
        ORDER BY vector_distance_cos(embedding, vector(?)) ASC
        LIMIT ?`,
  args: [
    JSON.stringify(queryEmbedding), // Three times (SELECT, WHERE, ORDER BY)
    JSON.stringify(queryEmbedding),
    threshold,
    JSON.stringify(queryEmbedding),
    limit,
  ],
});
```

**Note:** libSQL requires the same vector parameter multiple times (SELECT, WHERE, ORDER BY) since it doesn't cache bind parameters like PostgreSQL.

### Full-Text Search

**PGlite** (from store.ts):
```typescript
const result = await db.query(
  `SELECT 
     m.id,
     m.content,
     m.metadata,
     m.collection,
     m.created_at,
     m.confidence,
     ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', $1)) as score
   FROM memories m
   WHERE to_tsvector('english', m.content) @@ plainto_tsquery('english', $1)
   ORDER BY score DESC
   LIMIT $2`,
  [searchQuery, limit]
);
```

**libSQL**:
```typescript
const result = await db.execute({
  sql: `SELECT 
          m.id,
          m.content,
          m.metadata,
          m.collection,
          m.created_at,
          m.confidence,
          fts.rank as score
        FROM memories_fts fts
        JOIN memories m ON m.id = fts.id
        WHERE memories_fts MATCH ?
        ORDER BY rank
        LIMIT ?`,
  args: [searchQuery, limit],
});
```

**Note:** FTS5 doesn't require language specification like PostgreSQL. The `rank` column is automatically generated by `MATCH`.

## Data Type Conversions

### Metadata (JSONB → TEXT)

**PGlite**:
```typescript
// Insert
await db.query("INSERT INTO memories (metadata) VALUES ($1)", [JSON.stringify(metadata)]);

// Read - PGlite auto-parses JSONB
const row = await db.query("SELECT metadata FROM memories");
const metadata = row.rows[0].metadata; // Already an object
```

**libSQL**:
```typescript
// Insert
await db.execute({
  sql: "INSERT INTO memories (metadata) VALUES (?)",
  args: [JSON.stringify(metadata)],
});

// Read - Must parse manually
const result = await db.execute("SELECT metadata FROM memories");
const metadata = JSON.parse(result.rows[0].metadata as string);
```

### Timestamps (TIMESTAMPTZ → TEXT)

**PGlite**:
```typescript
// Insert
await db.query("INSERT INTO memories (created_at) VALUES ($1)", [new Date().toISOString()]);

// Read - PGlite returns Date objects
const row = await db.query("SELECT created_at FROM memories");
const date = new Date(row.rows[0].created_at); // String or Date
```

**libSQL**:
```typescript
// Insert
await db.execute({
  sql: "INSERT INTO memories (created_at) VALUES (?)",
  args: [new Date().toISOString()],
});

// Read - Always TEXT
const result = await db.execute("SELECT created_at FROM memories");
const date = new Date(result.rows[0].created_at as string);
```

## Performance Notes

### Vector Index

**PGlite**: Uses HNSW index on `memory_embeddings` table.
```sql
CREATE INDEX memory_embeddings_hnsw_idx 
ON memory_embeddings 
USING hnsw (embedding vector_cosine_ops);
```

**libSQL**: Vector index is **implicit** with `F32_BLOB(N)` column. No explicit index needed.

### FTS Index

**PGlite**: GIN index on `to_tsvector` expression.
```sql
CREATE INDEX memories_content_idx 
ON memories 
USING gin (to_tsvector('english', content));
```

**libSQL**: FTS5 virtual table with triggers for automatic sync.
```sql
CREATE VIRTUAL TABLE memories_fts USING fts5(...);
-- Plus INSERT/UPDATE/DELETE triggers
```

## Testing Strategy

Both implementations have identical test coverage:

1. Schema creation and idempotency
2. Vector insertion and retrieval
3. Vector similarity search
4. Full-text search
5. Metadata storage/parsing
6. Default values (confidence, collection, created_at)
7. Schema validation

See:
- `src/memory/migrations.test.ts` - PGlite tests
- `src/memory/libsql-schema.test.ts` - libSQL tests (this migration)

## Migration Checklist for LibSQLAdapter

When implementing `LibSQLAdapter` (next phase):

- [ ] Use `createLibSQLMemorySchema()` instead of running migrations
- [ ] Combine memories + embeddings into single table INSERT
- [ ] Use `vector_distance_cos()` for similarity search
- [ ] Parse metadata from TEXT (not auto-parsed like JSONB)
- [ ] Parse timestamps from TEXT (not auto-converted like TIMESTAMPTZ)
- [ ] Use FTS5 `MATCH` instead of PostgreSQL `@@` operator
- [ ] Repeat vector parameter in SELECT/WHERE/ORDER BY (no caching)
- [ ] Use positional `?` placeholders, not `$1, $2` 
- [ ] Call `db.execute()` with `{ sql, args }`, not `db.query(sql, params)`

## References

- libSQL vector docs: https://github.com/tursodatabase/libsql/blob/main/docs/VECTOR_SEARCH.md
- FTS5 docs: https://www.sqlite.org/fts5.html
- libSQL client API: https://github.com/tursodatabase/libsql-client-ts
- PGlite implementation: `src/memory/migrations.ts`, `src/memory/store.ts`
- Spike validation: `scripts/sqlite-vec-spike.ts`
