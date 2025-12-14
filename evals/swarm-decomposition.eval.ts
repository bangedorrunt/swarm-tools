/**
 * Swarm Decomposition Quality Eval
 *
 * Tests the quality of task decomposition for swarm coordination.
 * Uses real LLM calls via AI SDK + Vercel AI Gateway.
 *
 * Scorers evaluate:
 * - Subtask independence (no file conflicts)
 * - Complexity balance (even distribution)
 * - Coverage completeness (all required files)
 * - Instruction clarity (actionable descriptions)
 *
 * Run with: pnpm evalite evals/swarm-decomposition.eval.ts
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */
import { evalite } from "evalite";
import {
  subtaskIndependence,
  coverageCompleteness,
  instructionClarity,
} from "./scorers/index.js";
import { decompositionCases } from "./fixtures/decomposition-cases.js";
import {
  generateDecomposition,
  formatDecompositionPrompt,
  extractJson,
} from "./lib/llm.js";
import {
  loadEvalCases,
  hasRealEvalData,
  getEvalDataSummary,
} from "./lib/data-loader.js";

// Determine project key from current directory
const PROJECT_KEY = "opencode-swarm-plugin";
const PROJECT_PATH = process.cwd();

// Check if we have enough real data to use instead of fixtures
const useRealData = await hasRealEvalData(PROJECT_KEY, 5, PROJECT_PATH);

// Load data based on availability
const evalCases = useRealData
  ? await loadEvalCases(PROJECT_KEY, { limit: 20, projectPath: PROJECT_PATH })
  : decompositionCases.map((testCase) => ({
      input: testCase.input,
      expected: testCase.expected,
    }));

// Log data source for transparency
if (useRealData) {
  const summary = await getEvalDataSummary(PROJECT_KEY, PROJECT_PATH);
  console.log(`[eval] Using real data from PGlite:`);
  console.log(`  - Total records: ${summary.totalRecords}`);
  console.log(`  - Success rate: ${(summary.successRate * 100).toFixed(1)}%`);
  console.log(
    `  - Strategies: ${Object.entries(summary.byStrategy)
      .map(([s, c]) => `${s}(${c})`)
      .join(", ")}`,
  );
  console.log(`  - Eval cases: ${evalCases.length}`);
} else {
  console.log(
    `[eval] Using fixture data (${evalCases.length} cases) - not enough real data yet`,
  );
}

/**
 * Swarm Decomposition Quality Eval
 *
 * Tests decomposition quality with real LLM calls.
 */
evalite("Swarm Decomposition Quality", {
  // Test data from PGlite or fixtures
  data: async () => evalCases,

  // Task: generate real decomposition via Claude
  task: async (input) => {
    const prompt = formatDecompositionPrompt(input.task, input.context);
    const response = await generateDecomposition(prompt);
    return extractJson(response);
  },

  // Scorers evaluate decomposition quality
  scorers: [subtaskIndependence, coverageCompleteness, instructionClarity],
});

/**
 * Edge Case Eval: Minimal and Complex Tasks
 *
 * Tests handling of edge cases in decomposition.
 */
evalite("Decomposition Edge Cases", {
  data: async () => [
    {
      input: { task: "Fix typo in README.md" },
      expected: { minSubtasks: 1, maxSubtasks: 2 },
    },
    {
      input: { task: "Refactor entire codebase from JavaScript to TypeScript" },
      expected: { minSubtasks: 4, maxSubtasks: 8 },
    },
  ],

  task: async (input) => {
    const prompt = formatDecompositionPrompt(input.task, undefined, 8);
    const response = await generateDecomposition(prompt);
    return extractJson(response);
  },

  scorers: [subtaskIndependence, coverageCompleteness],
});
