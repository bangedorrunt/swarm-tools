/**
 * Tests for EventsPane component
 */
import { describe, test, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { EventsPane } from "./EventsPane";
import type { AgentEvent } from "../lib/types";

// Mock useSwarmEvents hook
const mockEvents: AgentEvent[] = [
  {
    type: "agent_registered",
    project_key: "/test/project",
    timestamp: Date.now() - 10000,
    agent_name: "TestAgent",
    model: "claude-3-5-sonnet",
  },
  {
    type: "task_started",
    project_key: "/test/project",
    timestamp: Date.now() - 5000,
    agent_name: "WorkerAgent",
    bead_id: "bd-123",
  },
  {
    type: "task_completed",
    project_key: "/test/project",
    timestamp: Date.now(),
    agent_name: "WorkerAgent",
    bead_id: "bd-123",
    summary: "Auth flow implemented",
    success: true,
  },
];

describe("EventsPane", () => {
  test("renders events in scrollable list", () => {
    render(<EventsPane events={mockEvents} />);

    // Should show all events
    expect(screen.getByText("agent_registered")).toBeDefined();
    expect(screen.getByText("task_started")).toBeDefined();
    expect(screen.getByText("task_completed")).toBeDefined();
  });

  test("renders empty state when no events", () => {
    render(<EventsPane events={[]} />);

    expect(screen.getByText(/no events/i)).toBeDefined();
  });

  test("shows event type filter buttons", () => {
    render(<EventsPane events={mockEvents} />);

    // Should show filter buttons (use exact match to avoid matching event content)
    expect(screen.getByRole("button", { name: "All" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Agent" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Task" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Message" })).toBeDefined();
    expect(screen.getByRole("button", { name: "File" })).toBeDefined();
  });

  test("filters events by type", () => {
    render(<EventsPane events={mockEvents} initialFilter="task_started" />);

    // Should only show task_started events
    expect(screen.queryByText("task_started")).toBeDefined();
    expect(screen.queryByText("agent_registered")).toBeNull();
  });

  test("shows event count", () => {
    render(<EventsPane events={mockEvents} />);

    // Should show count
    expect(screen.getByText(/3 events?/i)).toBeDefined();
  });
});
