/**
 * Coordinator Discipline Scorers - Evaluate coordinator behavior
 *
 * These scorers measure whether a coordinator follows the protocol:
 * 1. Don't edit files directly (spawn workers)
 * 2. Don't run tests directly (workers do verification)
 * 3. Spawn workers for all subtasks
 * 4. Review worker output before accepting
 * 5. Minimize time to first spawn (don't overthink)
 *
 * Inputs: CoordinatorSession from eval-capture
 */

import { createScorer } from "evalite";
import type { CoordinatorSession } from "../../src/eval-capture.js";

/**
 * Violation Count Scorer
 *
 * Counts VIOLATION events in the session.
 * Each violation reduces score by 0.2.
 *
 * Violations tracked:
 * - coordinator_edited_file (should spawn worker instead)
 * - coordinator_ran_tests (workers do verification)
 * - coordinator_reserved_files (only workers reserve)
 * - no_worker_spawned (subtask exists but no worker)
 *
 * Score: 1.0 - (0.2 * violation_count), floored at 0.0
 */
export const violationCount = createScorer({
  name: "Violation Count",
  description: "Coordinator followed protocol (no direct edits, tests, or reservations)",
  scorer: ({ output }) => {
    try {
      const session = JSON.parse(String(output)) as CoordinatorSession;

      // Count violations
      const violations = session.events.filter(
        (e) => e.event_type === "VIOLATION"
      );

      const count = violations.length;
      const score = Math.max(0, 1.0 - count * 0.2);

      if (count === 0) {
        return {
          score: 1.0,
          message: "Perfect - 0 violations",
        };
      }

      return {
        score,
        message: `${count} violations detected`,
      };
    } catch (error) {
      return {
        score: 0,
        message: `Failed to parse CoordinatorSession: ${error}`,
      };
    }
  },
});

/**
 * Spawn Efficiency Scorer
 *
 * Measures whether workers were spawned for all subtasks.
 * Coordinators should delegate work, not do it themselves.
 *
 * Score: workers_spawned / subtasks_planned
 *
 * If no decomposition_complete event exists, falls back to counting spawns
 * and returns 1.0 if any workers were spawned (better than nothing).
 */
export const spawnEfficiency = createScorer({
  name: "Spawn Efficiency",
  description: "Workers spawned for all subtasks (delegation ratio)",
  scorer: ({ output }) => {
    try {
      const session = JSON.parse(String(output)) as CoordinatorSession;

      // Find decomposition_complete event (has subtask count)
      const decomp = session.events.find(
        (e) =>
          e.event_type === "DECISION" &&
          e.decision_type === "decomposition_complete"
      );

      // Count worker_spawned events
      const spawned = session.events.filter(
        (e) =>
          e.event_type === "DECISION" && e.decision_type === "worker_spawned"
      ).length;

      if (!decomp) {
        // Fallback: if workers were spawned but no decomp event, assume they're doing work
        if (spawned > 0) {
          return {
            score: 1.0,
            message: `${spawned} workers spawned (no decomposition event)`,
          };
        }
        return {
          score: 0,
          message: "No decomposition event found",
        };
      }

      const subtaskCount = (decomp.payload as { subtask_count?: number })?.subtask_count || 0;

      if (subtaskCount === 0) {
        return {
          score: 0,
          message: "No subtasks planned",
        };
      }

      const score = spawned / subtaskCount;

      return {
        score,
        message: `${spawned}/${subtaskCount} workers spawned (${(score * 100).toFixed(0)}%)`,
      };
    } catch (error) {
      return {
        score: 0,
        message: `Failed to parse CoordinatorSession: ${error}`,
      };
    }
  },
});

/**
 * Review Efficiency Scorer
 *
 * Measures review-to-spawn ratio to detect over-reviewing.
 * Ideal ratio is 1:1 (one review per spawned worker).
 * Penalizes >2:1 ratio (over-reviewing wastes context).
 *
 * Scoring:
 * - 0:N or 1:1 ratio = 1.0 (perfect)
 * - 2:1 ratio = 0.5 (threshold)
 * - >2:1 ratio = linear penalty toward 0.0
 *
 * Score: normalized to 0-1 (lower ratio is better)
 */
export const reviewEfficiency = createScorer({
  name: "Review Efficiency",
  description: "Review-to-spawn ratio (penalize over-reviewing >2:1)",
  scorer: ({ output }) => {
    try {
      const session = JSON.parse(String(output)) as CoordinatorSession;

      // Count worker_spawned events
      const spawned = session.events.filter(
        (e) =>
          e.event_type === "DECISION" && e.decision_type === "worker_spawned"
      ).length;

      if (spawned === 0) {
        return {
          score: 1.0,
          message: "No workers spawned",
        };
      }

      // Count review_completed events
      const reviewed = session.events.filter(
        (e) =>
          e.event_type === "DECISION" && e.decision_type === "review_completed"
      ).length;

      const ratio = reviewed / spawned;

      // Scoring:
      // - ratio <= 1.0: perfect (1.0)
      // - ratio <= 2.0: linear decay from 1.0 to 0.5
      // - ratio > 2.0: linear penalty from 0.5 toward 0.0
      let score: number;
      if (ratio <= 1.0) {
        score = 1.0;
      } else if (ratio <= 2.0) {
        // Linear decay: 1.0 at ratio=1.0, 0.5 at ratio=2.0
        score = 1.0 - (ratio - 1.0) * 0.5;
      } else {
        // Penalty for extreme over-reviewing: 0.5 at ratio=2.0, 0.0 at ratio=4.0
        score = Math.max(0, 0.5 - (ratio - 2.0) * 0.25);
      }

      return {
        score,
        message: `${reviewed} reviews / ${spawned} spawns (${ratio.toFixed(1)}:1 ratio)`,
      };
    } catch (error) {
      return {
        score: 0,
        message: `Failed to parse CoordinatorSession: ${error}`,
      };
    }
  },
});

/**
 * Review Thoroughness Scorer
 *
 * Measures whether coordinator reviewed worker output.
 * Should have review_completed events for all finished subtasks.
 *
 * Score: reviews_completed / workers_finished
 */
export const reviewThoroughness = createScorer({
  name: "Review Thoroughness",
  description: "Coordinator reviewed all worker output",
  scorer: ({ output }) => {
    try {
      const session = JSON.parse(String(output)) as CoordinatorSession;

      // Count finished workers (subtask_success or subtask_failed)
      const finished = session.events.filter(
        (e) =>
          e.event_type === "OUTCOME" &&
          (e.outcome_type === "subtask_success" ||
            e.outcome_type === "subtask_failed")
      ).length;

      if (finished === 0) {
        return {
          score: 1.0,
          message: "No finished workers to review",
        };
      }

      // Count review_completed events
      const reviewed = session.events.filter(
        (e) =>
          e.event_type === "DECISION" && e.decision_type === "review_completed"
      ).length;

      const score = reviewed / finished;

      return {
        score,
        message: `${reviewed}/${finished} workers reviewed (${(score * 100).toFixed(0)}%)`,
      };
    } catch (error) {
      return {
        score: 0,
        message: `Failed to parse CoordinatorSession: ${error}`,
      };
    }
  },
});

/**
 * Time to First Spawn Scorer
 *
 * Measures how fast the coordinator spawned the first worker.
 * Overthinking and perfectionism delays workers and blocks progress.
 *
 * Normalization:
 * - < 60s: 1.0 (excellent)
 * - 60-300s: linear decay to 0.5
 * - > 300s: 0.0 (way too slow)
 *
 * Score: normalized to 0-1 (faster is better)
 */
export const timeToFirstSpawn = createScorer({
  name: "Time to First Spawn",
  description: "Coordinator spawned workers quickly (no overthinking)",
  scorer: ({ output }) => {
    try {
      const session = JSON.parse(String(output)) as CoordinatorSession;

      // Find decomposition_complete event
      const decomp = session.events.find(
        (e) =>
          e.event_type === "DECISION" &&
          e.decision_type === "decomposition_complete"
      );

      if (!decomp) {
        return {
          score: 0,
          message: "No decomposition event found",
        };
      }

      // Find first worker_spawned event
      const firstSpawn = session.events.find(
        (e) =>
          e.event_type === "DECISION" && e.decision_type === "worker_spawned"
      );

      if (!firstSpawn) {
        return {
          score: 0,
          message: "No worker spawned",
        };
      }

      // Calculate time delta
      const decompTime = new Date(decomp.timestamp).getTime();
      const spawnTime = new Date(firstSpawn.timestamp).getTime();
      const deltaMs = spawnTime - decompTime;

      // Normalize: < 60s = 1.0, > 300s = 0.0, linear in between
      const EXCELLENT_MS = 60_000;
      const POOR_MS = 300_000;

      let score: number;
      if (deltaMs < EXCELLENT_MS) {
        score = 1.0;
      } else if (deltaMs > POOR_MS) {
        score = 0.0;
      } else {
        // Linear decay from 1.0 to 0.0
        score = 1.0 - (deltaMs - EXCELLENT_MS) / (POOR_MS - EXCELLENT_MS);
      }

      const seconds = Math.round(deltaMs / 1000);

      return {
        score,
        message: `First spawn after ${deltaMs}ms (${seconds}s)`,
      };
    } catch (error) {
      return {
        score: 0,
        message: `Failed to parse CoordinatorSession: ${error}`,
      };
    }
  },
});

/**
 * Researcher Spawn Rate Scorer
 *
 * Measures whether coordinator spawns researchers for unfamiliar technology.
 * Coordinators should delegate research instead of calling pdf-brain/context7 directly.
 *
 * Score: 1.0 if researcher_spawned events exist, 0.0 otherwise
 */
export const researcherSpawnRate = createScorer({
  name: "Researcher Spawn Rate",
  description: "Coordinator spawned researchers for unfamiliar tech",
  scorer: ({ output }) => {
    try {
      const session = JSON.parse(String(output)) as CoordinatorSession;

      // Count researcher_spawned events
      const researchers = session.events.filter(
        (e) =>
          e.event_type === "DECISION" && e.decision_type === "researcher_spawned"
      );

      const count = researchers.length;

      if (count === 0) {
        return {
          score: 0.0,
          message: "No researchers spawned (may indicate coordinator queried docs directly)",
        };
      }

      return {
        score: 1.0,
        message: `${count} researcher(s) spawned`,
      };
    } catch (error) {
      return {
        score: 0,
        message: `Failed to parse CoordinatorSession: ${error}`,
      };
    }
  },
});

/**
 * Skill Loading Rate Scorer
 *
 * Measures whether coordinator loads relevant skills via skills_use().
 * Shows knowledge-seeking behavior.
 *
 * Score: 1.0 if skill_loaded events exist, 0.5 otherwise (not critical, but helpful)
 */
export const skillLoadingRate = createScorer({
  name: "Skill Loading Rate",
  description: "Coordinator loaded relevant skills for domain knowledge",
  scorer: ({ output }) => {
    try {
      const session = JSON.parse(String(output)) as CoordinatorSession;

      // Count skill_loaded events
      const skills = session.events.filter(
        (e) =>
          e.event_type === "DECISION" && e.decision_type === "skill_loaded"
      );

      const count = skills.length;

      if (count === 0) {
        return {
          score: 0.5,
          message: "No skills loaded (not critical, but helpful)",
        };
      }

      return {
        score: 1.0,
        message: `${count} skill(s) loaded`,
      };
    } catch (error) {
      return {
        score: 0,
        message: `Failed to parse CoordinatorSession: ${error}`,
      };
    }
  },
});

/**
 * Inbox Monitoring Rate Scorer
 *
 * Measures how frequently coordinator checks inbox for worker messages.
 * Regular monitoring (every ~15min or when workers finish) shows good coordination.
 *
 * Score based on inbox_checked events relative to worker activity:
 * - 0 checks = 0.0 (coordinator not monitoring)
 * - 1+ checks = 1.0 (coordinator is responsive)
 */
export const inboxMonitoringRate = createScorer({
  name: "Inbox Monitoring Rate",
  description: "Coordinator checked inbox regularly for worker messages",
  scorer: ({ output }) => {
    try {
      const session = JSON.parse(String(output)) as CoordinatorSession;

      // Count inbox_checked events
      const checks = session.events.filter(
        (e) =>
          e.event_type === "DECISION" && e.decision_type === "inbox_checked"
      );

      // Count worker activity (spawns + outcomes)
      const workerActivity = session.events.filter(
        (e) =>
          (e.event_type === "DECISION" && e.decision_type === "worker_spawned") ||
          (e.event_type === "OUTCOME" &&
            ["subtask_success", "subtask_failed", "blocker_detected"].includes(
              e.outcome_type
            ))
      );

      const checkCount = checks.length;
      const activityCount = workerActivity.length;

      if (activityCount === 0) {
        return {
          score: 1.0,
          message: "No worker activity to monitor",
        };
      }

      if (checkCount === 0) {
        return {
          score: 0.0,
          message: `${activityCount} worker events, 0 inbox checks (not monitoring)`,
        };
      }

      return {
        score: 1.0,
        message: `${checkCount} inbox check(s) for ${activityCount} worker events`,
      };
    } catch (error) {
      return {
        score: 0,
        message: `Failed to parse CoordinatorSession: ${error}`,
      };
    }
  },
});

/**
 * Blocker Response Time Scorer
 *
 * Measures how quickly coordinator responds to blocked workers.
 * Time between blocker_detected (OUTCOME) and blocker_resolved (DECISION).
 *
 * Normalization:
 * - < 5min: 1.0 (excellent)
 * - 5-15min: linear decay to 0.5
 * - > 15min: 0.0 (too slow, worker is idle)
 *
 * Score: Average response time across all blockers
 */
export const blockerResponseTime = createScorer({
  name: "Blocker Response Time",
  description: "Coordinator unblocked workers quickly",
  scorer: ({ output }) => {
    try {
      const session = JSON.parse(String(output)) as CoordinatorSession;

      // Find blocker_detected events
      const blockers = session.events.filter(
        (e) =>
          e.event_type === "OUTCOME" && e.outcome_type === "blocker_detected"
      );

      if (blockers.length === 0) {
        return {
          score: 1.0,
          message: "No blockers detected",
        };
      }

      // Find blocker_resolved events
      const resolutions = session.events.filter(
        (e) =>
          e.event_type === "DECISION" && e.decision_type === "blocker_resolved"
      );

      if (resolutions.length === 0) {
        return {
          score: 0.0,
          message: `${blockers.length} blocker(s) detected, 0 resolved (workers still blocked)`,
        };
      }

      // Match blockers to resolutions by subtask_id and calculate response times
      const responseTimes: number[] = [];
      for (const blocker of blockers) {
        const subtaskId = (blocker.payload as any).subtask_id;
        const blockerTime = new Date(blocker.timestamp).getTime();

        // Find resolution for this subtask
        const resolution = resolutions.find(
          (r) => (r.payload as any).subtask_id === subtaskId
        );

        if (resolution) {
          const resolutionTime = new Date(resolution.timestamp).getTime();
          const deltaMs = resolutionTime - blockerTime;
          responseTimes.push(deltaMs);
        }
      }

      if (responseTimes.length === 0) {
        return {
          score: 0.5,
          message: `${blockers.length} blocker(s) detected, ${resolutions.length} resolution(s), but no matches by subtask_id`,
        };
      }

      // Calculate average response time
      const avgResponseMs =
        responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;

      // Normalize: < 5min = 1.0, > 15min = 0.0, linear in between
      const EXCELLENT_MS = 5 * 60 * 1000; // 5 min
      const POOR_MS = 15 * 60 * 1000; // 15 min

      let score: number;
      if (avgResponseMs < EXCELLENT_MS) {
        score = 1.0;
      } else if (avgResponseMs > POOR_MS) {
        score = 0.0;
      } else {
        // Linear decay from 1.0 to 0.0
        score = 1.0 - (avgResponseMs - EXCELLENT_MS) / (POOR_MS - EXCELLENT_MS);
      }

      const avgMinutes = Math.round(avgResponseMs / 1000 / 60);

      return {
        score,
        message: `Avg response time: ${avgMinutes}min (${responseTimes.length}/${blockers.length} blockers resolved)`,
      };
    } catch (error) {
      return {
        score: 0,
        message: `Failed to parse CoordinatorSession: ${error}`,
      };
    }
  },
});

/**
 * Overall Discipline Scorer
 *
 * Weighted composite of all coordinator discipline metrics.
 *
 * Weights:
 * - Violations: 30% (most critical - breaking protocol)
 * - Spawn efficiency: 25% (delegation is key)
 * - Review thoroughness: 25% (quality gate)
 * - Time to first spawn: 20% (bias toward action)
 *
 * Score: 0.0 to 1.0
 */
export const overallDiscipline = createScorer({
  name: "Overall Coordinator Discipline",
  description: "Composite score for coordinator protocol adherence",
  scorer: async ({ output, expected, input }) => {
    try {
      // Run all scorers
      const scores = {
        violations: await violationCount({ output, expected, input }),
        spawn: await spawnEfficiency({ output, expected, input }),
        review: await reviewThoroughness({ output, expected, input }),
        speed: await timeToFirstSpawn({ output, expected, input }),
      };

      // Weighted average
      const weights = {
        violations: 0.3,
        spawn: 0.25,
        review: 0.25,
        speed: 0.2,
      };

      const totalScore =
        (scores.violations.score ?? 0) * weights.violations +
        (scores.spawn.score ?? 0) * weights.spawn +
        (scores.review.score ?? 0) * weights.review +
        (scores.speed.score ?? 0) * weights.speed;

      const details = [
        `Violations: ${((scores.violations.score ?? 0) * 100).toFixed(0)}%`,
        `Spawn: ${((scores.spawn.score ?? 0) * 100).toFixed(0)}%`,
        `Review: ${((scores.review.score ?? 0) * 100).toFixed(0)}%`,
        `Speed: ${((scores.speed.score ?? 0) * 100).toFixed(0)}%`,
      ].join(", ");

      return {
        score: totalScore,
        message: `Overall: ${(totalScore * 100).toFixed(0)}% (${details})`,
      };
    } catch (error) {
      return {
        score: 0,
        message: `Failed to compute composite score: ${error}`,
      };
    }
  },
});
