---
name: beads-workflow
description: Issue tracking and task management using the beads system. Use when creating, updating, or managing work items. Use when you need to track bugs, features, tasks, or epics. Do NOT use for simple one-off questions or explorations.
tags:
  - beads
  - issues
  - tracking
  - workflow
tools:
  - beads_create
  - beads_query
  - beads_update
  - beads_close
---

# Beads Workflow Skill

Beads is a local-first issue tracking system designed for AI agents. This skill provides best practices for effective bead management.

## Bead Types

| Type | When to Use |
|------|-------------|
| `bug` | Something is broken and needs fixing |
| `feature` | New functionality to add |
| `task` | General work item |
| `chore` | Maintenance, refactoring, dependencies |
| `epic` | Large initiative with multiple subtasks |

## Creating Effective Beads

### Good Bead Titles
- "Fix null pointer exception in UserService.getProfile()"
- "Add dark mode toggle to settings page"
- "Migrate auth tokens from localStorage to httpOnly cookies"

### Bad Bead Titles
- "Fix bug" (too vague)
- "Make it better" (not actionable)
- "stuff" (meaningless)

### Bead Body Structure

```markdown
## Problem
[Clear description of the issue or need]

## Expected Behavior
[What should happen]

## Current Behavior
[What currently happens, for bugs]

## Proposed Solution
[How to fix/implement, if known]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Notes
[Any additional context, links, or constraints]
```

## Workflow States

```
open → in_progress → closed
         ↓
      blocked (optional)
```

### State Transitions

**Open → In Progress**
```
beads_update(id: "abc123", state: "in_progress")
```
Use when you start working on a bead.

**In Progress → Closed**
```
beads_close(id: "abc123", resolution: "Fixed in commit abc1234")
```
Use when work is complete.

**In Progress → Blocked**
```
beads_update(id: "abc123", state: "blocked", body: "Blocked by #xyz789")
```
Use when you can't proceed due to a dependency.

## Querying Beads

### Find Open Work
```
beads_query(state: "open", type: "bug")
```

### Search by Keywords
```
beads_query(search: "authentication")
```

### List Recent Activity
```
beads_query(limit: 10, sort: "updated")
```

## Epic Management

Epics are containers for related work:

```markdown
---
type: epic
title: User Authentication Overhaul
---

## Objective
Modernize the authentication system

## Subtasks
- [ ] #bead-001: Implement OAuth2 provider
- [ ] #bead-002: Add MFA support
- [ ] #bead-003: Migrate session storage
- [ ] #bead-004: Update login UI
```

### Creating an Epic with Subtasks

1. Create the epic first:
```
beads_create(type: "epic", title: "User Auth Overhaul", body: "...")
```

2. Create subtasks linked to the epic:
```
beads_create(type: "task", title: "Implement OAuth2", parent: "epic-id")
```

## Best Practices

1. **One bead per logical unit of work** - Don't combine unrelated fixes
2. **Update state promptly** - Keep beads reflecting reality
3. **Add context in body** - Future you will thank present you
4. **Link related beads** - Use `#bead-id` references
5. **Close with resolution** - Explain how it was resolved
6. **Use labels** - `priority:high`, `area:frontend`, etc.

## Sync and Collaboration

Beads sync automatically with the central server:
- Changes push on close
- Conflicts merge automatically
- Use `bd sync` to force sync

## Integration with Swarm

When working in a swarm:
1. Create a parent bead for the overall task
2. Decompose into child beads for subtasks
3. Assign agents to specific beads
4. Close beads as subtasks complete
5. Close parent when all children done
