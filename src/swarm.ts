/**
 * Swarm Module - High-level swarm coordination
 *
 * Orchestrates beads, Agent Mail, and structured validation for parallel task execution.
 * The actual agent spawning happens via OpenCode's Task tool - this module provides
 * the primitives and prompts that /swarm command uses.
 *
 * Key responsibilities:
 * - Task decomposition into bead trees with file assignments
 * - Swarm status tracking via beads + Agent Mail
 * - Progress reporting and completion handling
 * - Prompt templates for decomposition, subtasks, and evaluation
 */
import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import {
  BeadTreeSchema,
  SwarmStatusSchema,
  AgentProgressSchema,
  EvaluationSchema,
  SpawnedAgentSchema,
  BeadSchema,
  type SwarmStatus,
  type AgentProgress,
  type Evaluation,
  type SpawnedAgent,
  type Bead,
} from "./schemas";
import { mcpCall } from "./agent-mail";

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * Prompt for decomposing a task into parallelizable subtasks.
 *
 * Used by swarm:decompose to instruct the agent on how to break down work.
 * The agent responds with a BeadTree that gets validated.
 */
export const DECOMPOSITION_PROMPT = `You are decomposing a task into parallelizable subtasks for a swarm of agents.

## Task
{task}

{context_section}

## Requirements

1. **Break into 2-{max_subtasks} independent subtasks** that can run in parallel
2. **Assign files** - each subtask must specify which files it will modify
3. **No file overlap** - files cannot appear in multiple subtasks (they get exclusive locks)
4. **Order by dependency** - if subtask B needs subtask A's output, A must come first in the array
5. **Estimate complexity** - 1 (trivial) to 5 (complex)

## Response Format

Respond with a JSON object matching this schema:

\`\`\`typescript
{
  epic: {
    title: string,        // Epic title for the beads tracker
    description?: string  // Brief description of the overall goal
  },
  subtasks: [
    {
      title: string,              // What this subtask accomplishes
      description?: string,       // Detailed instructions for the agent
      files: string[],            // Files this subtask will modify (globs allowed)
      dependencies: number[],     // Indices of subtasks this depends on (0-indexed)
      estimated_complexity: 1-5   // Effort estimate
    },
    // ... more subtasks
  ]
}
\`\`\`

## Guidelines

- **Prefer smaller, focused subtasks** over large complex ones
- **Include test files** in the same subtask as the code they test
- **Consider shared types** - if multiple files share types, handle that first
- **Think about imports** - changes to exported APIs affect downstream files

## File Assignment Examples

- Schema change: \`["src/schemas/user.ts", "src/schemas/index.ts"]\`
- Component + test: \`["src/components/Button.tsx", "src/components/Button.test.tsx"]\`
- API route: \`["src/app/api/users/route.ts"]\`

Now decompose the task:`;

/**
 * Prompt template for spawned subtask agents.
 *
 * Each agent receives this prompt with their specific subtask details filled in.
 * The prompt establishes context, constraints, and expectations.
 */
export const SUBTASK_PROMPT = `You are a swarm agent working on a subtask of a larger epic.

## Your Identity
- **Agent Name**: {agent_name}
- **Bead ID**: {bead_id}
- **Epic ID**: {epic_id}

## Your Subtask
**Title**: {subtask_title}

{subtask_description}

## File Scope
You have exclusive reservations for these files:
{file_list}

**CRITICAL**: Only modify files in your reservation. If you need to modify other files, 
send a message to the coordinator requesting the change.

## Shared Context
{shared_context}

## Coordination Protocol

1. **Start**: Your bead is already marked in_progress
2. **Progress**: Use swarm:progress to report status updates
3. **Blocked**: If you hit a blocker, report it - don't spin
4. **Complete**: Use swarm:complete when done - it handles:
   - Closing your bead with a summary
   - Releasing file reservations
   - Notifying the coordinator

## Self-Evaluation

Before calling swarm:complete, evaluate your work:
- Type safety: Does it compile without errors?
- No obvious bugs: Did you handle edge cases?
- Follows patterns: Does it match existing code style?
- Readable: Would another developer understand it?

If evaluation fails, fix the issues before completing.

## Communication

To message other agents or the coordinator:
\`\`\`
agent-mail:send(
  to: ["coordinator_name" or other agent],
  subject: "Brief subject",
  body: "Message content",
  thread_id: "{epic_id}"
)
\`\`\`

Begin work on your subtask now.`;

/**
 * Prompt for self-evaluation before completing a subtask.
 *
 * Agents use this to assess their work quality before marking complete.
 */
export const EVALUATION_PROMPT = `Evaluate the work completed for this subtask.

## Subtask
**Bead ID**: {bead_id}
**Title**: {subtask_title}

## Files Modified
{files_touched}

## Evaluation Criteria

For each criterion, assess passed/failed and provide brief feedback:

1. **type_safe**: Code compiles without TypeScript errors
2. **no_bugs**: No obvious bugs, edge cases handled
3. **patterns**: Follows existing codebase patterns and conventions
4. **readable**: Code is clear and maintainable

## Response Format

\`\`\`json
{
  "passed": boolean,        // Overall pass/fail
  "criteria": {
    "type_safe": { "passed": boolean, "feedback": string },
    "no_bugs": { "passed": boolean, "feedback": string },
    "patterns": { "passed": boolean, "feedback": string },
    "readable": { "passed": boolean, "feedback": string }
  },
  "overall_feedback": string,
  "retry_suggestion": string | null  // If failed, what to fix
}
\`\`\`

If any criterion fails, the overall evaluation fails and retry_suggestion 
should describe what needs to be fixed.`;

// ============================================================================
// Errors
// ============================================================================

export class SwarmError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "SwarmError";
  }
}

export class DecompositionError extends SwarmError {
  constructor(
    message: string,
    public readonly zodError?: z.ZodError,
  ) {
    super(message, "decompose", zodError?.issues);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format the decomposition prompt with actual values
 */
function formatDecompositionPrompt(
  task: string,
  maxSubtasks: number,
  context?: string,
): string {
  const contextSection = context
    ? `## Additional Context\n${context}`
    : "## Additional Context\n(none provided)";

  return DECOMPOSITION_PROMPT.replace("{task}", task)
    .replace("{max_subtasks}", maxSubtasks.toString())
    .replace("{context_section}", contextSection);
}

/**
 * Format the subtask prompt for a specific agent
 */
export function formatSubtaskPrompt(params: {
  agent_name: string;
  bead_id: string;
  epic_id: string;
  subtask_title: string;
  subtask_description: string;
  files: string[];
  shared_context?: string;
}): string {
  const fileList = params.files.map((f) => `- \`${f}\``).join("\n");

  return SUBTASK_PROMPT.replace("{agent_name}", params.agent_name)
    .replace("{bead_id}", params.bead_id)
    .replace(/{epic_id}/g, params.epic_id)
    .replace("{subtask_title}", params.subtask_title)
    .replace("{subtask_description}", params.subtask_description || "(none)")
    .replace("{file_list}", fileList || "(no files assigned)")
    .replace("{shared_context}", params.shared_context || "(none)");
}

/**
 * Format the evaluation prompt
 */
export function formatEvaluationPrompt(params: {
  bead_id: string;
  subtask_title: string;
  files_touched: string[];
}): string {
  const filesList = params.files_touched.map((f) => `- \`${f}\``).join("\n");

  return EVALUATION_PROMPT.replace("{bead_id}", params.bead_id)
    .replace("{subtask_title}", params.subtask_title)
    .replace("{files_touched}", filesList || "(no files recorded)");
}

/**
 * Query beads for subtasks of an epic
 */
async function queryEpicSubtasks(epicId: string): Promise<Bead[]> {
  const result = await Bun.$`bd list --parent ${epicId} --json`
    .quiet()
    .nothrow();

  if (result.exitCode !== 0) {
    throw new SwarmError(
      `Failed to query subtasks: ${result.stderr.toString()}`,
      "query_subtasks",
    );
  }

  try {
    const parsed = JSON.parse(result.stdout.toString());
    return z.array(BeadSchema).parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new SwarmError(
        `Invalid bead data: ${error.message}`,
        "query_subtasks",
        error.issues,
      );
    }
    throw error;
  }
}

/**
 * Query Agent Mail for swarm thread messages
 */
async function querySwarmMessages(
  projectKey: string,
  threadId: string,
): Promise<number> {
  try {
    interface ThreadSummary {
      summary: { total_messages: number };
    }
    const summary = await mcpCall<ThreadSummary>("summarize_thread", {
      project_key: projectKey,
      thread_id: threadId,
      llm_mode: false, // Just need the count
    });
    return summary.summary.total_messages;
  } catch {
    // Thread might not exist yet
    return 0;
  }
}

/**
 * Format a progress message for Agent Mail
 */
function formatProgressMessage(progress: AgentProgress): string {
  const lines = [
    `**Status**: ${progress.status}`,
    progress.progress_percent !== undefined
      ? `**Progress**: ${progress.progress_percent}%`
      : null,
    progress.message ? `**Message**: ${progress.message}` : null,
    progress.files_touched && progress.files_touched.length > 0
      ? `**Files touched**:\n${progress.files_touched.map((f) => `- \`${f}\``).join("\n")}`
      : null,
    progress.blockers && progress.blockers.length > 0
      ? `**Blockers**:\n${progress.blockers.map((b) => `- ${b}`).join("\n")}`
      : null,
  ];

  return lines.filter(Boolean).join("\n\n");
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Decompose a task into a bead tree
 *
 * This is a PROMPT tool - it returns a prompt for the agent to respond to.
 * The agent's response (JSON) should be validated with BeadTreeSchema.
 */
export const swarm_decompose = tool({
  description:
    "Generate decomposition prompt for breaking task into parallelizable subtasks",
  args: {
    task: tool.schema.string().min(1).describe("Task description to decompose"),
    max_subtasks: tool.schema
      .number()
      .int()
      .min(2)
      .max(10)
      .default(5)
      .describe("Maximum number of subtasks (default: 5)"),
    context: tool.schema
      .string()
      .optional()
      .describe("Additional context (codebase info, constraints, etc.)"),
  },
  async execute(args) {
    const prompt = formatDecompositionPrompt(
      args.task,
      args.max_subtasks ?? 5,
      args.context,
    );

    // Return the prompt and schema info for the caller
    return JSON.stringify(
      {
        prompt,
        expected_schema: "BeadTree",
        schema_hint: {
          epic: { title: "string", description: "string?" },
          subtasks: [
            {
              title: "string",
              description: "string?",
              files: "string[]",
              dependencies: "number[]",
              estimated_complexity: "1-5",
            },
          ],
        },
        validation_note:
          "Parse agent response as JSON and validate with BeadTreeSchema from schemas/bead.ts",
      },
      null,
      2,
    );
  },
});

/**
 * Validate a decomposition response from an agent
 *
 * Use this after the agent responds to swarm:decompose to validate the structure.
 */
export const swarm_validate_decomposition = tool({
  description: "Validate a decomposition response against BeadTreeSchema",
  args: {
    response: tool.schema
      .string()
      .describe("JSON response from agent (BeadTree format)"),
  },
  async execute(args) {
    try {
      const parsed = JSON.parse(args.response);
      const validated = BeadTreeSchema.parse(parsed);

      // Additional validation: check for file conflicts
      const allFiles = new Set<string>();
      const conflicts: string[] = [];

      for (const subtask of validated.subtasks) {
        for (const file of subtask.files) {
          if (allFiles.has(file)) {
            conflicts.push(file);
          }
          allFiles.add(file);
        }
      }

      if (conflicts.length > 0) {
        return JSON.stringify(
          {
            valid: false,
            error: `File conflicts detected: ${conflicts.join(", ")}`,
            hint: "Each file can only be assigned to one subtask",
          },
          null,
          2,
        );
      }

      // Check dependency indices are valid
      for (let i = 0; i < validated.subtasks.length; i++) {
        const deps = validated.subtasks[i].dependencies;
        for (const dep of deps) {
          if (dep >= i) {
            return JSON.stringify(
              {
                valid: false,
                error: `Invalid dependency: subtask ${i} depends on ${dep}, but dependencies must be earlier in the array`,
                hint: "Reorder subtasks so dependencies come before dependents",
              },
              null,
              2,
            );
          }
        }
      }

      return JSON.stringify(
        {
          valid: true,
          bead_tree: validated,
          stats: {
            subtask_count: validated.subtasks.length,
            total_files: allFiles.size,
            total_complexity: validated.subtasks.reduce(
              (sum, s) => sum + s.estimated_complexity,
              0,
            ),
          },
        },
        null,
        2,
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return JSON.stringify(
          {
            valid: false,
            error: "Schema validation failed",
            details: error.issues,
          },
          null,
          2,
        );
      }
      if (error instanceof SyntaxError) {
        return JSON.stringify(
          {
            valid: false,
            error: "Invalid JSON",
            details: error.message,
          },
          null,
          2,
        );
      }
      throw error;
    }
  },
});

/**
 * Get status of a swarm by epic ID
 *
 * Requires project_key to query Agent Mail for message counts.
 */
export const swarm_status = tool({
  description: "Get status of a swarm by epic ID",
  args: {
    epic_id: tool.schema.string().describe("Epic bead ID (e.g., bd-abc123)"),
    project_key: tool.schema
      .string()
      .describe("Project path (for Agent Mail queries)"),
  },
  async execute(args) {
    // Query subtasks from beads
    const subtasks = await queryEpicSubtasks(args.epic_id);

    // Count statuses
    const statusCounts = {
      running: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
    };

    const agents: SpawnedAgent[] = [];

    for (const bead of subtasks) {
      // Map bead status to agent status
      let agentStatus: SpawnedAgent["status"] = "pending";
      switch (bead.status) {
        case "in_progress":
          agentStatus = "running";
          statusCounts.running++;
          break;
        case "closed":
          agentStatus = "completed";
          statusCounts.completed++;
          break;
        case "blocked":
          agentStatus = "pending"; // Blocked treated as pending for swarm
          statusCounts.blocked++;
          break;
        default:
          // open = pending
          break;
      }

      agents.push({
        bead_id: bead.id,
        agent_name: "", // We don't track this in beads
        status: agentStatus,
        files: [], // Would need to parse from description
      });
    }

    // Query Agent Mail for message activity
    const messageCount = await querySwarmMessages(
      args.project_key,
      args.epic_id,
    );

    const status: SwarmStatus = {
      epic_id: args.epic_id,
      total_agents: subtasks.length,
      running: statusCounts.running,
      completed: statusCounts.completed,
      failed: statusCounts.failed,
      blocked: statusCounts.blocked,
      agents,
      last_update: new Date().toISOString(),
    };

    // Validate and return
    const validated = SwarmStatusSchema.parse(status);

    return JSON.stringify(
      {
        ...validated,
        message_count: messageCount,
        progress_percent:
          subtasks.length > 0
            ? Math.round((statusCounts.completed / subtasks.length) * 100)
            : 0,
      },
      null,
      2,
    );
  },
});

/**
 * Report progress on a subtask
 *
 * Takes explicit agent identity since tools don't have persistent state.
 */
export const swarm_progress = tool({
  description: "Report progress on a subtask to coordinator",
  args: {
    project_key: tool.schema.string().describe("Project path"),
    agent_name: tool.schema.string().describe("Your Agent Mail name"),
    bead_id: tool.schema.string().describe("Subtask bead ID"),
    status: tool.schema
      .enum(["in_progress", "blocked", "completed", "failed"])
      .describe("Current status"),
    message: tool.schema
      .string()
      .optional()
      .describe("Progress message or blockers"),
    progress_percent: tool.schema
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("Completion percentage"),
    files_touched: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Files modified so far"),
  },
  async execute(args) {
    // Build progress report
    const progress: AgentProgress = {
      bead_id: args.bead_id,
      agent_name: args.agent_name,
      status: args.status,
      progress_percent: args.progress_percent,
      message: args.message,
      files_touched: args.files_touched,
      timestamp: new Date().toISOString(),
    };

    // Validate
    const validated = AgentProgressSchema.parse(progress);

    // Update bead status if needed
    if (args.status === "blocked" || args.status === "in_progress") {
      const beadStatus = args.status === "blocked" ? "blocked" : "in_progress";
      await Bun.$`bd update ${args.bead_id} --status ${beadStatus} --json`
        .quiet()
        .nothrow();
    }

    // Extract epic ID from bead ID (e.g., bd-abc123.1 -> bd-abc123)
    const epicId = args.bead_id.includes(".")
      ? args.bead_id.split(".")[0]
      : args.bead_id;

    // Send progress message to thread
    await mcpCall("send_message", {
      project_key: args.project_key,
      sender_name: args.agent_name,
      to: [], // Coordinator will pick it up from thread
      subject: `Progress: ${args.bead_id} - ${args.status}`,
      body_md: formatProgressMessage(validated),
      thread_id: epicId,
      importance: args.status === "blocked" ? "high" : "normal",
    });

    return `Progress reported: ${args.status}${args.progress_percent !== undefined ? ` (${args.progress_percent}%)` : ""}`;
  },
});

/**
 * Mark a subtask as complete
 *
 * Closes bead, releases reservations, notifies coordinator.
 */
export const swarm_complete = tool({
  description:
    "Mark subtask complete, release reservations, notify coordinator",
  args: {
    project_key: tool.schema.string().describe("Project path"),
    agent_name: tool.schema.string().describe("Your Agent Mail name"),
    bead_id: tool.schema.string().describe("Subtask bead ID"),
    summary: tool.schema.string().describe("Brief summary of work done"),
    evaluation: tool.schema
      .string()
      .optional()
      .describe("Self-evaluation JSON (Evaluation schema)"),
  },
  async execute(args) {
    // Parse and validate evaluation if provided
    let parsedEvaluation: Evaluation | undefined;
    if (args.evaluation) {
      try {
        parsedEvaluation = EvaluationSchema.parse(JSON.parse(args.evaluation));
      } catch (error) {
        return JSON.stringify(
          {
            success: false,
            error: "Invalid evaluation format",
            details: error instanceof z.ZodError ? error.issues : String(error),
          },
          null,
          2,
        );
      }

      // If evaluation failed, don't complete
      if (!parsedEvaluation.passed) {
        return JSON.stringify(
          {
            success: false,
            error: "Self-evaluation failed",
            retry_suggestion: parsedEvaluation.retry_suggestion,
            feedback: parsedEvaluation.overall_feedback,
          },
          null,
          2,
        );
      }
    }

    // Close the bead
    const closeResult =
      await Bun.$`bd close ${args.bead_id} --reason ${args.summary} --json`
        .quiet()
        .nothrow();

    if (closeResult.exitCode !== 0) {
      throw new SwarmError(
        `Failed to close bead: ${closeResult.stderr.toString()}`,
        "complete",
      );
    }

    // Release file reservations for this agent
    await mcpCall("release_file_reservations", {
      project_key: args.project_key,
      agent_name: args.agent_name,
    });

    // Extract epic ID
    const epicId = args.bead_id.includes(".")
      ? args.bead_id.split(".")[0]
      : args.bead_id;

    // Send completion message
    const completionBody = [
      `## Subtask Complete: ${args.bead_id}`,
      "",
      `**Summary**: ${args.summary}`,
      "",
      parsedEvaluation
        ? `**Self-Evaluation**: ${parsedEvaluation.passed ? "PASSED" : "FAILED"}`
        : "",
      parsedEvaluation?.overall_feedback
        ? `**Feedback**: ${parsedEvaluation.overall_feedback}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    await mcpCall("send_message", {
      project_key: args.project_key,
      sender_name: args.agent_name,
      to: [], // Thread broadcast
      subject: `Complete: ${args.bead_id}`,
      body_md: completionBody,
      thread_id: epicId,
      importance: "normal",
    });

    return JSON.stringify(
      {
        success: true,
        bead_id: args.bead_id,
        closed: true,
        reservations_released: true,
        message_sent: true,
      },
      null,
      2,
    );
  },
});

/**
 * Generate subtask prompt for a spawned agent
 */
export const swarm_subtask_prompt = tool({
  description: "Generate the prompt for a spawned subtask agent",
  args: {
    agent_name: tool.schema.string().describe("Agent Mail name for the agent"),
    bead_id: tool.schema.string().describe("Subtask bead ID"),
    epic_id: tool.schema.string().describe("Epic bead ID"),
    subtask_title: tool.schema.string().describe("Subtask title"),
    subtask_description: tool.schema
      .string()
      .optional()
      .describe("Detailed subtask instructions"),
    files: tool.schema
      .array(tool.schema.string())
      .describe("Files assigned to this subtask"),
    shared_context: tool.schema
      .string()
      .optional()
      .describe("Context shared across all agents"),
  },
  async execute(args) {
    const prompt = formatSubtaskPrompt({
      agent_name: args.agent_name,
      bead_id: args.bead_id,
      epic_id: args.epic_id,
      subtask_title: args.subtask_title,
      subtask_description: args.subtask_description || "",
      files: args.files,
      shared_context: args.shared_context,
    });

    return prompt;
  },
});

/**
 * Generate self-evaluation prompt
 */
export const swarm_evaluation_prompt = tool({
  description: "Generate self-evaluation prompt for a completed subtask",
  args: {
    bead_id: tool.schema.string().describe("Subtask bead ID"),
    subtask_title: tool.schema.string().describe("Subtask title"),
    files_touched: tool.schema
      .array(tool.schema.string())
      .describe("Files that were modified"),
  },
  async execute(args) {
    const prompt = formatEvaluationPrompt({
      bead_id: args.bead_id,
      subtask_title: args.subtask_title,
      files_touched: args.files_touched,
    });

    return JSON.stringify(
      {
        prompt,
        expected_schema: "Evaluation",
        schema_hint: {
          passed: "boolean",
          criteria: {
            type_safe: { passed: "boolean", feedback: "string" },
            no_bugs: { passed: "boolean", feedback: "string" },
            patterns: { passed: "boolean", feedback: "string" },
            readable: { passed: "boolean", feedback: "string" },
          },
          overall_feedback: "string",
          retry_suggestion: "string | null",
        },
      },
      null,
      2,
    );
  },
});

// ============================================================================
// Export all tools
// ============================================================================

export const swarmTools = {
  "swarm_decompose": swarm_decompose,
  "swarm_validate_decomposition": swarm_validate_decomposition,
  "swarm_status": swarm_status,
  "swarm_progress": swarm_progress,
  "swarm_complete": swarm_complete,
  "swarm_subtask_prompt": swarm_subtask_prompt,
  "swarm_evaluation_prompt": swarm_evaluation_prompt,
};
