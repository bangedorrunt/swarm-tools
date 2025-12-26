---
"opencode-swarm-plugin": patch
---

## 📐 Swarm Insights Gets Its Blueprint

> *"The major documentation tool for information architecture... diagrams."*
> — Jesse James Garrett, The Elements of User Experience

The README now shows you how the swarm learns, not just that it does.

**Added:**
- ASCII diagram of the swarm learning loop (task → decompose → execute → complete → insights → repeat)
- Data flow architecture showing Event Store → Insights Aggregation → Agents
- Full API reference with TypeScript examples for coordinators and workers
- Token budget table (500 for coordinators, 300 for workers)
- Recommendation threshold table (≥80% = good, <40% = AVOID)
- Data sources table (Event Store, Semantic Memory, Anti-Pattern Registry)

**Why it matters:**
Diagrams > prose for architecture. Now you can see the feedback loop at a glance instead of reading paragraphs. The API examples are copy-pasteable.

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  TASK    │───▶│ INSIGHTS │───▶│  BETTER  │
│          │    │  LAYER   │    │  SWARMS  │
└──────────┘    └──────────┘    └──────────┘
```
