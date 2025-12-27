---
"swarm-mail": patch
---

## 📚 Wave 1-3 Memory Features Now Documented

> "Following the basic principles of the Zettelkasten method, we designed our memory system to create interconnected knowledge networks through dynamic indexing and linking."
> — *A-MEM: Agentic Memory for LLM Agents*

The swarm-mail README now comprehensively documents all Wave 1-3 memory features:

```
     ┌─────────────────────────────────────────┐
     │         MEMORY SYSTEM DOCS              │
     ├─────────────────────────────────────────┤
     │                                         │
     │  📝 Smart Upsert (Mem0 Pattern)         │
     │     ADD / UPDATE / DELETE / NOOP        │
     │     LLM decides, you relax              │
     │                                         │
     │  🏷️  Auto-Tagging                       │
     │     LLM extracts tags from content      │
     │                                         │
     │  🔗 Memory Linking (Zettelkasten)       │
     │     Interconnected knowledge web        │
     │                                         │
     │  🧠 Entity Extraction (A-MEM)           │
     │     Knowledge graph from memories       │
     │                                         │
     │  ⏰ Temporal Queries                    │
     │     Supersession chains, validity       │
     │                                         │
     └─────────────────────────────────────────┘
```

**What's documented:**
- Basic usage with code examples
- Smart operations (Mem0 pattern)
- Knowledge graph queries
- Temporal validity tracking
- New schema tables and columns
- Service exports for advanced use
- Graceful degradation behavior

**Also fixed:** Removed stale pgvector references → now correctly states libSQL native vector support via sqlite-vec.
