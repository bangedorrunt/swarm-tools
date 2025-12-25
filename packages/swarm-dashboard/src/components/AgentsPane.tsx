/**
 * Agents pane component
 * 
 * Shows active agents with real-time updates via SSE
 */

import { useMemo } from "react";
import { AgentCard } from "./AgentCard";
import { useSwarmEvents } from "../hooks";
import type {
  AgentActiveEvent,
  AgentRegisteredEvent,
  TaskCompletedEvent,
  TaskProgressEvent,
  TaskStartedEvent,
} from "../lib/types";

interface Agent {
  name: string;
  status: "active" | "idle";
  lastActiveTime: number;
  currentTask?: string;
}

/**
 * Agent is considered active if last seen within 5 minutes
 */
const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;

export function AgentsPane() {
  const { state, events, getEventsByType } = useSwarmEvents({
    url: "http://localhost:3001/events",
  });

  // Derive agent state from events
  const agents = useMemo<Agent[]>(() => {
    // Get all agent registrations
    const registrations = getEventsByType("agent_registered") as AgentRegisteredEvent[];
    const activeEvents = getEventsByType("agent_active") as AgentActiveEvent[];
    const taskStarted = getEventsByType("task_started") as TaskStartedEvent[];
    const taskProgress = getEventsByType("task_progress") as TaskProgressEvent[];
    const taskCompleted = getEventsByType("task_completed") as TaskCompletedEvent[];

    // Build map of agent name -> agent state
    const agentMap = new Map<string, Agent>();

    // Initialize from registrations
    for (const event of registrations) {
      agentMap.set(event.agent_name, {
        name: event.agent_name,
        status: "idle",
        lastActiveTime: event.timestamp,
        currentTask: event.task_description,
      });
    }

    // Update with active pings
    for (const event of activeEvents) {
      const agent = agentMap.get(event.agent_name);
      if (agent) {
        agent.lastActiveTime = Math.max(agent.lastActiveTime, event.timestamp);
      }
    }

    // Update with task events
    for (const event of taskStarted) {
      const agent = agentMap.get(event.agent_name);
      if (agent) {
        agent.lastActiveTime = Math.max(agent.lastActiveTime, event.timestamp);
        agent.currentTask = event.bead_id; // Use bead_id as task identifier
      }
    }

    for (const event of taskProgress) {
      const agent = agentMap.get(event.agent_name);
      if (agent) {
        agent.lastActiveTime = Math.max(agent.lastActiveTime, event.timestamp);
        if (event.message) {
          agent.currentTask = event.message;
        }
      }
    }

    for (const event of taskCompleted) {
      const agent = agentMap.get(event.agent_name);
      if (agent) {
        agent.lastActiveTime = Math.max(agent.lastActiveTime, event.timestamp);
        agent.currentTask = undefined; // Clear task on completion
      }
    }

    // Determine active vs idle based on last activity
    const now = Date.now();
    for (const agent of agentMap.values()) {
      agent.status = now - agent.lastActiveTime < ACTIVE_THRESHOLD_MS ? "active" : "idle";
    }

    // Sort by status (active first), then by last active time
    return Array.from(agentMap.values()).sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "active" ? -1 : 1;
      }
      return b.lastActiveTime - a.lastActiveTime;
    });
  }, [events, getEventsByType]);

  return (
    <div className="space-y-4">
      {/* Header with connection state */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Active Agents</h2>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              state === "connected"
                ? "bg-green-500"
                : state === "connecting" || state === "reconnecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
            }`}
            title={state}
          />
          <span className="text-sm text-gray-500 capitalize">{state}</span>
        </div>
      </div>

      {/* Agent cards grid */}
      {agents.length === 0 ? (
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-8 sm:p-10 text-center">
            <p className="text-gray-500">No active agents</p>
            <p className="text-sm text-gray-400 mt-1">
              Agents will appear here when they register
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.name}
              name={agent.name}
              status={agent.status}
              lastActiveTime={agent.lastActiveTime}
              currentTask={agent.currentTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}
