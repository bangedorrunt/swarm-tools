/**
 * Swarm Insights Data Layer Tests
 *
 * TDD: Red → Green → Refactor
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import {
	getStrategyInsights,
	getFileInsights,
	getPatternInsights,
	formatInsightsForPrompt,
	type StrategyInsight,
	type FileInsight,
	type PatternInsight,
} from "./swarm-insights";
import { createInMemorySwarmMail, type SwarmMailAdapter } from "swarm-mail";

describe("swarm-insights data layer", () => {
	let swarmMail: SwarmMailAdapter;

	beforeAll(async () => {
		swarmMail = await createInMemorySwarmMail("test-insights");
	});

	afterAll(async () => {
		await swarmMail.close();
	});

	describe("getStrategyInsights", () => {
		test("returns empty array when no data", async () => {
			const insights = await getStrategyInsights(swarmMail, "test-task");
			expect(insights).toEqual([]);
		});

		test("returns strategy success rates from outcomes", async () => {
			// Seed some outcome events (id is auto-increment, timestamp is integer)
			const db = await swarmMail.getDatabase();
			const now = Date.now();
			await db.query(
				`INSERT INTO events (type, project_key, timestamp, data) VALUES 
				('subtask_outcome', 'test', ?, ?),
				('subtask_outcome', 'test', ?, ?),
				('subtask_outcome', 'test', ?, ?)`,
				[
					now,
					JSON.stringify({ strategy: "file-based", success: "true" }),
					now,
					JSON.stringify({ strategy: "file-based", success: "true" }),
					now,
					JSON.stringify({ strategy: "file-based", success: "false" }),
				],
			);

			const insights = await getStrategyInsights(swarmMail, "test-task");

			expect(insights.length).toBeGreaterThan(0);
			const fileBased = insights.find((i) => i.strategy === "file-based");
			expect(fileBased).toBeDefined();
			expect(fileBased?.successRate).toBeCloseTo(66.67, 0);
			expect(fileBased?.totalAttempts).toBe(3);
		});

		test("includes recommendation based on success rate", async () => {
			const insights = await getStrategyInsights(swarmMail, "test-task");
			const fileBased = insights.find((i) => i.strategy === "file-based");

			expect(fileBased?.recommendation).toBeDefined();
			expect(typeof fileBased?.recommendation).toBe("string");
		});
	});

	describe("getFileInsights", () => {
		test("returns empty array for unknown files", async () => {
			const insights = await getFileInsights(swarmMail, [
				"src/unknown-file.ts",
			]);
			expect(insights).toEqual([]);
		});

		test("returns past issues for known files", async () => {
			// Seed some file-related events (id is auto-increment, timestamp is integer)
			const db = await swarmMail.getDatabase();
			const now = Date.now();
			await db.query(
				`INSERT INTO events (type, project_key, timestamp, data) VALUES 
				('subtask_outcome', 'test', ?, ?)`,
				[
					now,
					JSON.stringify({
						files_touched: ["src/auth.ts"],
						success: "false",
						error_count: 2,
					}),
				],
			);

			const insights = await getFileInsights(swarmMail, ["src/auth.ts"]);

			expect(insights.length).toBeGreaterThan(0);
			const authInsight = insights.find((i) => i.file === "src/auth.ts");
			expect(authInsight).toBeDefined();
			expect(authInsight?.failureCount).toBeGreaterThan(0);
		});

		test("includes gotchas from semantic memory", async () => {
			// This would query semantic memory for file-specific learnings
			const insights = await getFileInsights(swarmMail, ["src/auth.ts"]);

			// Even if no gotchas, the structure should be correct
			const authInsight = insights.find((i) => i.file === "src/auth.ts");
			expect(authInsight?.gotchas).toBeDefined();
			expect(Array.isArray(authInsight?.gotchas)).toBe(true);
		});
	});

	describe("getPatternInsights", () => {
		test("returns common failure patterns", async () => {
			const insights = await getPatternInsights(swarmMail);

			expect(Array.isArray(insights)).toBe(true);
			// Structure check
			if (insights.length > 0) {
				expect(insights[0]).toHaveProperty("pattern");
				expect(insights[0]).toHaveProperty("frequency");
				expect(insights[0]).toHaveProperty("recommendation");
			}
		});

		test("includes anti-patterns from learning system", async () => {
			const insights = await getPatternInsights(swarmMail);

			// Should include anti-patterns if any exist
			expect(Array.isArray(insights)).toBe(true);
		});
	});

	describe("formatInsightsForPrompt", () => {
		test("formats strategy insights concisely", () => {
			const strategies: StrategyInsight[] = [
				{
					strategy: "file-based",
					successRate: 85,
					totalAttempts: 20,
					recommendation: "Preferred for this project",
				},
				{
					strategy: "feature-based",
					successRate: 60,
					totalAttempts: 10,
					recommendation: "Use with caution",
				},
			];

			const formatted = formatInsightsForPrompt({ strategies });

			expect(formatted).toContain("file-based");
			expect(formatted).toContain("85%");
			expect(formatted.length).toBeLessThan(500); // Context-efficient
		});

		test("formats file insights concisely", () => {
			const files: FileInsight[] = [
				{
					file: "src/auth.ts",
					failureCount: 3,
					lastFailure: "2025-12-25",
					gotchas: ["Watch for race conditions in token refresh"],
				},
			];

			const formatted = formatInsightsForPrompt({ files });

			expect(formatted).toContain("src/auth.ts");
			expect(formatted).toContain("race conditions");
			expect(formatted.length).toBeLessThan(300); // Per-file budget
		});

		test("formats pattern insights concisely", () => {
			const patterns: PatternInsight[] = [
				{
					pattern: "Missing error handling",
					frequency: 5,
					recommendation: "Add try/catch around async operations",
				},
			];

			const formatted = formatInsightsForPrompt({ patterns });

			expect(formatted).toContain("Missing error handling");
			expect(formatted).toContain("try/catch");
		});

		test("respects token budget", () => {
			// Create many insights
			const strategies: StrategyInsight[] = Array.from({ length: 10 }, (_, i) => ({
				strategy: `strategy-${i}`,
				successRate: 50 + i * 5,
				totalAttempts: 10,
				recommendation: `Recommendation for strategy ${i}`,
			}));

			const formatted = formatInsightsForPrompt({ strategies }, { maxTokens: 200 });

			// Should truncate to fit budget
			expect(formatted.length).toBeLessThan(1000); // ~200 tokens ≈ 800 chars
		});

		test("returns empty string when no insights", () => {
			const formatted = formatInsightsForPrompt({});
			expect(formatted).toBe("");
		});
	});
});
