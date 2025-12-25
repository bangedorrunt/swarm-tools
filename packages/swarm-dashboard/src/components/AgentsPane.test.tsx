/**
 * Tests for AgentsPane component
 */

import { describe, expect, test, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import { AgentsPane } from "./AgentsPane";

// Mock the useSwarmEvents hook
const mockUseSwarmEvents = mock(() => ({
  state: "connected" as const,
  events: [],
  getEventsByType: mock(() => []),
}));

mock.module("../hooks", () => ({
  useSwarmEvents: mockUseSwarmEvents,
}));

describe("AgentsPane", () => {
  test("renders empty state when no agents", () => {
    mockUseSwarmEvents.mockReturnValue({
      state: "connected",
      events: [],
      getEventsByType: mock(() => []),
    });

    render(<AgentsPane />);

    expect(screen.getByText(/no active agents/i)).toBeDefined();
  });

  test("renders agent cards for registered agents", () => {
    mockUseSwarmEvents.mockReturnValue({
      state: "connected",
      events: [
        {
          type: "agent_registered",
          agent_name: "BlueLake",
          timestamp: Date.now(),
          project_key: "/test",
        },
        {
          type: "agent_registered",
          agent_name: "RedMountain",
          timestamp: Date.now(),
          project_key: "/test",
        },
      ],
      getEventsByType: mock((type: string) => {
        if (type === "agent_registered") {
          return [
            {
              type: "agent_registered",
              agent_name: "BlueLake",
              timestamp: Date.now(),
              project_key: "/test",
            },
            {
              type: "agent_registered",
              agent_name: "RedMountain",
              timestamp: Date.now(),
              project_key: "/test",
            },
          ];
        }
        return [];
      }),
    });

    render(<AgentsPane />);

    expect(screen.getByText("BlueLake")).toBeDefined();
    expect(screen.getByText("RedMountain")).toBeDefined();
  });

  test("shows connection state indicator", () => {
    mockUseSwarmEvents.mockReturnValue({
      state: "connecting",
      events: [],
      getEventsByType: mock(() => []),
    });

    render(<AgentsPane />);

    expect(screen.getByText(/connecting/i)).toBeDefined();
  });
});
