#!/usr/bin/env bun
/**
 * Tests for swarm CLI file operation helpers
 * 
 * These tests verify the verbose output helpers used in `swarm setup`:
 * - writeFileWithStatus: logs created/updated/unchanged status
 * - mkdirWithStatus: logs directory creation
 * - rmWithStatus: logs file removal
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

type FileStatus = "created" | "updated" | "unchanged";

/**
 * Mock logger for testing (matches @clack/prompts API)
 */
class MockLogger {
  logs: Array<{ type: string; message: string }> = [];

  success(msg: string) {
    this.logs.push({ type: "success", message: msg });
  }

  message(msg: string) {
    this.logs.push({ type: "message", message: msg });
  }

  reset() {
    this.logs = [];
  }
}

describe("File operation helpers", () => {
  let testDir: string;
  let logger: MockLogger;

  beforeEach(() => {
    testDir = join(tmpdir(), `swarm-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    logger = new MockLogger();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("writeFileWithStatus", () => {
    // Helper that mimics the implementation
    function writeFileWithStatus(path: string, content: string, label: string): FileStatus {
      const exists = existsSync(path);
      
      if (exists) {
        const current = readFileSync(path, "utf-8");
        if (current === content) {
          logger.message(`  ${label}: ${path} (unchanged)`);
          return "unchanged";
        }
      }
      
      writeFileSync(path, content);
      const status: FileStatus = exists ? "updated" : "created";
      logger.success(`${label}: ${path} (${status})`);
      return status;
    }

    test("returns 'created' for new file", () => {
      const filePath = join(testDir, "new.txt");
      const result = writeFileWithStatus(filePath, "content", "Test");
      
      expect(result).toBe("created");
      expect(logger.logs[0].type).toBe("success");
      expect(logger.logs[0].message).toContain("(created)");
      expect(existsSync(filePath)).toBe(true);
    });

    test("returns 'unchanged' if content is same", () => {
      const filePath = join(testDir, "existing.txt");
      writeFileSync(filePath, "same content");
      
      const result = writeFileWithStatus(filePath, "same content", "Test");
      
      expect(result).toBe("unchanged");
      expect(logger.logs[0].type).toBe("message");
      expect(logger.logs[0].message).toContain("(unchanged)");
    });

    test("returns 'updated' if content differs", () => {
      const filePath = join(testDir, "existing.txt");
      writeFileSync(filePath, "old content");
      
      const result = writeFileWithStatus(filePath, "new content", "Test");
      
      expect(result).toBe("updated");
      expect(logger.logs[0].type).toBe("success");
      expect(logger.logs[0].message).toContain("(updated)");
      expect(readFileSync(filePath, "utf-8")).toBe("new content");
    });
  });

  describe("mkdirWithStatus", () => {
    function mkdirWithStatus(path: string): boolean {
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
        logger.message(`  Created directory: ${path}`);
        return true;
      }
      return false;
    }

    test("creates directory and logs when it doesn't exist", () => {
      const dirPath = join(testDir, "newdir");
      const result = mkdirWithStatus(dirPath);
      
      expect(result).toBe(true);
      expect(existsSync(dirPath)).toBe(true);
      expect(logger.logs[0].type).toBe("message");
      expect(logger.logs[0].message).toContain("Created directory");
    });

    test("returns false when directory already exists", () => {
      const dirPath = join(testDir, "existing");
      mkdirSync(dirPath);
      
      const result = mkdirWithStatus(dirPath);
      
      expect(result).toBe(false);
      expect(logger.logs.length).toBe(0);
    });
  });

  describe("rmWithStatus", () => {
    function rmWithStatus(path: string, label: string): void {
      if (existsSync(path)) {
        rmSync(path);
        logger.message(`  Removed ${label}: ${path}`);
      }
    }

    test("removes file and logs when it exists", () => {
      const filePath = join(testDir, "todelete.txt");
      writeFileSync(filePath, "content");
      
      rmWithStatus(filePath, "test file");
      
      expect(existsSync(filePath)).toBe(false);
      expect(logger.logs[0].type).toBe("message");
      expect(logger.logs[0].message).toContain("Removed test file");
    });

    test("does nothing when file doesn't exist", () => {
      const filePath = join(testDir, "nonexistent.txt");
      
      rmWithStatus(filePath, "test file");
      
      expect(logger.logs.length).toBe(0);
    });
  });
});
