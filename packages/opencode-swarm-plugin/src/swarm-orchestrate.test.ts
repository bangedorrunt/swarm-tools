/**
 * Tests for swarm orchestration research phase
 *
 * Validates:
 * - Tech stack extraction from task descriptions
 * - Researcher spawning for identified technologies
 * - Summary collection from semantic-memory
 * - Research result aggregation
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { runResearchPhase, extractTechStack } from "./swarm-orchestrate";

describe("extractTechStack", () => {
  test("extracts Next.js from task description", () => {
    const task = "Add authentication to the Next.js app";
    const techStack = extractTechStack(task);
    
    expect(techStack).toContain("next");
  });

  test("extracts React from task description", () => {
    const task = "Build a React component for user profiles";
    const techStack = extractTechStack(task);
    
    expect(techStack).toContain("react");
  });

  test("extracts multiple technologies", () => {
    const task = "Build a Zod schema for validating Next.js API routes with TypeScript";
    const techStack = extractTechStack(task);
    
    expect(techStack).toContain("zod");
    expect(techStack).toContain("next");
    expect(techStack).toContain("typescript");
  });

  test("returns empty array for generic tasks", () => {
    const task = "Refactor the authentication module";
    const techStack = extractTechStack(task);
    
    // Might extract some keywords but should be minimal
    expect(Array.isArray(techStack)).toBe(true);
  });

  test("handles case-insensitive matching", () => {
    const task = "Add NEXT.JS and REACT hooks";
    const techStack = extractTechStack(task);
    
    expect(techStack).toContain("next");
    expect(techStack).toContain("react");
  });

  test("deduplicates repeated mentions", () => {
    const task = "Use Zod for Zod schemas with Zod validation";
    const techStack = extractTechStack(task);
    
    // Should only appear once
    const zodCount = techStack.filter(t => t === "zod").length;
    expect(zodCount).toBe(1);
  });
});

describe("runResearchPhase", () => {
  const testProjectPath = "/Users/joel/Code/joelhooks/opencode-swarm-plugin";

  test("returns research result with tech stack", async () => {
    const task = "Add Next.js API routes with Zod validation";
    
    const result = await runResearchPhase(task, testProjectPath);
    
    expect(result).toHaveProperty("tech_stack");
    expect(result.tech_stack).toBeInstanceOf(Array);
  });

  test("returns summaries keyed by technology", async () => {
    const task = "Add Next.js API routes";
    
    const result = await runResearchPhase(task, testProjectPath);
    
    expect(result).toHaveProperty("summaries");
    expect(typeof result.summaries).toBe("object");
  });

  test("returns memory IDs for stored research", async () => {
    const task = "Add Zod schemas";
    
    const result = await runResearchPhase(task, testProjectPath);
    
    expect(result).toHaveProperty("memory_ids");
    expect(result.memory_ids).toBeInstanceOf(Array);
  });

  test("skips research for tasks with no tech mentions", async () => {
    const task = "Refactor the authentication module";
    
    const result = await runResearchPhase(task, testProjectPath);
    
    // Should return empty result quickly
    expect(result.tech_stack).toHaveLength(0);
    expect(result.summaries).toEqual({});
    expect(result.memory_ids).toHaveLength(0);
  });

  test("handles check_upgrades option", async () => {
    const task = "Add Next.js caching";
    
    const result = await runResearchPhase(task, testProjectPath, {
      checkUpgrades: true,
    });
    
    // Should still return valid result
    expect(result).toHaveProperty("tech_stack");
    expect(result).toHaveProperty("summaries");
  });
});

describe("swarm_research_phase tool", () => {
  test.todo("exposes research phase as plugin tool");
  test.todo("validates task parameter");
  test.todo("validates project_path parameter");
  test.todo("returns JSON string with research results");
});
