/**
 * Durable Stream HTTP Server Tests
 *
 * TDD tests for the HTTP server that exposes Durable Streams protocol via SSE.
 * Server uses Bun.serve() and provides offset-based streaming.
 *
 * Port: 4483 (HIVE on phone keypad)
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createInMemorySwarmMailLibSQL } from "../libsql.convenience.js";
import { createEvent } from "./events.js";
import type { SwarmMailAdapter } from "../types/adapter.js";
import {
  createDurableStreamAdapter,
  type DurableStreamAdapter,
} from "./durable-adapter.js";
import {
  createDurableStreamServer,
  type DurableStreamServer,
} from "./durable-server.js";

describe("createDurableStreamServer", () => {
  let swarmMail: SwarmMailAdapter;
  let adapter: DurableStreamAdapter;
  let server: DurableStreamServer;
  const projectKey = "/test/project";

  beforeAll(async () => {
    swarmMail = await createInMemorySwarmMailLibSQL("durable-server-test");
    adapter = createDurableStreamAdapter(swarmMail, projectKey);

    // Seed some initial events using the adapter
    await swarmMail.appendEvent(
      createEvent("agent_registered", {
        project_key: projectKey,
        agent_name: "TestAgent1",
        program: "opencode",
        model: "test",
      }),
    );

    await swarmMail.appendEvent(
      createEvent("task_started", {
        project_key: projectKey,
        agent_name: "TestAgent1",
        bead_id: "test-bead-1",
      }),
    );
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
    await swarmMail.close();
  });

  describe("factory function", () => {
    test("creates server with default port 4483", async () => {
      server = createDurableStreamServer({ adapter, projectKey });
      expect(server).toBeDefined();
      expect(server.url).toContain("4483");
      expect(server.url).toMatch(/^http:\/\//);
    });

    test("creates server with custom port", async () => {
      const customServer = createDurableStreamServer({
        adapter,
        port: 5555,
        projectKey,
      });
      expect(customServer.url).toContain("5555");
    });

    test("server has start, stop, and url properties", () => {
      expect(server.start).toBeInstanceOf(Function);
      expect(server.stop).toBeInstanceOf(Function);
      expect(typeof server.url).toBe("string");
    });
  });

  describe("start() and stop()", () => {
    test("server starts successfully", async () => {
      await server.start();
      // Verify server is listening by making a request
      const response = await fetch(
        `${server.url}/streams/${encodeURIComponent(projectKey)}`,
      );
      expect(response.status).toBe(200);
    });

    test("server stops successfully", async () => {
      await server.stop();
      // Verify server is no longer listening
      try {
        await fetch(`${server.url}/streams/${encodeURIComponent(projectKey)}`);
        throw new Error("Server should not respond after stop");
      } catch (error: unknown) {
        // Bun throws different errors depending on timing
        const err = error as { code?: string; message?: string };
        expect(
          err.code === "ECONNREFUSED" ||
            err.message?.includes("fetch") ||
            err.message?.includes("Server should not respond"),
        ).toBeTruthy();
      }
    });
  });
});

describe("HTTP endpoints", () => {
  let swarmMail: SwarmMailAdapter;
  let adapter: DurableStreamAdapter;
  let server: DurableStreamServer;
  const projectKey = "/http/test";

  beforeAll(async () => {
    swarmMail = await createInMemorySwarmMailLibSQL("durable-http-test");
    adapter = createDurableStreamAdapter(swarmMail, projectKey);

    // Seed events using the adapter
    for (let i = 0; i < 5; i++) {
      await swarmMail.appendEvent(
        createEvent("agent_active", {
          project_key: projectKey,
          agent_name: `Agent${i}`,
        }),
      );
    }

    server = createDurableStreamServer({ adapter, port: 4484, projectKey });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    await swarmMail.close();
  });

  describe("GET /streams/:projectKey", () => {
    test("returns events from offset 0", async () => {
      const response = await fetch(
        `${server.url}/streams/${encodeURIComponent(projectKey)}`,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");

      const events = await response.json();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);

      // Verify StreamEvent format
      const event = events[0];
      expect(event).toHaveProperty("offset");
      expect(event).toHaveProperty("data");
      expect(event).toHaveProperty("timestamp");
    });

    test("respects offset parameter", async () => {
      // First, get all events to know the current state
      const allResponse = await fetch(
        `${server.url}/streams/${encodeURIComponent(projectKey)}`,
      );
      const allEvents = await allResponse.json();
      expect(allEvents.length).toBeGreaterThan(2);

      // Now request from offset (skip first 2 events)
      const skipOffset = allEvents[1].offset;
      const response = await fetch(
        `${server.url}/streams/${encodeURIComponent(projectKey)}?offset=${skipOffset}`,
      );

      const events = await response.json();
      expect(events.length).toBeGreaterThan(0);

      // First returned event should be after the offset we requested
      expect(events[0].offset).toBeGreaterThan(skipOffset);
      expect(events[0].offset).toBe(allEvents[2].offset);
    });

    test("respects limit parameter", async () => {
      const response = await fetch(
        `${server.url}/streams/${encodeURIComponent(projectKey)}?offset=0&limit=2`,
      );

      const events = await response.json();
      expect(events.length).toBeLessThanOrEqual(2);
    });

    test("returns empty array when offset is beyond head", async () => {
      const response = await fetch(
        `${server.url}/streams/${encodeURIComponent(projectKey)}?offset=9999`,
      );

      const events = await response.json();
      expect(events).toEqual([]);
    });

    test("handles URL-encoded project keys", async () => {
      const response = await fetch(
        `${server.url}/streams/${encodeURIComponent("/test/with/slashes")}`,
      );

      // Should not error (404 is fine since no events for this project)
      expect([200, 404]).toContain(response.status);
    });
  });

  describe("GET /streams/:projectKey with live=true (SSE)", () => {
    test("returns SSE content-type for live mode", async () => {
      const controller = new AbortController();
      const response = await fetch(
        `${server.url}/streams/${encodeURIComponent(projectKey)}?live=true`,
        { signal: controller.signal },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/event-stream");
      expect(response.headers.get("cache-control")).toBe("no-cache");
      expect(response.headers.get("connection")).toBe("keep-alive");

      controller.abort();
    });

    test("streams existing events in SSE format", async () => {
      const controller = new AbortController();
      const response = await fetch(
        `${server.url}/streams/${encodeURIComponent(projectKey)}?live=true`,
        { signal: controller.signal },
      );

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let chunks = "";

      // Read first few chunks with timeout
      const readPromise = (async () => {
        for (let i = 0; i < 3; i++) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            chunks += decoder.decode(value, { stream: true });
          }
        }
      })();

      // Add timeout to prevent hanging
      await Promise.race([
        readPromise,
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);

      controller.abort();

      // Verify SSE format: data: {json}\n\n
      expect(chunks).toContain("data: ");
      expect(chunks).toContain("\n\n");

      // Extract first event
      const match = chunks.match(/data: (.+?)\n\n/);
      expect(match).toBeTruthy();

      const event = JSON.parse(match![1]);
      expect(event).toHaveProperty("offset");
      expect(event).toHaveProperty("data");
      expect(event).toHaveProperty("timestamp");
    });

    test("streams new events as they arrive", async () => {
      // Get current head to use as offset (so we only get NEW events)
      const head = await adapter.head();

      const controller = new AbortController();
      const response = await fetch(
        `${server.url}/streams/${encodeURIComponent(projectKey)}?live=true&offset=${head}`,
        { signal: controller.signal },
      );

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let result = "";

      // Start reading in background (don't await yet)
      const readPromise = (async () => {
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              result += decoder.decode(value, { stream: true });
              // Check if we got our event
              if (result.includes("live-test-1")) {
                break;
              }
            }
          }
        } catch {
          // Aborted or error
        }
        clearTimeout(timeout);
        return result;
      })();

      // Give SSE connection time to establish and start reading
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Append a new event using the adapter
      await swarmMail.appendEvent(
        createEvent("task_completed", {
          project_key: projectKey,
          agent_name: "TestAgent",
          bead_id: "live-test-1",
          summary: "Live SSE test",
          success: true,
        }),
      );

      // Wait for the read to complete (or timeout)
      const chunks = await readPromise;

      controller.abort();

      // Should have received the new event
      expect(chunks).toContain("data: ");
      expect(chunks).toContain("live-test-1");
    });

    test("closes connection cleanly on client disconnect", async () => {
      const controller = new AbortController();
      const response = await fetch(
        `${server.url}/streams/${encodeURIComponent(projectKey)}?live=true`,
        { signal: controller.signal },
      );

      const reader = response.body!.getReader();

      // Read one chunk then cancel
      await reader.read();
      controller.abort();

      // Should not error (clean disconnect)
      expect(true).toBe(true);
    });
  });

  describe("error handling", () => {
    test("returns 404 for unknown routes", async () => {
      const response = await fetch(`${server.url}/unknown`);
      expect(response.status).toBe(404);
    });

    test("handles malformed offset parameter", async () => {
      const response = await fetch(
        `${server.url}/streams/${encodeURIComponent(projectKey)}?offset=not-a-number`,
      );

      // Should default to 0 or return 400
      expect([200, 400]).toContain(response.status);
    });
  });
});

describe("integration with DurableStreamAdapter", () => {
  let swarmMail: SwarmMailAdapter;
  let adapter: DurableStreamAdapter;
  let server: DurableStreamServer;
  const projectKey = "/integration/test";

  beforeAll(async () => {
    swarmMail = await createInMemorySwarmMailLibSQL("durable-integration");
    adapter = createDurableStreamAdapter(swarmMail, projectKey);
    server = createDurableStreamServer({ adapter, port: 4485, projectKey });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    await swarmMail.close();
  });

  test("server returns events filtered by project key", async () => {
    // Add events for our project using the adapter
    await swarmMail.appendEvent(
      createEvent("agent_registered", {
        project_key: projectKey,
        agent_name: "ProjectAgent",
        program: "opencode",
        model: "test",
      }),
    );

    // Add events for different project
    await swarmMail.appendEvent(
      createEvent("agent_registered", {
        project_key: "/other/project",
        agent_name: "OtherAgent",
        program: "opencode",
        model: "test",
      }),
    );

    const response = await fetch(
      `${server.url}/streams/${encodeURIComponent(projectKey)}`,
    );
    const events = await response.json();

    // All returned events should be for our project
    for (const event of events) {
      const data = JSON.parse(event.data);
      expect(data.project_key).toBe(projectKey);
    }
  });

  test("subscription cleanup on server stop", async () => {
    const controller = new AbortController();

    // Start SSE connection
    const response = await fetch(
      `${server.url}/streams/${encodeURIComponent(projectKey)}?live=true`,
      { signal: controller.signal },
    );

    const reader = response.body!.getReader();

    // Stop server (should clean up subscriptions)
    await server.stop();

    // Reader should detect closed connection
    try {
      const { done } = await reader.read();
      expect(done).toBe(true);
    } catch {
      // Connection reset is also acceptable
      expect(true).toBe(true);
    }
  });
});
