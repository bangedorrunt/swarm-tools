---
name: debugging
description: Systematic debugging patterns for agents. Use when encountering errors, unexpected behavior, or when tests fail. Provides structured approaches for root cause analysis and error resolution.
tags:
  - debugging
  - errors
  - troubleshooting
tools:
  - swarm_accumulate_error
  - swarm_get_error_context
  - beads_create
  - semantic-memory_store
---

# Debugging Skill

Systematic approaches for diagnosing and resolving issues.

## When to Use

- Encountering error messages or exceptions
- Tests failing unexpectedly
- Behavior differs from expectations
- Performance issues or timeouts
- Build or compilation errors

## Debugging Protocol

### 1. Reproduce the Issue

Before fixing, ensure you can reproduce:

```bash
# Run the failing command/test again
# Note exact error output
# Capture any stack traces
```

**Record what you find** - Use `swarm_accumulate_error` to track errors for retry context.

### 2. Gather Context

Read surrounding code and error context:

- Error message and stack trace
- Recent changes to affected files
- Related configuration files
- Test fixtures and setup

### 3. Form Hypotheses

Based on the error, list possible causes:

1. Most likely cause based on error message
2. Recent changes that could cause this
3. Environmental/configuration issues
4. Edge cases or missing validations

### 4. Test Hypotheses Systematically

For each hypothesis:

1. Add targeted logging or assertions
2. Modify one variable at a time
3. Verify if behavior changes
4. Document findings

### 5. Implement Fix

Once root cause is identified:

1. Write the minimal fix
2. Add regression test
3. Verify original error is gone
4. Check for similar issues elsewhere

### 6. Document Learning

Use `semantic-memory_store` if you discovered a pattern worth preserving for future sessions.

## Common Error Patterns

### Type Errors

```
Error: Cannot read property 'x' of undefined
```

**Check**: Variable initialization, null/undefined checks, async timing

### Import Errors

```
Error: Module not found
```

**Check**: Path correctness, package installation, export statements

### Timeout Errors

```
Error: Timeout of 5000ms exceeded
```

**Check**: Async operations, network calls, infinite loops

### Validation Errors

```
Error: Validation failed for field 'x'
```

**Check**: Input data, schema definitions, required fields

## Debugging Tools

### Console Logging

```typescript
console.log("[DEBUG]", { variable, context });
```

### Breakpoints (if interactive)

- Add `debugger;` statement
- Use IDE breakpoints

### Binary Search

For "it was working before":

1. Find last known good commit
2. Binary search through commits
3. Identify the breaking change

## Swarm Integration

When debugging in a swarm:

1. **Report blocker immediately** - Don't spin alone
2. **Share context** - Use `swarm_broadcast` with findings
3. **Create beads** - Track discovered issues as bugs
4. **Check other agents** - They might have relevant context

## Anti-Patterns

- **Shotgun debugging** - Random changes hoping something works
- **Silent fixes** - Fixing without understanding root cause
- **Ignoring warnings** - Warnings often predict errors
- **Assuming environment** - Works on my machine != works everywhere
