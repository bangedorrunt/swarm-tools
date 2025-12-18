---
"opencode-swarm-plugin": minor
---

## 🐝 The Great bd CLI Purge

The `bd` CLI is officially dead. Long live HiveAdapter!

**What changed:**

### `swarm init` Command Rewritten
- No longer shells out to `bd init` or `bd create`
- Uses `ensureHiveDirectory()` and `getHiveAdapter()` directly
- Supports `.beads` → `.hive` migration with user prompts
- Creates cells via HiveAdapter, not CLI

### Auto-sync Removed from `index.ts`
- Removed `void $\`bd sync\`.quiet().nothrow()` after `hive_close`
- Users should call `hive_sync` explicitly at session end
- This was a fire-and-forget that could race with other operations

### Plugin Template Updated
- `detectSwarm()` now has confidence levels (HIGH/MEDIUM/LOW/NONE)
- Added `SWARM_DETECTION_FALLBACK` for uncertain cases
- Compaction hook injects context based on confidence:
  - HIGH/MEDIUM → Full swarm context
  - LOW → Fallback detection prompt
  - NONE → No injection

### Error Handling Fixed
- `execTool()` now handles both string and object error formats
- Fixes "Tool execution failed" generic error from `swarm_complete`
- Actual error messages now propagate to the agent

**Why it matters:**
- No external CLI dependency for core functionality
- HiveAdapter is type-safe and testable
- Plugin works in environments without `bd` installed
- Better error messages for debugging

**Migration:** Run `swarm setup` to update your deployed plugin.
