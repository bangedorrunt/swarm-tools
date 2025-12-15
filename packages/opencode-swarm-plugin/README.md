# opencode-swarm-plugin

OpenCode plugin for multi-agent swarm coordination with learning capabilities.

```
 ███████╗██╗    ██╗ █████╗ ██████╗ ███╗   ███╗
 ██╔════╝██║    ██║██╔══██╗██╔══██╗████╗ ████║
 ███████╗██║ █╗ ██║███████║██████╔╝██╔████╔██║
 ╚════██║██║███╗██║██╔══██║██╔══██╗██║╚██╔╝██║
 ███████║╚███╔███╔╝██║  ██║██║  ██║██║ ╚═╝ ██║
 ╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝
```

## Features

- **Swarm Coordination** - Break tasks into parallel subtasks, spawn worker agents
- **Beads Integration** - Git-backed issue tracking with atomic epic creation
- **Agent Mail** - Inter-agent messaging with file reservations
- **Learning System** - Pattern maturity, anti-pattern detection, confidence decay
- **Skills System** - Knowledge injection with bundled and custom skills
- **Checkpointing** - Survive context compaction, resume from last checkpoint

## Install

```bash
npm install -g opencode-swarm-plugin@latest
swarm setup
```

## Usage

```bash
/swarm "Add user authentication with OAuth"
```

## Tools Provided

### Beads (Issue Tracking)

| Tool                | Purpose                               |
| ------------------- | ------------------------------------- |
| `beads_create`      | Create bead with type-safe validation |
| `beads_create_epic` | Atomic epic + subtasks creation       |
| `beads_query`       | Query with filters                    |
| `beads_update`      | Update status/description/priority    |
| `beads_close`       | Close with reason                     |
| `beads_start`       | Mark in-progress                      |
| `beads_ready`       | Get next unblocked bead               |
| `beads_sync`        | Sync to git                           |

### Swarm Mail (Agent Coordination)

| Tool                     | Purpose                          |
| ------------------------ | -------------------------------- |
| `swarmmail_init`         | Initialize session               |
| `swarmmail_send`         | Send message to agents           |
| `swarmmail_inbox`        | Fetch inbox (context-safe)       |
| `swarmmail_read_message` | Fetch one message body           |
| `swarmmail_reserve`      | Reserve files for exclusive edit |
| `swarmmail_release`      | Release reservations             |

### Swarm (Task Orchestration)

| Tool                           | Purpose                                         |
| ------------------------------ | ----------------------------------------------- |
| `swarm_select_strategy`        | Analyze task, recommend strategy                |
| `swarm_decompose`              | Generate decomposition prompt (queries CASS)    |
| `swarm_delegate_planning`      | Delegate planning to planner subagent           |
| `swarm_validate_decomposition` | Validate response, detect conflicts             |
| `swarm_plan_prompt`            | Generate strategy-specific decomposition prompt |
| `swarm_subtask_prompt`         | Generate worker agent prompt                    |
| `swarm_spawn_subtask`          | Prepare subtask for Task tool spawning          |
| `swarm_evaluation_prompt`      | Generate self-evaluation prompt                 |
| `swarm_init`                   | Initialize swarm session                        |
| `swarm_status`                 | Get swarm progress by epic ID                   |
| `swarm_progress`               | Report subtask progress to coordinator          |
| `swarm_complete`               | Complete subtask (runs UBS scan, releases)      |
| `swarm_record_outcome`         | Record outcome for learning                     |
| `swarm_checkpoint`             | Save progress snapshot                          |
| `swarm_recover`                | Resume from checkpoint                          |
| `swarm_learn`                  | Extract learnings from outcome                  |
| `swarm_broadcast`              | Send message to all active agents               |
| `swarm_accumulate_error`       | Track recurring errors (3-strike system)        |
| `swarm_check_strikes`          | Check if error threshold reached                |
| `swarm_get_error_context`      | Get context for error pattern                   |
| `swarm_resolve_error`          | Mark error pattern as resolved                  |

### Skills (Knowledge Injection)

| Tool            | Purpose                 |
| --------------- | ----------------------- |
| `skills_list`   | List available skills   |
| `skills_use`    | Load skill into context |
| `skills_read`   | Read skill content      |
| `skills_create` | Create new skill        |

## Bundled Skills

Located in `global-skills/`:

- **testing-patterns** - 25 dependency-breaking techniques, characterization tests
- **swarm-coordination** - Multi-agent decomposition, file reservations
- **cli-builder** - Argument parsing, help text, subcommands
- **system-design** - Architecture decisions, module boundaries
- **learning-systems** - Confidence decay, pattern maturity
- **skill-creator** - Meta-skill for creating new skills

## Architecture

```
src/
├── beads.ts           # Beads integration
├── agent-mail.ts      # Agent Mail tools (legacy MCP wrapper)
├── swarm-mail.ts      # Swarm Mail tools (new, uses swarm-mail package)
├── swarm.ts           # Swarm orchestration tools
├── swarm-orchestrate.ts # Coordinator logic
├── swarm-decompose.ts # Decomposition strategies
├── swarm-strategies.ts # Strategy selection
├── skills.ts          # Skills system
├── learning.ts        # Pattern maturity, outcomes
├── anti-patterns.ts   # Anti-pattern detection
├── structured.ts      # JSON parsing utilities
├── mandates.ts        # Mandate system
└── schemas/           # Zod schemas
```

## Dependencies

- [swarm-mail](../swarm-mail) - Event sourcing primitives (workspace dependency)
- [@opencode-ai/plugin](https://www.npmjs.com/package/@opencode-ai/plugin) - OpenCode plugin API
- [effect](https://effect.website) - Effect-TS for type-safe composition
- [zod](https://zod.dev) - Schema validation

## Development

```bash
# From monorepo root
bun turbo build --filter=opencode-swarm-plugin
bun turbo test --filter=opencode-swarm-plugin
bun turbo typecheck --filter=opencode-swarm-plugin

# Or from this directory
bun run build
bun test
bun run typecheck
```

## CLI

```bash
swarm setup     # Install and configure
swarm doctor    # Check dependencies
swarm init      # Initialize beads in project
swarm config    # Show config file paths
```

## License

MIT
