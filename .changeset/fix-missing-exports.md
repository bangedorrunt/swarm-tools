---
"swarm-mail": minor
"opencode-swarm-plugin": patch
---

## 🐝 Semantic Memory Consolidation

> *"Simplicity is the ultimate sophistication."*
> — Leonardo da Vinci

The semantic memory system has moved into swarm-mail, bringing persistent learning to the hive.

### What's New

**Semantic Memory in swarm-mail:**
- `createSemanticMemory()` - Initialize memory store with PGLite + Ollama embeddings
- `getMigrationStatus()` - Check if legacy memory needs migration
- `migrateLegacyMemory()` - Migrate from old semantic-memory-mcp format
- Automatic migration on first use (no manual intervention needed)

**Legacy Migration:**
- Detects old `~/.semantic-memory/` databases
- Migrates memories, embeddings, and metadata
- Preserves all tags and timestamps
- Creates backup before migration

**Worker Handoff Protocol:**
- Agents can now hand off work mid-task
- State preserved via swarm mail messages
- Enables long-running tasks across context limits

### Breaking Changes

None - this is additive. The old semantic-memory-mcp still works but is deprecated.

### Files Added/Changed
- `packages/swarm-mail/src/memory/` - New memory subsystem
- `packages/swarm-mail/src/memory/migrate-legacy.ts` - Migration tooling
- `packages/opencode-swarm-plugin/bin/swarm.ts` - Uses new exports
