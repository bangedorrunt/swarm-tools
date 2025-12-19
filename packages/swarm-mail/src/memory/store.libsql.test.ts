/**
 * Memory Store Tests - libSQL Adapter
 *
 * Tests memory store operations with LibSQLAdapter instead of PGlite.
 * Mirrors store.test.ts but uses libSQL schema and adapter.
 *
 * ## Test Strategy (TDD)
 * 1. CRUD operations (store, get, list, delete)
 * 2. Vector similarity search with threshold/limit/collection filters
 * 3. Full-text search with FTS5
 * 4. Collection filtering
 * 5. Stats query
 * 6. Edge cases (empty results, invalid IDs)
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import type { DatabaseAdapter } from "../types/database.js";
import { createLibSQLMemorySchema } from "./libsql-schema.js";
import { type Memory, createMemoryStore } from "./store.js";

/**
 * Generate a mock embedding vector (1024 dimensions for mxbai-embed-large)
 */
function mockEmbedding(seed = 0): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < 1024; i++) {
    embedding.push(Math.sin(seed + i * 0.1) * 0.5 + 0.5);
  }
  return embedding;
}

describe("Memory Store (libSQL) - CRUD Operations", () => {
  let db: DatabaseAdapter;
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(async () => {
    // Create a shared in-memory database and wrap it
    const client = createClient({ url: ":memory:" });
    
    // Initialize schema on the same client
    await createLibSQLMemorySchema(client);
    
    // Wrap the client in DatabaseAdapter
    db = {
      query: async (sql: string, params?: unknown[]) => {
        const result = await client.execute({ sql, args: params as any });
        return { rows: result.rows as any[] };
      },
      exec: async (sql: string) => {
        await client.execute(sql);
      },
      close: async () => {
        client.close();
      },
    };

    store = createMemoryStore(db);
  });

  afterEach(async () => {
    await db.close();
  });

  test("store creates a new memory", async () => {
    const memory: Memory = {
      id: "mem-1",
      content: "Test memory content",
      metadata: { tag: "test" },
      collection: "default",
      createdAt: new Date(),
    };
    const embedding = mockEmbedding(1);

    await store.store(memory, embedding);

    const retrieved = await store.get("mem-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("mem-1");
    expect(retrieved?.content).toBe("Test memory content");
    expect(retrieved?.metadata).toEqual({ tag: "test" });
    expect(retrieved?.collection).toBe("default");
  });

  test("store updates existing memory", async () => {
    const memory: Memory = {
      id: "mem-1",
      content: "Original content",
      metadata: { version: 1 },
      collection: "default",
      createdAt: new Date(),
    };
    const embedding = mockEmbedding(1);

    await store.store(memory, embedding);

    // Update with new content
    const updated: Memory = {
      ...memory,
      content: "Updated content",
      metadata: { version: 2 },
    };
    const newEmbedding = mockEmbedding(2);

    await store.store(updated, newEmbedding);

    const retrieved = await store.get("mem-1");
    expect(retrieved?.content).toBe("Updated content");
    expect(retrieved?.metadata).toEqual({ version: 2 });
  });

  test("get returns null for non-existent memory", async () => {
    const retrieved = await store.get("non-existent");
    expect(retrieved).toBeNull();
  });

  test("list returns all memories", async () => {
    const mem1: Memory = {
      id: "mem-1",
      content: "First memory",
      metadata: {},
      collection: "default",
      createdAt: new Date(),
    };
    const mem2: Memory = {
      id: "mem-2",
      content: "Second memory",
      metadata: {},
      collection: "default",
      createdAt: new Date(),
    };

    await store.store(mem1, mockEmbedding(1));
    await store.store(mem2, mockEmbedding(2));

    const memories = await store.list();
    expect(memories).toHaveLength(2);
    expect(memories.map((m) => m.id).sort()).toEqual(["mem-1", "mem-2"]);
  });

  test("list filters by collection", async () => {
    const mem1: Memory = {
      id: "mem-1",
      content: "First memory",
      metadata: {},
      collection: "collection-a",
      createdAt: new Date(),
    };
    const mem2: Memory = {
      id: "mem-2",
      content: "Second memory",
      metadata: {},
      collection: "collection-b",
      createdAt: new Date(),
    };

    await store.store(mem1, mockEmbedding(1));
    await store.store(mem2, mockEmbedding(2));

    const memoriesA = await store.list("collection-a");
    expect(memoriesA).toHaveLength(1);
    expect(memoriesA[0].id).toBe("mem-1");

    const memoriesB = await store.list("collection-b");
    expect(memoriesB).toHaveLength(1);
    expect(memoriesB[0].id).toBe("mem-2");
  });

  test("delete removes memory and embedding", async () => {
    const memory: Memory = {
      id: "mem-1",
      content: "Test memory",
      metadata: {},
      collection: "default",
      createdAt: new Date(),
    };

    await store.store(memory, mockEmbedding(1));
    expect(await store.get("mem-1")).not.toBeNull();

    await store.delete("mem-1");
    expect(await store.get("mem-1")).toBeNull();

    // Verify embedding also deleted (in libSQL, same table)
    const result = await db.query(
      "SELECT * FROM memories WHERE id = ?",
      ["mem-1"]
    );
    expect(result.rows).toHaveLength(0);
  });

  test("getStats returns correct counts", async () => {
    const stats = await store.getStats();
    expect(stats.memories).toBe(0);
    expect(stats.embeddings).toBe(0);

    const memory: Memory = {
      id: "mem-1",
      content: "Test memory",
      metadata: {},
      collection: "default",
      createdAt: new Date(),
    };

    await store.store(memory, mockEmbedding(1));

    const updatedStats = await store.getStats();
    expect(updatedStats.memories).toBe(1);
    expect(updatedStats.embeddings).toBe(1);
  });
});

describe("Memory Store (libSQL) - Vector Search", () => {
  let db: DatabaseAdapter;
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(async () => {
    const client = createClient({ url: ":memory:" });
    await createLibSQLMemorySchema(client);
    
    db = {
      query: async (sql: string, params?: unknown[]) => {
        const result = await client.execute({ sql, args: params as any });
        return { rows: result.rows as any[] };
      },
      exec: async (sql: string) => {
        await client.execute(sql);
      },
      close: async () => {
        client.close();
      },
    };

    store = createMemoryStore(db);

    // Insert test memories with different embeddings
    const memories = [
      {
        id: "mem-1",
        content: "This is about TypeScript",
        collection: "tech",
        embedding: mockEmbedding(1),
      },
      {
        id: "mem-2",
        content: "This is about JavaScript",
        collection: "tech",
        embedding: mockEmbedding(1.1), // Similar to mem-1
      },
      {
        id: "mem-3",
        content: "This is about cooking",
        collection: "food",
        embedding: mockEmbedding(50), // Very different
      },
    ];

    for (const mem of memories) {
      await store.store(
        {
          id: mem.id,
          content: mem.content,
          metadata: {},
          collection: mem.collection,
          createdAt: new Date(),
        },
        mem.embedding
      );
    }
  });

  afterEach(async () => {
    await db.close();
  });

  test("search finds similar embeddings", async () => {
    const queryEmbedding = mockEmbedding(1.05); // Similar to mem-1 and mem-2
    const results = await store.search(queryEmbedding);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matchType).toBe("vector");
    // mem-1 and mem-2 should score higher than mem-3
    const topIds = results.slice(0, 2).map((r) => r.memory.id);
    expect(topIds).toContain("mem-1");
    expect(topIds).toContain("mem-2");
  });

  test("search respects limit", async () => {
    const queryEmbedding = mockEmbedding(1);
    const results = await store.search(queryEmbedding, { limit: 2 });

    expect(results.length).toBeLessThanOrEqual(2);
  });

  test("search respects threshold", async () => {
    const queryEmbedding = mockEmbedding(1);
    const results = await store.search(queryEmbedding, { threshold: 0.99 });

    // High threshold should filter out dissimilar results
    expect(results.length).toBeLessThan(3);
    results.forEach((r) => {
      expect(r.score).toBeGreaterThanOrEqual(0.99);
    });
  });

  test("search filters by collection", async () => {
    const queryEmbedding = mockEmbedding(1);
    const results = await store.search(queryEmbedding, { collection: "tech" });

    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(r.memory.collection).toBe("tech");
    });
  });

  test("search returns scores in descending order", async () => {
    const queryEmbedding = mockEmbedding(1);
    const results = await store.search(queryEmbedding);

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });
});

describe("Memory Store (libSQL) - Full-Text Search", () => {
  let db: DatabaseAdapter;
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(async () => {
    const client = createClient({ url: ":memory:" });
    await createLibSQLMemorySchema(client);
    
    db = {
      query: async (sql: string, params?: unknown[]) => {
        const result = await client.execute({ sql, args: params as any });
        return { rows: result.rows as any[] };
      },
      exec: async (sql: string) => {
        await client.execute(sql);
      },
      close: async () => {
        client.close();
      },
    };

    store = createMemoryStore(db);

    // Insert test memories
    const memories = [
      {
        id: "mem-1",
        content: "TypeScript is a typed superset of JavaScript",
        collection: "tech",
      },
      {
        id: "mem-2",
        content: "JavaScript is a dynamic programming language",
        collection: "tech",
      },
      {
        id: "mem-3",
        content: "Python is great for machine learning",
        collection: "tech",
      },
    ];

    for (const mem of memories) {
      await store.store(
        {
          id: mem.id,
          content: mem.content,
          metadata: {},
          collection: mem.collection,
          createdAt: new Date(),
        },
        mockEmbedding(1)
      );
    }
  });

  afterEach(async () => {
    await db.close();
  });

  test("ftsSearch finds text matches", async () => {
    const results = await store.ftsSearch("JavaScript");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matchType).toBe("fts");
    const matchedIds = results.map((r) => r.memory.id);
    expect(matchedIds).toContain("mem-1"); // TypeScript + JavaScript
    expect(matchedIds).toContain("mem-2"); // JavaScript
  });

  test("ftsSearch respects limit", async () => {
    const results = await store.ftsSearch("JavaScript", { limit: 1 });

    expect(results.length).toBe(1);
  });

  test("ftsSearch filters by collection", async () => {
    const results = await store.ftsSearch("programming", { collection: "tech" });

    results.forEach((r) => {
      expect(r.memory.collection).toBe("tech");
    });
  });

  test("ftsSearch returns results ranked by relevance", async () => {
    const results = await store.ftsSearch("JavaScript");

    // Should have descending scores (FTS5 returns negative rank, we normalize)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  test("ftsSearch returns empty for no matches", async () => {
    const results = await store.ftsSearch("quantum physics");

    expect(results.length).toBe(0);
  });
});

describe("Memory Store (libSQL) - Edge Cases", () => {
  let db: DatabaseAdapter;
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(async () => {
    const client = createClient({ url: ":memory:" });
    await createLibSQLMemorySchema(client);
    
    db = {
      query: async (sql: string, params?: unknown[]) => {
        const result = await client.execute({ sql, args: params as any });
        return { rows: result.rows as any[] };
      },
      exec: async (sql: string) => {
        await client.execute(sql);
      },
      close: async () => {
        client.close();
      },
    };

    store = createMemoryStore(db);
  });

  afterEach(async () => {
    await db.close();
  });

  test("search returns empty array when no memories", async () => {
    const results = await store.search(mockEmbedding(1));
    expect(results).toEqual([]);
  });

  test("list returns empty array when no memories", async () => {
    const memories = await store.list();
    expect(memories).toEqual([]);
  });

  test("delete on non-existent memory does not throw", async () => {
    await expect(store.delete("non-existent")).resolves.toBeUndefined();
  });

  test("store handles empty metadata", async () => {
    const memory: Memory = {
      id: "mem-1",
      content: "Test",
      metadata: {},
      collection: "default",
      createdAt: new Date(),
    };

    await store.store(memory, mockEmbedding(1));

    const retrieved = await store.get("mem-1");
    expect(retrieved?.metadata).toEqual({});
  });

  test("store handles complex metadata", async () => {
    const memory: Memory = {
      id: "mem-1",
      content: "Test",
      metadata: {
        tags: ["tag1", "tag2"],
        nested: { key: "value" },
        number: 42,
        bool: true,
      },
      collection: "default",
      createdAt: new Date(),
    };

    await store.store(memory, mockEmbedding(1));

    const retrieved = await store.get("mem-1");
    expect(retrieved?.metadata).toEqual({
      tags: ["tag1", "tag2"],
      nested: { key: "value" },
      number: 42,
      bool: true,
    });
  });
});
