/**
 * Tests for eval-runner - Programmatic evalite execution
 *
 * TDD: These tests MUST fail initially, then pass after implementation.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { runEvals } from "./eval-runner";
import path from "node:path";

// Use project root for all tests
const PROJECT_ROOT = path.resolve(import.meta.dir, "..");

describe("runEvals", () => {
  test("runs all evals when no suite filter provided", async () => {
    const result = await runEvals({
      cwd: PROJECT_ROOT,
    });

    // Even if some evals fail, we should get results
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.totalSuites).toBe("number");
    expect(typeof result.totalEvals).toBe("number");
    expect(typeof result.averageScore).toBe("number");
    expect(Array.isArray(result.suites)).toBe(true);

    // Should have at least the example.eval.ts suite
    expect(result.totalSuites).toBeGreaterThan(0);
    expect(result.suites.length).toBeGreaterThan(0);
  }, 60000); // 60s timeout for full eval run

  test("filters evals by suite name", async () => {
    const result = await runEvals({
      cwd: PROJECT_ROOT,
      suiteFilter: "example",
    });

    expect(result.success).toBe(true);
    // All suite filepaths should contain "example"
    for (const suite of result.suites) {
      expect(suite.filepath.toLowerCase()).toContain("example");
    }
  }, 30000);

  test("respects score threshold", async () => {
    const result = await runEvals({
      cwd: PROJECT_ROOT,
      suiteFilter: "example", // Known good eval
      scoreThreshold: 0, // Very low threshold, should pass
    });

    expect(result.success).toBe(true);
    expect(result.averageScore).toBeGreaterThanOrEqual(0);
  }, 30000);

  test("returns structured suite results with scores", async () => {
    const result = await runEvals({
      cwd: PROJECT_ROOT,
      suiteFilter: "example",
    });

    expect(result.suites.length).toBeGreaterThan(0);
    
    const suite = result.suites[0];
    expect(suite).toMatchObject({
      name: expect.any(String),
      filepath: expect.any(String),
      status: expect.stringMatching(/^(success|fail|running)$/),
      duration: expect.any(Number),
      averageScore: expect.any(Number),
      evalCount: expect.any(Number),
    });
  }, 30000);

  test("handles errors gracefully", async () => {
    const result = await runEvals({
      cwd: "/nonexistent/path",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.suites).toEqual([]);
  }, 10000);

  test("returns empty results when no evals match filter", async () => {
    const result = await runEvals({
      cwd: PROJECT_ROOT,
      suiteFilter: "nonexistent-eval-name-xyz",
    });

    // Should succeed but with no suites
    expect(result.success).toBe(true);
    expect(result.totalSuites).toBe(0);
    expect(result.suites).toEqual([]);
  }, 10000);
});
