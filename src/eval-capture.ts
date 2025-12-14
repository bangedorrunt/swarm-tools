/**
 * Eval Data Capture - Captures real swarm execution data for evals
 *
 * Records decomposition inputs, outputs, and outcomes to JSONL files
 * that can be used as ground truth for Evalite evals.
 *
 * Data flow:
 * 1. swarm_decompose captures: task, context, generated decomposition
 * 2. swarm_complete captures: outcome signals per subtask
 * 3. swarm_record_outcome captures: learning signals
 * 4. Human feedback (optional): accept/reject/modify
 *
 * @module eval-capture
 */
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Schemas
// ============================================================================

/**
 * Subtask outcome - what actually happened
 */
export const SubtaskOutcomeSchema = z.object({
  /** Subtask bead ID */
  bead_id: z.string(),
  /** Subtask title */
  title: z.string(),
  /** Planned files */
  planned_files: z.array(z.string()),
  /** Actual files touched */
  actual_files: z.array(z.string()),
  /** Duration in ms */
  duration_ms: z.number().int().min(0),
  /** Error count */
  error_count: z.number().int().min(0),
  /** Retry count */
  retry_count: z.number().int().min(0),
  /** Success */
  success: z.boolean(),
  /** Failure mode if failed */
  failure_mode: z.string().optional(),
});
export type SubtaskOutcome = z.infer<typeof SubtaskOutcomeSchema>;

/**
 * Complete eval record - input, output, and outcome
 */
export const EvalRecordSchema = z.object({
  /** Unique ID for this eval record */
  id: z.string(),
  /** Timestamp when decomposition was generated */
  timestamp: z.string(), // ISO-8601
  /** Project path */
  project_path: z.string(),

  // INPUT
  /** Original task description */
  task: z.string(),
  /** Context provided (codebase info, CASS results, etc.) */
  context: z.string().optional(),
  /** Strategy used for decomposition */
  strategy: z.enum(["file-based", "feature-based", "risk-based", "auto"]),
  /** Max subtasks requested */
  max_subtasks: z.number().int().min(1).max(10),

  // OUTPUT (the decomposition)
  /** Epic title */
  epic_title: z.string(),
  /** Epic description */
  epic_description: z.string().optional(),
  /** Generated subtasks */
  subtasks: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      files: z.array(z.string()),
      dependencies: z.array(z.number()).optional(),
      estimated_complexity: z.number().int().min(1).max(5).optional(),
    }),
  ),

  // OUTCOME (what actually happened)
  /** Subtask outcomes */
  outcomes: z.array(SubtaskOutcomeSchema).optional(),
  /** Overall success (all subtasks succeeded) */
  overall_success: z.boolean().optional(),
  /** Total duration (sum of all subtasks) */
  total_duration_ms: z.number().int().min(0).optional(),
  /** Total errors across all subtasks */
  total_errors: z.number().int().min(0).optional(),

  // HUMAN FEEDBACK (optional)
  /** Human accepted the decomposition as-is */
  human_accepted: z.boolean().optional(),
  /** Human modified the decomposition */
  human_modified: z.boolean().optional(),
  /** Human feedback notes */
  human_notes: z.string().optional(),

  // COMPUTED METRICS
  /** File overlap between subtasks (should be 0) */
  file_overlap_count: z.number().int().min(0).optional(),
  /** Scope accuracy: actual files / planned files */
  scope_accuracy: z.number().min(0).max(2).optional(),
  /** Time balance: max duration / min duration (lower is better) */
  time_balance_ratio: z.number().min(1).optional(),
});
export type EvalRecord = z.infer<typeof EvalRecordSchema>;

/**
 * Partial record for in-progress capture
 */
export type PartialEvalRecord = Partial<EvalRecord> & {
  id: string;
  timestamp: string;
  task: string;
};

// ============================================================================
// Storage
// ============================================================================

/**
 * Default path for eval data
 */
export const DEFAULT_EVAL_DATA_PATH = ".opencode/eval-data.jsonl";

/**
 * Get the eval data file path for a project
 */
export function getEvalDataPath(projectPath: string): string {
  return path.join(projectPath, DEFAULT_EVAL_DATA_PATH);
}

/**
 * Ensure the eval data directory exists
 */
export function ensureEvalDataDir(projectPath: string): void {
  const evalPath = getEvalDataPath(projectPath);
  const dir = path.dirname(evalPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Append an eval record to the JSONL file
 */
export function appendEvalRecord(
  projectPath: string,
  record: EvalRecord | PartialEvalRecord,
): void {
  ensureEvalDataDir(projectPath);
  const evalPath = getEvalDataPath(projectPath);
  const line = JSON.stringify(record) + "\n";
  fs.appendFileSync(evalPath, line, "utf-8");
}

/**
 * Read all eval records from a project
 */
export function readEvalRecords(projectPath: string): EvalRecord[] {
  const evalPath = getEvalDataPath(projectPath);
  if (!fs.existsSync(evalPath)) {
    return [];
  }

  const content = fs.readFileSync(evalPath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);

  return lines.map((line) => {
    const parsed = JSON.parse(line);
    return EvalRecordSchema.parse(parsed);
  });
}

/**
 * Read partial records (for updating in-progress records)
 */
export function readPartialRecords(projectPath: string): PartialEvalRecord[] {
  const evalPath = getEvalDataPath(projectPath);
  if (!fs.existsSync(evalPath)) {
    return [];
  }

  const content = fs.readFileSync(evalPath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);

  return lines.map((line) => JSON.parse(line) as PartialEvalRecord);
}

/**
 * Update an existing record by ID
 */
export function updateEvalRecord(
  projectPath: string,
  id: string,
  updates: Partial<EvalRecord>,
): boolean {
  const records = readPartialRecords(projectPath);
  const index = records.findIndex((r) => r.id === id);

  if (index === -1) {
    return false;
  }

  records[index] = { ...records[index], ...updates };

  // Rewrite the file
  const evalPath = getEvalDataPath(projectPath);
  const content = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(evalPath, content, "utf-8");

  return true;
}

// ============================================================================
// Capture Functions
// ============================================================================

/**
 * In-memory store for in-progress records (keyed by epic ID)
 */
const inProgressRecords = new Map<string, PartialEvalRecord>();

/**
 * Start capturing a decomposition
 *
 * Called when swarm_decompose generates a decomposition.
 * Creates a partial record that will be completed when outcomes arrive.
 */
export function captureDecomposition(params: {
  epicId: string;
  projectPath: string;
  task: string;
  context?: string;
  strategy: "file-based" | "feature-based" | "risk-based" | "auto";
  maxSubtasks: number;
  epicTitle: string;
  epicDescription?: string;
  subtasks: Array<{
    title: string;
    description?: string;
    files: string[];
    dependencies?: number[];
    estimated_complexity?: number;
  }>;
}): PartialEvalRecord {
  const record: PartialEvalRecord = {
    id: params.epicId,
    timestamp: new Date().toISOString(),
    project_path: params.projectPath,
    task: params.task,
    context: params.context,
    strategy: params.strategy,
    max_subtasks: params.maxSubtasks,
    epic_title: params.epicTitle,
    epic_description: params.epicDescription,
    subtasks: params.subtasks,
    outcomes: [],
  };

  // Store in memory for later updates
  inProgressRecords.set(params.epicId, record);

  // Also persist to disk (partial)
  appendEvalRecord(params.projectPath, record);

  return record;
}

/**
 * Capture a subtask outcome
 *
 * Called when swarm_complete finishes a subtask.
 * Updates the in-progress record with outcome data.
 */
export function captureSubtaskOutcome(params: {
  epicId: string;
  projectPath: string;
  beadId: string;
  title: string;
  plannedFiles: string[];
  actualFiles: string[];
  durationMs: number;
  errorCount: number;
  retryCount: number;
  success: boolean;
  failureMode?: string;
}): void {
  const outcome: SubtaskOutcome = {
    bead_id: params.beadId,
    title: params.title,
    planned_files: params.plannedFiles,
    actual_files: params.actualFiles,
    duration_ms: params.durationMs,
    error_count: params.errorCount,
    retry_count: params.retryCount,
    success: params.success,
    failure_mode: params.failureMode,
  };

  // Update in-memory record
  const record = inProgressRecords.get(params.epicId);
  if (record) {
    record.outcomes = record.outcomes || [];
    record.outcomes.push(outcome);
  }

  // Update on disk
  updateEvalRecord(params.projectPath, params.epicId, {
    outcomes: record?.outcomes,
  });
}

/**
 * Finalize an eval record
 *
 * Called when all subtasks are complete.
 * Computes aggregate metrics and marks record as complete.
 */
export function finalizeEvalRecord(params: {
  epicId: string;
  projectPath: string;
}): EvalRecord | null {
  const record = inProgressRecords.get(params.epicId);
  if (!record || !record.outcomes || record.outcomes.length === 0) {
    return null;
  }

  // Compute aggregate metrics
  const outcomes = record.outcomes;

  const overallSuccess = outcomes.every((o) => o.success);
  const totalDurationMs = outcomes.reduce((sum, o) => sum + o.duration_ms, 0);
  const totalErrors = outcomes.reduce((sum, o) => sum + o.error_count, 0);

  // File overlap: count files that appear in multiple subtasks
  const allPlannedFiles = record.subtasks?.flatMap((s) => s.files) || [];
  const fileOccurrences = new Map<string, number>();
  for (const file of allPlannedFiles) {
    fileOccurrences.set(file, (fileOccurrences.get(file) || 0) + 1);
  }
  const fileOverlapCount = Array.from(fileOccurrences.values()).filter(
    (count) => count > 1,
  ).length;

  // Scope accuracy: actual files / planned files
  const plannedFileSet = new Set(allPlannedFiles);
  const actualFileSet = new Set(outcomes.flatMap((o) => o.actual_files));
  const scopeAccuracy =
    plannedFileSet.size > 0 ? actualFileSet.size / plannedFileSet.size : 1;

  // Time balance: max duration / min duration
  const durations = outcomes.map((o) => o.duration_ms).filter((d) => d > 0);
  const timeBalanceRatio =
    durations.length > 1 ? Math.max(...durations) / Math.min(...durations) : 1;

  // Update record with computed metrics
  const finalRecord: EvalRecord = {
    ...(record as EvalRecord),
    overall_success: overallSuccess,
    total_duration_ms: totalDurationMs,
    total_errors: totalErrors,
    file_overlap_count: fileOverlapCount,
    scope_accuracy: scopeAccuracy,
    time_balance_ratio: timeBalanceRatio,
  };

  // Update on disk
  updateEvalRecord(params.projectPath, params.epicId, finalRecord);

  // Remove from in-progress
  inProgressRecords.delete(params.epicId);

  return finalRecord;
}

/**
 * Capture human feedback on a decomposition
 */
export function captureHumanFeedback(params: {
  epicId: string;
  projectPath: string;
  accepted: boolean;
  modified: boolean;
  notes?: string;
}): void {
  updateEvalRecord(params.projectPath, params.epicId, {
    human_accepted: params.accepted,
    human_modified: params.modified,
    human_notes: params.notes,
  });
}

// ============================================================================
// Eval Data Export
// ============================================================================

/**
 * Export eval records as Evalite-compatible test cases
 *
 * Filters to only complete records with outcomes.
 */
export function exportForEvalite(projectPath: string): Array<{
  input: { task: string; context?: string };
  expected: {
    minSubtasks: number;
    maxSubtasks: number;
    requiredFiles?: string[];
    overallSuccess?: boolean;
  };
  actual: EvalRecord;
}> {
  const records = readEvalRecords(projectPath);

  return records
    .filter((r) => r.outcomes && r.outcomes.length > 0)
    .map((record) => ({
      input: {
        task: record.task,
        context: record.context,
      },
      expected: {
        minSubtasks: 2,
        maxSubtasks: record.max_subtasks,
        requiredFiles: record.subtasks.flatMap((s) => s.files),
        overallSuccess: record.overall_success,
      },
      actual: record,
    }));
}

/**
 * Get statistics about captured eval data
 */
export function getEvalDataStats(projectPath: string): {
  totalRecords: number;
  completeRecords: number;
  successRate: number;
  avgSubtasks: number;
  avgDurationMs: number;
  avgScopeAccuracy: number;
  avgTimeBalance: number;
} {
  const records = readEvalRecords(projectPath);
  const complete = records.filter((r) => r.outcomes && r.outcomes.length > 0);

  if (complete.length === 0) {
    return {
      totalRecords: records.length,
      completeRecords: 0,
      successRate: 0,
      avgSubtasks: 0,
      avgDurationMs: 0,
      avgScopeAccuracy: 0,
      avgTimeBalance: 0,
    };
  }

  const successCount = complete.filter((r) => r.overall_success).length;
  const avgSubtasks =
    complete.reduce((sum, r) => sum + (r.outcomes?.length || 0), 0) /
    complete.length;
  const avgDurationMs =
    complete.reduce((sum, r) => sum + (r.total_duration_ms || 0), 0) /
    complete.length;
  const avgScopeAccuracy =
    complete.reduce((sum, r) => sum + (r.scope_accuracy || 1), 0) /
    complete.length;
  const avgTimeBalance =
    complete.reduce((sum, r) => sum + (r.time_balance_ratio || 1), 0) /
    complete.length;

  return {
    totalRecords: records.length,
    completeRecords: complete.length,
    successRate: successCount / complete.length,
    avgSubtasks,
    avgDurationMs,
    avgScopeAccuracy,
    avgTimeBalance,
  };
}
