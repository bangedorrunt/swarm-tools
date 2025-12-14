# Output Guardrails Integration Example

## How to Integrate into src/index.ts

Add to the `tool.execute.after` hook:

```typescript
import { guardrailOutput, createMetrics } from "./output-guardrails";

// In the SwarmPlugin function:
"tool.execute.after": async (input, output) => {
  const toolName = input.tool;

  // Apply guardrails to prevent context blowout
  const guardrailed = guardrailOutput(toolName, output.output || "");
  
  if (guardrailed.truncated) {
    // Log metrics for learning
    const metrics = createMetrics(guardrailed, toolName);
    console.log(
      `[swarm-plugin] Truncated ${toolName}: ${metrics.originalLength} → ${metrics.truncatedLength} chars`
    );
    
    // Update output
    output.output = guardrailed.output;
  }

  // ... existing code (Agent Mail tracking, auto-release, etc.)
},
```

## What It Does

1. **Prevents Context Exhaustion**: Tools like `context7_get-library-docs` and `repo-autopsy_search` can return 100k+ chars, blowing out context
2. **Smart Truncation**: Preserves JSON structure, code blocks (```), and markdown headers
3. **Per-Tool Limits**: Higher limits for code tools (64k), lower for stats (8k)
4. **Skip Internal Tools**: Never truncates beads_*, swarmmail_*, structured_*, swarm_* tools
5. **Metrics**: Track truncation patterns for future optimization

## Default Limits

- **Default**: 32,000 chars (~8k tokens)
- **Code/Doc Tools**: 64,000 chars (repo-autopsy_file, context7_get-library-docs, cass_view)
- **Search Tools**: 48,000 chars (cass_search, skills_read)
- **Stats Tools**: 8,000-24,000 chars (cass_stats, repo-autopsy_stats, repo-autopsy_structure)
- **Skip Tools**: All beads_*, agentmail_*, swarmmail_*, structured_*, swarm_*, mandate_* tools

## Testing

```bash
# Run tests
bun test src/output-guardrails.test.ts

# Typecheck
bun run typecheck
```

## Coverage

- ✅ 29 tests passing
- ✅ JSON structure preservation
- ✅ Code block boundary detection
- ✅ Markdown header preservation
- ✅ Per-tool limits
- ✅ Skip tool configuration
- ✅ Edge cases (empty string, exact limit, unicode, CRLF)
