---
"swarm-mail": patch
"opencode-swarm-plugin": patch
---

Add .beads → .hive directory migration support

- Fix migration version collision: beadsMigration now v7, cellsViewMigration now v8 (was conflicting with streams v6)
- Add `checkBeadsMigrationNeeded()` to detect legacy .beads directories
- Add `migrateBeadsToHive()` to rename .beads to .hive
- Add `ensureHiveDirectory()` to create .hive if missing (called by hive_sync)
- Update hive_sync to ensure .hive directory exists before writing
- Add migration prompt to `swarm setup` CLI flow
