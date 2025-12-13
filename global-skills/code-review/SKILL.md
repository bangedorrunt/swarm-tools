---
name: code-review
description: Code review patterns for agents. Use when reviewing changes before committing, evaluating pull requests, or assessing code quality. Provides systematic review checklists and feedback patterns.
tags:
  - review
  - quality
  - best-practices
tools:
  - swarm_evaluation_prompt
---

# Code Review Skill

Systematic code review patterns for ensuring quality.

## When to Use

- Before committing changes
- Reviewing pull requests
- Evaluating code quality
- Self-review before completing subtasks
- Assessing unfamiliar code

## Review Protocol

### 1. Understand Context

Before reviewing code:
- What is this change trying to accomplish?
- What files/modules are affected?
- Are there related tests?
- Is this a bugfix, feature, or refactor?

### 2. Quick Scan

First pass - high level issues:
- Does the change make sense overall?
- Is the approach reasonable?
- Any obvious red flags?

### 3. Detailed Review

For each file changed:

**Correctness**
- Does the logic do what it's supposed to?
- Are edge cases handled?
- Are there potential bugs?

**Security**
- Input validation?
- Authentication/authorization checks?
- Sensitive data exposure?
- Injection vulnerabilities?

**Performance**
- Unnecessary loops or database calls?
- Memory leaks potential?
- Appropriate data structures?

**Maintainability**
- Clear naming?
- Reasonable complexity?
- Follows existing patterns?

**Testing**
- Tests for new functionality?
- Edge cases tested?
- Tests actually test the right things?

### 4. Provide Feedback

Structure feedback clearly:

```markdown
## Summary
[Overall assessment - approve, needs changes, questions]

## Issues
- [Critical] Issue description and suggestion
- [Minor] Style issue

## Questions
- Why was X approached this way?

## Suggestions (optional)
- Consider using Y pattern here
```

## Review Checklists

### For New Features

- [ ] Feature works as described
- [ ] Tests cover happy path and edge cases
- [ ] Error handling is appropriate
- [ ] No hardcoded values that should be configurable
- [ ] Documentation updated if needed
- [ ] No TODO comments for critical functionality

### For Bug Fixes

- [ ] Bug is actually fixed
- [ ] Regression test added
- [ ] Root cause addressed (not just symptoms)
- [ ] Similar issues elsewhere checked
- [ ] No new bugs introduced

### For Refactoring

- [ ] Behavior unchanged (all tests pass)
- [ ] Code actually improved
- [ ] No unnecessary changes
- [ ] No feature changes mixed in

## Self-Review Before Commit

Use `swarm_evaluation_prompt` for structured self-evaluation:

```
swarm_evaluation_prompt(
  bead_id: "bd-xxx",
  subtask_title: "What I implemented",
  files_touched: ["file1.ts", "file2.ts"]
)
```

Criteria:
- **type_safe**: Does it compile without errors?
- **no_bugs**: Any obvious bugs or edge cases?
- **patterns**: Follows existing code style?
- **readable**: Would another developer understand it?

## Common Issues to Catch

### Logic Errors
- Off-by-one errors
- Incorrect boolean logic
- Missing null checks
- Race conditions

### Style Issues
- Inconsistent naming
- Magic numbers
- Deep nesting
- Large functions

### Security Issues
- SQL injection potential
- XSS vulnerabilities
- Hardcoded credentials
- Missing auth checks

### Performance Issues
- N+1 queries
- Unnecessary re-renders
- Memory leaks
- Blocking operations

## Swarm Integration

When reviewing in a swarm:
1. **Coordinate reviews** - Don't duplicate effort
2. **Share patterns** - If you catch something, broadcast it
3. **Track issues** - Create beads for non-blocking issues
4. **Learn together** - Good review findings become skills
