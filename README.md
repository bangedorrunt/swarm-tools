# opencode-swarm-plugin

[![npm version](https://img.shields.io/npm/v/opencode-swarm-plugin.svg)](https://www.npmjs.com/package/opencode-swarm-plugin)

```
 ███████╗██╗    ██╗ █████╗ ██████╗ ███╗   ███╗
 ██╔════╝██║    ██║██╔══██╗██╔══██╗████╗ ████║
 ███████╗██║ █╗ ██║███████║██████╔╝██╔████╔██║
 ╚════██║██║███╗██║██╔══██║██╔══██╗██║╚██╔╝██║
 ███████║╚███╔███╔╝██║  ██║██║  ██║██║ ╚═╝ ██║
 ╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝

    \ ` - ' /
   - .(o o). -
    (  >.<  )        Break big tasks into small ones.
     /|   |\         Spawn agents to work in parallel.
    (_|   |_)        Learn from what works.
      bzzzz...
```

## The Problem

You're working with an AI coding agent. You ask it to "add OAuth authentication." It starts writing code. Five minutes later, you realize it's going down the wrong path. Or it's touching files it shouldn't. Or it's making changes that conflict with what you just did in another session.

**The fundamental issue:** AI agents are single-threaded, context-limited, and have no memory of what worked before.

## The Solution

What if the agent could:

- **Break the task into pieces** that can be worked on simultaneously
- **Spawn parallel workers** that don't step on each other
- **Remember what worked** and avoid patterns that failed
- **Survive context compaction** without losing progress

That's what Swarm does.

## How It Works

```
                            "Add OAuth"
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │      COORDINATOR       │
                    │                        │
                    │  1. Query CASS:        │
                    │     "How did we solve  │
                    │      this before?"     │
                    │                        │
                    │  2. Pick strategy:     │
                    │     file-based?        │
                    │     feature-based?     │
                    │     risk-based?        │
                    │                        │
                    │  3. Break into pieces  │
                    └────────────────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
    ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
    │  Worker A   │       │  Worker B   │       │  Worker C   │
    │             │       │             │       │             │
    │ auth/oauth  │       │ auth/session│       │ auth/tests  │
    │   🔒 files  │       │   🔒 files  │       │   🔒 files  │
    │             │       │             │       │             │
    │ "I need     │──────►│ "Got it,    │       │ "Running    │
    │  session    │       │  here's the │       │  tests..."  │
    │  types"     │       │  interface" │       │             │
    └─────────────┘       └─────────────┘       └─────────────┘
           │                     │                     │
           │                     │                     │
           └─────────────────────┼─────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │    LEARNING SYSTEM     │
                    │                        │
                    │  "File-based split     │
                    │   worked well for      │
                    │   auth - 3 workers,    │
                    │   15 min, 0 conflicts" │
                    │                        │
                    │  Next time: use this   │
                    │  pattern again         │
                    └────────────────────────┘
```

### The Flow

1. **You give it a task**: `/swarm "Add OAuth authentication"`

2. **It queries history**: "Have we done something like this before?" (via CASS - cross-agent session search)

3. **It picks a strategy**:
   - **File-based**: "Split by directory structure" (good for refactoring)
   - **Feature-based**: "Split by vertical slices" (good for new features)
   - **Risk-based**: "Tests first, then implementation" (good for bug fixes)
   - **Research-based**: "Explore before committing" (good for unknowns)

4. **It breaks the work into beads** (git-backed issues):

   ```
   Epic: Add OAuth
   ├─ Bead 1: OAuth provider integration (src/auth/oauth.ts)
   ├─ Bead 2: Session management (src/auth/session.ts)
   └─ Bead 3: Integration tests (tests/auth/)
   ```

5. **It spawns parallel workers**:
   - Each worker reserves its files (no conflicts)
   - Workers can message each other via Agent Mail
   - Progress is checkpointed at 25%, 50%, 75%

6. **It learns from the outcome**:
   - Fast + success = good signal
   - Slow + errors = bad signal
   - Patterns that fail >60% of the time get auto-inverted

## What Makes It Different

### It Survives Context Death

OpenCode compacts context when it gets too long. Swarms used to die when this happened. Not anymore.

```
     Session 1                    Context                   Session 2
         │                       Compacts                       │
         ▼                          💥                          ▼
┌─────────────────┐                                   ┌─────────────────┐
│ swarm running   │                                   │ swarm_recover() │
│ ├─ 25% ✓ saved  │                                   │       │         │
│ ├─ 50% ✓ saved  │ ─────────────────────────────────►│       ▼         │
│ └─ 75% ✓ saved  │      checkpoints survive          │ resume at 75%   │
└─────────────────┘                                   └─────────────────┘
```

**Checkpoints capture:**

- Which subtasks are done/in-progress/pending
- File reservations (who owns what)
- Shared context for workers
- Progress percentage

**Recovery restores:**

- Swarm state from last checkpoint
- File locks (prevents conflicts)
- Worker context (what they were doing)

All stored in PGLite (embedded Postgres) - no external servers, survives across sessions.

### It Learns From Outcomes

Every swarm completion records:

- Duration (how long did it take?)
- Errors (how many retries?)
- Files touched (did scope match prediction?)
- Success (did tests pass? were changes accepted?)

This feeds back into the decomposition strategy:

```
                    ┌─────────────────────────────────┐
                    │         LEARNING LOOP           │
                    └─────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   OUTCOMES    │           │   PATTERNS    │           │ ANTI-PATTERNS │
│               │           │               │           │               │
│ fast+success  │           │  candidate    │           │ >60% failure  │
│ = good signal │──────────►│      ↓        │──────────►│ = auto-invert │
│               │           │  established  │           │               │
│ slow+errors   │           │      ↓        │           │ "split by X"  │
│ = bad signal  │           │    proven     │           │ becomes       │
│               │           │               │           │ "DON'T split  │
└───────────────┘           └───────────────┘           │  by X"        │
                                                        └───────────────┘

                    Confidence decays over 90 days
                    unless patterns are revalidated
```

**Pattern maturity lifecycle:**

- `candidate` → new pattern, low confidence
- `established` → validated 3+ times
- `proven` → 10+ successes (gets 1.5x weight in future decompositions)
- `deprecated` → >60% failure rate (auto-inverted to anti-pattern)

**Confidence decay:** Patterns fade over 90 days unless revalidated. Prevents stale knowledge from dominating.

### Swarm Mail: Actor-Model Coordination

Workers don't just run in parallel - they coordinate via **Swarm Mail**, an event-sourced actor model built on local-first primitives.

**What makes Swarm Mail different from traditional agent messaging:**

- **Actor model over durable streams** - DurableMailbox, DurableLock, DurableDeferred (inspired by Electric SQL patterns)
- **Local-first with PGlite** - embedded Postgres, no external servers, survives across sessions
- **Event-sourced coordination** - append-only log, materialized views, full audit trail
- **Context-safe by design** - hard caps on inbox (max 5 messages), thread summarization, body-on-demand

```
┌──────────────────────────────────────────────────────────────┐
│                      SWARM MAIL                              │
│                                                              │
│  Worker A: "I need the SessionUser type"                    │
│            ↓                                                 │
│  Worker B: "Here's the interface:"                          │
│            interface SessionUser {                           │
│              id: string                                      │
│              email: string                                   │
│              roles: string[]                                 │
│            }                                                 │
│            ↓                                                 │
│  Worker A: "Got it, implementing OAuth flow now"            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**File reservations** prevent conflicts:

- Worker A reserves `src/auth/oauth.ts` (exclusive via DurableLock)
- Worker B tries to reserve it → blocked
- Worker B waits or works on something else

**Inbox limits** prevent context bloat:

- Max 5 messages per fetch (headers only)
- Read individual message bodies on demand
- Thread summarization for long conversations

All coordination state survives context compaction and session restarts.

> **Architecture deep-dive:** See [Swarm Mail Architecture](docs/swarm-mail-architecture.md) for implementation details, actor patterns, and event schemas.

### It Has Skills

Skills are knowledge packages agents can load. Teach once, use everywhere.

```typescript
skills_use((name = "testing-patterns")); // Load Feathers seams + Beck's 4 rules
skills_use((name = "swarm-coordination")); // Load swarm workflow patterns
```

**Bundled skills:**

- `testing-patterns` - 25 dependency-breaking techniques, characterization tests
- `swarm-coordination` - Multi-agent decomposition, file reservations
- `cli-builder` - Argument parsing, help text, subcommands
- `system-design` - Architecture decisions, module boundaries
- `learning-systems` - Confidence decay, pattern maturity

**Create your own:**

```bash
swarm init  # Creates .opencode/skills/ in project
```

Skills can include:

- Step-by-step workflows
- Code examples
- Reference documentation
- Executable scripts

## Install

```bash
npm install -g opencode-swarm-plugin@latest
swarm setup
```

## Usage

```bash
/swarm "Add user authentication with OAuth"
```

The coordinator will:

1. Query CASS for similar past tasks
2. Select decomposition strategy
3. Break into subtasks (beads)
4. Spawn parallel workers
5. Track progress with checkpoints
6. Record outcome for learning

## Architecture

Everything runs in-process. No external servers.

```
┌─────────────────────────────────────────────────────────────────┐
│                         YOUR TASK                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  DECOMPOSITION         strategy selection, subtask creation     │
│                        (queries CASS, semantic memory)          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  BEADS                 git-backed issues for each subtask       │
│                        (atomic epic + subtasks creation)        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  SWARM MAIL            actor-model coordination (local-first)   │
│                        (DurableMailbox, DurableLock, PGlite)    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  PGLITE                embedded postgres, event-sourced state   │
│                        (append-only log, materialized views)    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  LEARNING              outcomes feed back into decomposition    │
│                        (confidence decay, pattern maturity)     │
└─────────────────────────────────────────────────────────────────┘
```

### Event Sourcing

All state is stored as an append-only event log:

```
Event Log (PGLite)
├─ agent_registered      → Agent joins swarm
├─ message_sent          → Agent-to-agent communication
├─ file_reserved         → Exclusive file lock acquired
├─ file_released         → Lock released
├─ swarm_checkpointed    → Progress snapshot saved
├─ decomposition_generated → Task broken into subtasks
└─ subtask_outcome       → Worker completion result

Materialized Views (derived from events)
├─ agents                → Active agents per project
├─ messages              → Agent inbox/outbox
├─ file_reservations     → Current file locks
└─ eval_records          → Outcome data for learning
```

**Why event sourcing?**

- **Audit trail** - full history of what happened
- **Replay** - reconstruct state from events
- **Debugging** - see exactly what went wrong
- **Learning** - analyze outcomes over time

### Durable Primitives

Built on Electric SQL patterns:

**DurableCursor** - positioned consumer with checkpointing

```typescript
const cursor = await DurableCursor.create(stream, "my-checkpoint");
const events = await cursor.read(10); // Read 10 events
await cursor.checkpoint(events.length); // Save position
```

**DurableDeferred** - distributed promise with TTL

```typescript
const deferred = await DurableDeferred.create<Response>();
// Send deferred.url to another agent
const response = await deferred.value; // Waits for resolution
```

**DurableLock** - distributed mutex with TTL

```typescript
const lock = await DurableLock.acquire("resource-id", { ttl: 60000 });
// Do work
await lock.release();
```

**DurableMailbox** - actor inbox with typed messages

```typescript
const mailbox = await DurableMailbox.create<Message>("agent-name");
const messages = await mailbox.receive(5); // Get 5 messages
```

These primitives enable:

- **Exactly-once processing** (cursor checkpointing)
- **Request/response** (ask pattern via deferred + mailbox)
- **Exclusive access** (locks for file reservations)
- **Actor coordination** (mailboxes for agent communication)

## Dependencies

| Required                                     | Optional                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [OpenCode](https://opencode.ai)              | [CASS](https://github.com/Dicklesworthstone/coding_agent_session_search) - historical context |
| [Beads](https://github.com/steveyegge/beads) | [UBS](https://github.com/Dicklesworthstone/ultimate_bug_scanner) - bug scanning               |
|                                              | [semantic-memory](https://github.com/joelhooks/semantic-memory) - learning persistence        |

Run `swarm doctor` to check status.

## CLI

```bash
swarm setup     # Install and configure
swarm doctor    # Check dependencies
swarm init      # Initialize beads in project
swarm config    # Show config file paths
```

## Development

```bash
bun install
bun test                # Unit tests (230 tests)
bun run test:integration # Integration tests
bun run build
```

## Credits

**Inspiration & Core Ideas:**

- [MCP Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail) - **THE INSPIRATION** for multi-agent coordination. Swarm Mail is our implementation built on actor-model primitives (DurableMailbox, DurableLock) with local-first PGlite and event sourcing.
- [Superpowers](https://github.com/obra/superpowers) - verification patterns, Socratic planning, skill architecture
- [Electric SQL](https://electric-sql.com) - durable streams and event sourcing patterns that power Swarm Mail
- [Evalite](https://evalite.dev) - outcome-based evaluation framework for learning systems

## License

MIT
