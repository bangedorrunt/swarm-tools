/**
 * Outcome-based Scorers Tests
 *
 * Tests the 5 new outcome-based scorers by verifying their exports.
 * Full functional testing happens via Evalite integration.
 */
import { describe, it, expect } from "vitest";

describe("Outcome Scorers", () => {
  it("exports all 5 outcome scorers from outcome-scorers.ts", async () => {
    const module = await import("./outcome-scorers.js");
    expect(module.executionSuccess).toBeDefined();
    expect(module.timeBalance).toBeDefined();
    expect(module.scopeAccuracy).toBeDefined();
    expect(module.scopeDrift).toBeDefined();
    expect(module.noRework).toBeDefined();
  });

  it("re-exports all 5 outcome scorers from index.ts", async () => {
    const indexModule = await import("./index.js");
    expect(indexModule.executionSuccess).toBeDefined();
    expect(indexModule.timeBalance).toBeDefined();
    expect(indexModule.scopeAccuracy).toBeDefined();
    expect(indexModule.scopeDrift).toBeDefined();
    expect(indexModule.noRework).toBeDefined();
  });
});
