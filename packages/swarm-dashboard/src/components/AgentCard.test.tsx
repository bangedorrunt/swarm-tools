/**
 * Tests for AgentCard component
 */

import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { AgentCard } from "./AgentCard";

describe("AgentCard", () => {
  test("renders agent name", () => {
    render(
      <AgentCard
        name="BlueLake"
        status="active"
        lastActiveTime={Date.now()}
      />
    );

    expect(screen.getByText("BlueLake")).toBeDefined();
  });

  test("shows active status with green indicator", () => {
    render(
      <AgentCard
        name="BlueLake"
        status="active"
        lastActiveTime={Date.now()}
      />
    );

    const indicator = screen.getByLabelText("status-indicator");
    expect(indicator.className).toContain("bg-green-500");
  });

  test("shows idle status with gray indicator", () => {
    render(
      <AgentCard
        name="BlueLake"
        status="idle"
        lastActiveTime={Date.now() - 10 * 60 * 1000}
      />
    );

    const indicator = screen.getByLabelText("status-indicator");
    expect(indicator.className).toContain("bg-gray-400");
  });

  test("displays current task when provided", () => {
    render(
      <AgentCard
        name="BlueLake"
        status="active"
        lastActiveTime={Date.now()}
        currentTask="Implementing auth service"
      />
    );

    expect(screen.getByText("Implementing auth service")).toBeDefined();
  });

  test("displays relative time for last active", () => {
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    render(
      <AgentCard
        name="BlueLake"
        status="active"
        lastActiveTime={twoMinutesAgo}
      />
    );

    expect(screen.getByText(/2 min ago/)).toBeDefined();
  });
});
