---
"opencode-swarm-plugin": patch
---

Fix workspace:* resolution by running bun install before pack

The lockfile was stale, causing bun pack to resolve workspace:* to old versions.
Now runs bun install first to ensure lockfile matches current package.json versions.
