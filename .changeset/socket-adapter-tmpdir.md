---
"swarm-mail": minor
"opencode-swarm-plugin": minor
---

Add PGLite socket server adapter with hybrid daemon management and move streams storage to $TMPDIR.

**Socket Server Adapter:**
- New `createSocketAdapter()` wrapping postgres.js for DatabaseAdapter interface
- Daemon lifecycle: `startDaemon()`, `stopDaemon()`, `isDaemonRunning()`, `healthCheck()`
- Auto-start daemon on first use with `SWARM_MAIL_SOCKET=true` env var
- Graceful fallback to embedded PGLite on failure
- CLI: `swarm-mail-daemon start|stop|status`

**$TMPDIR Storage (BREAKING):**
- Streams now stored in `$TMPDIR/opencode-<project-name>-<hash>/streams`
- Eliminates git pollution from `.opencode/streams/`
- Auto-cleaned on reboot (ephemeral coordination state)
- New exports: `getProjectTempDirName()`, `hashProjectPath()`

This fixes the multi-agent PGLite corruption issue by having all agents connect to a single pglite-server daemon via PostgreSQL wire protocol.
