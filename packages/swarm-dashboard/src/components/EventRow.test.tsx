/**
 * Tests for EventRow component
 */
import { describe, test, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { EventRow } from "./EventRow";
import type { AgentEvent } from "../lib/types";

describe("EventRow", () => {
  test("renders agent_registered event with correct badge color", () => {
    const event: AgentEvent = {
      type: "agent_registered",
      project_key: "/test/project",
      timestamp: Date.now(),
      agent_name: "TestAgent",
      model: "claude-3-5-sonnet",
    };

    render(<EventRow event={event} />);

    // Should show type badge
    expect(screen.getByText("agent_registered")).toBeDefined();

    // Should show agent name
    expect(screen.getByText("TestAgent")).toBeDefined();

    // Should show timestamp
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeDefined();
  });

  test("renders task_completed event with green badge", () => {
    const event: AgentEvent = {
      type: "task_completed",
      project_key: "/test/project",
      timestamp: Date.now(),
      agent_name: "WorkerAgent",
      bead_id: "bd-123",
      summary: "Completed auth flow",
      success: true,
    };

    render(<EventRow event={event} />);

    const badge = screen.getByText("task_completed");
    expect(badge.className).toContain("bg-green-100");
    expect(badge.className).toContain("text-green-800");
  });

  test("renders task_blocked event with red badge", () => {
    const event: AgentEvent = {
      type: "task_blocked",
      project_key: "/test/project",
      timestamp: Date.now(),
      agent_name: "WorkerAgent",
      bead_id: "bd-123",
      reason: "Waiting for dependency",
    };

    render(<EventRow event={event} />);

    const badge = screen.getByText("task_blocked");
    expect(badge.className).toContain("bg-red-100");
    expect(badge.className).toContain("text-red-800");
  });

  test("renders file_reserved event with gray badge", () => {
    const event: AgentEvent = {
      type: "file_reserved",
      project_key: "/test/project",
      timestamp: Date.now(),
      agent_name: "WorkerAgent",
      paths: ["src/auth.ts"],
      expires_at: Date.now() + 3600000,
    };

    render(<EventRow event={event} />);

    const badge = screen.getByText("file_reserved");
    expect(badge.className).toContain("bg-gray-100");
    expect(badge.className).toContain("text-gray-800");
  });

  test("renders message_sent event with purple badge", () => {
    const event: AgentEvent = {
      type: "message_sent",
      project_key: "/test/project",
      timestamp: Date.now(),
      from_agent: "Coordinator",
      to_agents: ["Worker1"],
      subject: "Status update",
      body: "All good",
    };

    render(<EventRow event={event} />);

    const badge = screen.getByText("message_sent");
    expect(badge.className).toContain("bg-purple-100");
    expect(badge.className).toContain("text-purple-800");
  });

  test("renders task_started event with yellow badge", () => {
    const event: AgentEvent = {
      type: "task_started",
      project_key: "/test/project",
      timestamp: Date.now(),
      agent_name: "WorkerAgent",
      bead_id: "bd-123",
    };

    render(<EventRow event={event} />);

    const badge = screen.getByText("task_started");
    expect(badge.className).toContain("bg-yellow-100");
    expect(badge.className).toContain("text-yellow-800");
  });

  test("formats timestamp as HH:MM:SS", () => {
    const timestamp = new Date("2024-12-25T14:30:45Z").getTime();
    const event: AgentEvent = {
      type: "agent_active",
      project_key: "/test/project",
      timestamp,
      agent_name: "TestAgent",
    };

    render(<EventRow event={event} />);

    // Timestamp should be formatted
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeDefined();
  });

  test("shows summary for events with summary field", () => {
    const event: AgentEvent = {
      type: "task_completed",
      project_key: "/test/project",
      timestamp: Date.now(),
      agent_name: "WorkerAgent",
      bead_id: "bd-123",
      summary: "Auth flow implemented",
      success: true,
    };

    render(<EventRow event={event} />);

    expect(screen.getByText("Auth flow implemented")).toBeDefined();
  });

  test("shows reason for blocked events", () => {
    const event: AgentEvent = {
      type: "task_blocked",
      project_key: "/test/project",
      timestamp: Date.now(),
      agent_name: "WorkerAgent",
      bead_id: "bd-123",
      reason: "Waiting for database schema",
    };

    render(<EventRow event={event} />);

    expect(screen.getByText("Waiting for database schema")).toBeDefined();
  });
});
