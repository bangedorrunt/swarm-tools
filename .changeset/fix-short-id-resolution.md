---
"swarm-mail": patch
---

## 🔍 Short IDs Finally Work

Cell ID resolution now matches **any unique substring**, not just the hash segment.

**Before:** `hive_start(id="mjkmdat26vq")` → ❌ "No cell found"
**After:** `hive_start(id="mjkmdat26vq")` → ✅ Works!

**What changed:**
- `resolvePartialId()` pattern: `%-hash%-%` → `%substring%`
- Matches project name, hash, OR timestamp+random segments
- Added 3 new tests for timestamp+random matching

**Cell ID anatomy:**
```
opencode-swarm-monorepo-lf2p4u-mjkmdat26vq
│                       │      │
└── project name ───────┘      │
                        └ hash ┘
                               └── timestamp+random (NOW MATCHABLE!)
```

Users can now use the short, memorable end portion of cell IDs.
