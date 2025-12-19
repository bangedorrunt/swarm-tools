---
"swarm-mail": patch
"opencode-swarm-plugin": patch
---

## 🐝 Squashed the BigInt Date Bug

PGLite returns BIGINT columns as JavaScript `bigint` type. The `Date` constructor throws when given a bigint:

```javascript
new Date(1734628445371n)  // TypeError: Cannot convert a BigInt value to a number
```

This caused `Invalid Date` errors in all hive operations (`hive_query`, `hive_create`, etc).

**Fix:** Wrap timestamps in `Number()` before passing to `Date`:

```typescript
// Before (broken)
new Date(cell.created_at)

// After (works with both number and bigint)
new Date(Number(cell.created_at))
```

**Files fixed:**
- `swarm-mail/src/hive/jsonl.ts` - JSONL export functions
- `opencode-swarm-plugin/src/hive.ts` - `formatCellForOutput()`

**Tests added:** 6 new tests covering bigint date handling edge cases.
