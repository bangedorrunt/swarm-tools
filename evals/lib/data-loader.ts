/**
 * PGlite-backed eval data loader
 *
 * Loads real decomposition outcomes from the eval_records table
 * for use in Evalite evals.
 */
import {
  getEvalRecords,
  getEvalStats,
  type EvalRecord,
} from "../../src/streams/projections.js";

export interface EvalCase {
  input: { task: string; context?: string };
  expected: {
    minSubtasks: number;
    maxSubtasks: number;
    requiredFiles?: string[];
    overallSuccess?: boolean;
  };
  actual?: EvalRecord;
}

/**
 * Load eval cases from PGlite
 *
 * @param projectKey - Project key for filtering records
 * @param options - Filter options
 * @returns Array of eval cases ready for Evalite
 */
export async function loadEvalCases(
  projectKey: string,
  options?: {
    limit?: number;
    strategy?: "file-based" | "feature-based" | "risk-based";
    successOnly?: boolean;
    projectPath?: string;
  },
): Promise<EvalCase[]> {
  const { limit, strategy, successOnly, projectPath } = options ?? {};

  // Query eval records from PGlite
  const records = await getEvalRecords(
    projectKey,
    { limit, strategy },
    projectPath,
  );

  // Filter by success if requested
  const filtered = successOnly
    ? records.filter((r) => r.overall_success === true)
    : records;

  // Transform to EvalCase format
  return filtered.map((record) => ({
    input: {
      task: record.task,
      context: record.context ?? undefined,
    },
    expected: {
      minSubtasks: 2,
      maxSubtasks: record.subtasks.length,
      requiredFiles: record.subtasks.flatMap((s) => s.files),
      overallSuccess: record.overall_success ?? undefined,
    },
    actual: record,
  }));
}

/**
 * Check if we have enough real data to run evals
 *
 * @param projectKey - Project key to check
 * @param minRecords - Minimum number of records required (default: 5)
 * @param projectPath - Optional project path for database lookup
 * @returns True if enough data exists
 */
export async function hasRealEvalData(
  projectKey: string,
  minRecords: number = 5,
  projectPath?: string,
): Promise<boolean> {
  const stats = await getEvalStats(projectKey, projectPath);
  return stats.totalRecords >= minRecords;
}

/**
 * Get eval data stats for reporting
 *
 * @param projectKey - Project key to query
 * @param projectPath - Optional project path for database lookup
 * @returns Summary of available eval data
 */
export async function getEvalDataSummary(
  projectKey: string,
  projectPath?: string,
): Promise<{
  totalRecords: number;
  successRate: number;
  byStrategy: Record<string, number>;
  hasEnoughData: boolean;
}> {
  const stats = await getEvalStats(projectKey, projectPath);

  return {
    totalRecords: stats.totalRecords,
    successRate: stats.successRate,
    byStrategy: stats.byStrategy,
    hasEnoughData: stats.totalRecords >= 5,
  };
}
