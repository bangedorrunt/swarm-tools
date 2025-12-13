---
name: swarm-coordination
description: Multi-agent coordination patterns for OpenCode swarm workflows. Use when working on complex tasks that benefit from parallelization, when coordinating multiple agents, or when managing task decomposition. Do NOT use for simple single-agent tasks.
tags:
  - swarm
  - multi-agent
  - coordination
tools:
  - swarm_plan_prompt
  - swarm_decompose
  - swarm_validate_decomposition
  - swarm_spawn_subtask
  - swarm_complete
  - swarm_status
  - swarm_progress
  - beads_create_epic
  - beads_query
  - agentmail_init
  - agentmail_send
  - agentmail_inbox
  - agentmail_reserve
  - agentmail_release
  - semantic-memory_find
  - cass_search
  - pdf-brain_search
  - skills_list
references:
  - references/strategies.md
  - references/coordinator-patterns.md
---

# Swarm Coordination

Multi-agent orchestration for parallel task execution. The coordinator breaks work into subtasks, spawns worker agents, monitors progress, and aggregates results.

## When to Swarm

**DO swarm when:**

- Task touches 3+ files
- Natural parallel boundaries exist (frontend/backend/tests)
- Different specializations needed
- Time-to-completion matters

**DON'T swarm when:**

- Task is 1-2 files
- Heavy sequential dependencies
- Coordination overhead > benefit
- Tight feedback loop needed

**Heuristic:** If you can describe the task in one sentence without "and", don't swarm.

## Coordinator Workflow

### Phase 1: Knowledge Gathering (MANDATORY)

Before decomposing, query ALL knowledge sources:

```typescript
// 1. Past learnings from this project
semantic - memory_find({ query: "<task keywords>", limit: 5 });

// 2. How similar tasks were solved before
cass_search({ query: "<task description>", limit: 5 });

// 3. Design patterns and prior art
pdf - brain_search({ query: "<domain concepts>", limit: 5 });

// 4. Available skills to inject into workers
skills_list();
```

Synthesize findings into `shared_context` for workers.

### Phase 2: Decomposition

```typescript
// Auto-select strategy and generate decomposition prompt
const plan = await swarm_plan_prompt({
  task: "Add user authentication with OAuth",
  max_subtasks: 5,
  query_cass: true, // searches history
  include_skills: true, // lists relevant skills
});

// Agent responds with BeadTree JSON, then validate
const validation = await swarm_validate_decomposition({
  response: agentResponse,
});

// Create epic + subtasks atomically
await beads_create_epic({
  epic_title: "Add OAuth Authentication",
  epic_description: "...",
  subtasks: validation.subtasks,
});
```

### Phase 3: Spawn Workers

```typescript
for (const subtask of subtasks) {
  const prompt = await swarm_spawn_subtask({
    bead_id: subtask.id,
    epic_id: epic.id,
    subtask_title: subtask.title,
    subtask_description: subtask.description,
    files: subtask.files,
    shared_context: synthesizedContext,
  });

  // Spawn via Task tool
  Task({
    subagent_type: "swarm/worker",
    prompt: prompt.worker_prompt,
  });
}
```

### Phase 4: Monitor & Intervene

```typescript
// Check progress
const status = await swarm_status({ epic_id, project_key });

// Check for messages
const inbox = await agentmail_inbox({ limit: 5 });

// Intervene if needed (see Intervention Patterns)
```

### Phase 5: Aggregate & Complete

- Verify all subtasks completed
- Run final verification (typecheck, tests)
- Close epic with summary
- Record outcomes for learning

## Decomposition Strategies

Four strategies, auto-selected by task keywords:

| Strategy           | Best For                      | Keywords                              |
| ------------------ | ----------------------------- | ------------------------------------- |
| **file-based**     | Refactoring, migrations       | refactor, migrate, rename, update all |
| **feature-based**  | New features, vertical slices | add, implement, build, create         |
| **risk-based**     | Bug fixes, security           | fix, bug, security, critical          |
| **research-based** | Investigation, discovery      | research, investigate, explore        |

See `references/strategies.md` for full details.

## File Reservation Protocol

Workers MUST reserve files before editing:

```typescript
// Reserve (exclusive by default)
await agentmail_reserve({
  paths: ["src/auth/**"],
  reason: "bd-123: Auth service implementation",
  ttl_seconds: 3600,
});

// Work...

// Release (or let swarm_complete handle it)
await agentmail_release({ paths: ["src/auth/**"] });
```

**Rules:**

- No file overlap between subtasks
- Coordinator mediates conflicts
- `swarm_complete` auto-releases

## Communication Protocol

Workers communicate via Agent Mail with epic ID as thread:

```typescript
// Progress update
agentmail_send({
  to: ["coordinator"],
  subject: "Auth API complete",
  body: "Endpoints ready at /api/auth/*",
  thread_id: epic_id,
});

// Blocker
agentmail_send({
  to: ["coordinator"],
  subject: "BLOCKED: Need DB schema",
  body: "Can't proceed without users table",
  thread_id: epic_id,
  importance: "urgent",
});
```

**Coordinator checks inbox regularly** - don't let workers spin.

## Intervention Patterns

| Signal                  | Action                               |
| ----------------------- | ------------------------------------ |
| Worker blocked >5 min   | Check inbox, offer guidance          |
| File conflict           | Mediate, reassign files              |
| Worker asking questions | Answer directly                      |
| Scope creep             | Redirect, create new bead for extras |
| Repeated failures       | Take over or reassign                |

## Failure Recovery

### Incompatible Outputs

Two workers produce conflicting results.

**Fix:** Pick one approach, re-run other with constraint.

### Worker Drift

Worker implements something different than asked.

**Fix:** Revert, re-run with explicit instructions.

### Cascade Failure

One blocker affects multiple subtasks.

**Fix:** Unblock manually, reassign dependent work, accept partial completion.

## Anti-Patterns

| Anti-Pattern         | Symptom                          | Fix                           |
| -------------------- | -------------------------------- | ----------------------------- |
| **Mega-Coordinator** | Coordinator editing files        | Coordinator only orchestrates |
| **Silent Swarm**     | No communication, late conflicts | Require updates, check inbox  |
| **Over-Decomposed**  | 10 subtasks for 20 lines         | 2-5 subtasks max              |
| **Under-Specified**  | "Implement backend"              | Clear goal, files, criteria   |

## Shared Context Template

```markdown
## Project Context

- Repository: {repo}
- Stack: {tech stack}
- Patterns: {from pdf-brain}

## Task Context

- Epic: {title}
- Goal: {success criteria}
- Constraints: {scope, time}

## Prior Art

- Similar tasks: {from CASS}
- Learnings: {from semantic-memory}

## Coordination

- Active subtasks: {list}
- Reserved files: {list}
- Thread: {epic_id}
```

## Quick Reference

```typescript
// Full swarm flow
semantic - memory_find({ query }); // 1. Check learnings
cass_search({ query }); // 2. Check history
pdf - brain_search({ query }); // 3. Check patterns
skills_list(); // 4. Check skills

swarm_plan_prompt({ task }); // 5. Generate decomposition
swarm_validate_decomposition(); // 6. Validate
beads_create_epic(); // 7. Create beads

swarm_spawn_subtask(); // 8. Spawn workers (loop)
swarm_status(); // 9. Monitor
agentmail_inbox(); // 10. Check messages

// Workers complete with:
swarm_complete(); // Auto: close bead, release files, notify
```

See `references/coordinator-patterns.md` for detailed patterns.
