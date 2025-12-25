---
"opencode-swarm-plugin": minor
---

## 🐝 Compaction Prompt Now Speaks Swarm

> *"Memory is essential for communication: we recall past interactions, infer preferences, and construct evolving mental models of those we engage with."*
> — Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory

When context compacts mid-swarm, coordinators were waking up confused. They had state information but no protocol guidance. Now the compaction prompt includes a condensed version of the swarm command template.

**What's New:**

The `SWARM_COMPACTION_CONTEXT` now includes:

1. **What Good Looks Like** - Behavioral examples showing ideal coordinator behavior
   - ✅ Spawned researcher for unfamiliar tech → got summary → stored in semantic-memory
   - ✅ Checked inbox every 5-10 minutes → caught blocked worker → unblocked in 2min
   - ❌ Called context7 directly → dumped 50KB → context exhaustion

2. **Mandatory Behaviors Checklist** - Post-compaction protocol
   - Inbox monitoring (every 5-10 min with intervention triggers)
   - Skill loading (before spawning workers)
   - Worker review (after every worker returns, 3-strike rule)
   - Research spawning (never call context7/pdf-brain directly)

**Why This Matters:**

Coordinators resuming from compaction now have:
- Clear behavioral guidance (not just state)
- Actionable tool call examples
- Anti-patterns to avoid
- The same protocol as fresh `/swarm` invocations

**Backward Compatible:** Existing compaction hooks continue to work. This adds guidance, doesn't change the hook signature.
