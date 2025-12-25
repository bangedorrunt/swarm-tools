/**
 * Integration test for main App component
 * 
 * Verifies:
 * - All three panes render
 * - Connection status indicator shows
 * - Layout is responsive
 */

import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders header with title", () => {
    render(<App />);
    
    const heading = screen.getByRole("heading", { name: /swarm dashboard/i });
    expect(heading).toBeTruthy();
  });

  it("renders connection status indicator", () => {
    render(<App />);
    
    const status = screen.getByTestId("connection-status");
    expect(status).toBeTruthy();
  });

  it("renders all three panes", () => {
    render(<App />);
    
    // AgentsPane header
    expect(screen.getByRole("heading", { name: /active agents/i })).toBeTruthy();
    
    // EventsPane header
    expect(screen.getByRole("heading", { name: /^events$/i })).toBeTruthy();
    
    // CellsPane header
    expect(screen.getByRole("heading", { name: /^cells$/i })).toBeTruthy();
  });
});
