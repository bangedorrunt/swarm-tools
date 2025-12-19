---
"opencode-swarm-plugin": patch
---

## 🐝 Workers Now Choose Their Own Model

Added intelligent model selection for swarm workers based on task characteristics.

**What changed:**
- `swarm setup` now asks for a "lite model" preference (docs/tests/simple edits)
- New `selectWorkerModel()` function auto-selects based on file types
- `swarm_spawn_subtask` includes `recommended_model` in metadata
- `DecomposedSubtask` schema supports optional explicit `model` field

**Model selection priority:**
1. Explicit `model` field in subtask (if specified)
2. File-type inference:
   - All `.md`/`.mdx` files → lite model
   - All `.test.`/`.spec.` files → lite model  
3. Mixed or implementation files → primary model

**Why it matters:**
- Cost savings: docs and tests don't need expensive models
- Faster execution: lite models are snappier for simple tasks
- Better defaults: right-sized models for each subtask type
- Still flexible: coordinators can override per-subtask

**Backward compatible:** 
- Existing workflows continue to work
- Model selection is transparent to agents
- Defaults to primary model if lite model not configured

**Example:**
```typescript
// Subtask with all markdown files
{ files: ["README.md", "docs/guide.mdx"] }
// → selects lite model (haiku)

// Subtask with mixed files  
{ files: ["src/auth.ts", "README.md"] }
// → selects primary model (sonnet)

// Explicit override
{ files: ["complex-refactor.ts"], model: "anthropic/claude-opus-4-5" }
// → uses opus as specified
```
