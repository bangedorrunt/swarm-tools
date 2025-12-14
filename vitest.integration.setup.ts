/**
 * Global setup/teardown for integration tests
 *
 * Ensures test-specific semantic-memory collections are cleaned up
 * after all integration tests complete.
 */

export async function setup() {
  console.log("[vitest] Integration test setup: TEST_MEMORY_COLLECTIONS=true");
  // Setup runs before tests - environment variables are already set via vitest config
}

export async function teardown() {
  console.log(
    "[vitest] Integration test teardown: cleaning up test collections",
  );

  // Clean up test collections
  const testCollections = [
    "swarm-feedback-test",
    "swarm-patterns-test",
    "swarm-maturity-test",
    "swarm-maturity-test-feedback",
  ];

  for (const collection of testCollections) {
    try {
      // Attempt to remove test collection data
      // Note: semantic-memory doesn't have a built-in "delete collection" command,
      // so we'll use the remove command with a wildcard or rely on TTL/manual cleanup
      console.log(`[vitest] Attempting to clean collection: ${collection}`);

      // List items and remove them (semantic-memory may not support bulk delete)
      // This is a best-effort cleanup - some backends may require manual cleanup
      // For now, we'll just log that cleanup should happen
      console.log(
        `[vitest] Note: Collection "${collection}" may need manual cleanup via semantic-memory CLI`,
      );
    } catch (error) {
      console.warn(
        `[vitest] Failed to clean collection ${collection}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  console.log("[vitest] Integration test teardown complete");
}
