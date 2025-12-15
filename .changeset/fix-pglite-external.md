---
"swarm-mail": patch
---

fix: mark @electric-sql/pglite as external in build to fix WASM file resolution

PGLite requires its WASM data file (pglite.data) at runtime. When bundled into swarm-mail, the path resolution broke because it looked for the file relative to the bundle location instead of the installed @electric-sql/pglite package location.

This caused "ENOENT: no such file or directory" errors when initializing the database.
