/**
 * Individual event row component
 * 
 * Displays a single event with timestamp, type badge, agent name, and summary
 */

import type { AgentEvent } from "../lib/types";

interface EventRowProps {
  event: AgentEvent;
}

/**
 * Format timestamp as HH:MM:SS
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Get badge color classes based on event type
 */
function getBadgeColor(eventType: AgentEvent["type"]): string {
  const colorMap: Record<string, string> = {
    // Agent events - Blue
    agent_registered: "bg-blue-100 text-blue-800",
    agent_active: "bg-blue-100 text-blue-800",

    // Task completion - Green
    task_completed: "bg-green-100 text-green-800",

    // Task start/progress - Yellow
    task_started: "bg-yellow-100 text-yellow-800",
    task_progress: "bg-yellow-100 text-yellow-800",

    // Task blocked - Red
    task_blocked: "bg-red-100 text-red-800",

    // Messages - Purple
    message_sent: "bg-purple-100 text-purple-800",
    message_read: "bg-purple-100 text-purple-800",
    message_acked: "bg-purple-100 text-purple-800",

    // File operations - Gray
    file_reserved: "bg-gray-100 text-gray-800",
    file_released: "bg-gray-100 text-gray-800",

    // Decomposition/outcomes - Cyan
    decomposition_generated: "bg-cyan-100 text-cyan-800",
    subtask_outcome: "bg-cyan-100 text-cyan-800",

    // Checkpoints - Indigo
    swarm_checkpointed: "bg-indigo-100 text-indigo-800",
    swarm_recovered: "bg-indigo-100 text-indigo-800",

    // Human feedback - Amber
    human_feedback: "bg-amber-100 text-amber-800",
  };

  return colorMap[eventType] || "bg-gray-100 text-gray-800";
}

/**
 * Extract display summary from event
 */
function getEventSummary(event: AgentEvent): string {
  switch (event.type) {
    case "agent_registered":
      return event.model ? `Registered with ${event.model}` : "Registered";
    case "agent_active":
      return "Agent active";
    case "task_started":
      return `Started ${event.bead_id}`;
    case "task_progress":
      return event.message || `Progress: ${event.progress_percent}%`;
    case "task_completed":
      return event.summary || "Task completed";
    case "task_blocked":
      return event.reason || "Task blocked";
    case "message_sent":
      return `To ${event.to_agents.join(", ")}: ${event.subject}`;
    case "message_read":
      return `Read message ${event.message_id}`;
    case "message_acked":
      return `Acknowledged message ${event.message_id}`;
    case "file_reserved":
      return `Reserved ${event.paths.length} file(s)`;
    case "file_released":
      return event.paths
        ? `Released ${event.paths.length} file(s)`
        : "Released reservations";
    case "decomposition_generated":
      return `Decomposed: ${event.epic_title} (${event.subtasks.length} subtasks)`;
    case "subtask_outcome":
      return `Subtask ${event.success ? "succeeded" : "failed"} (${event.duration_ms}ms)`;
    case "human_feedback":
      return event.accepted ? "Feedback: Accepted" : "Feedback: Rejected";
    case "swarm_checkpointed":
      return `Checkpoint created for ${event.bead_id}`;
    case "swarm_recovered":
      return `Recovered ${event.bead_id}`;
    default: {
      // Exhaustive check - should never reach here if all event types are handled
      const _exhaustive: never = event;
      return String(_exhaustive);
    }
  }
}

/**
 * Get agent name from event (different events have different field names)
 */
function getAgentName(event: AgentEvent): string | undefined {
  // Use type guard for agent_name
  if ("agent_name" in event && typeof event.agent_name === "string") {
    return event.agent_name;
  }
  // Use type guard for from_agent
  if ("from_agent" in event && typeof event.from_agent === "string") {
    return event.from_agent;
  }
  return undefined;
}

export function EventRow({ event }: EventRowProps) {
  const agentName = getAgentName(event);
  const summary = getEventSummary(event);

  return (
    <div className="flex items-start gap-3 px-4 py-2 border-b border-gray-100 hover:bg-gray-50 text-sm">
      {/* Timestamp */}
      <div className="text-xs text-gray-500 font-mono w-20 flex-shrink-0 pt-0.5">
        {formatTime(event.timestamp)}
      </div>

      {/* Event type badge */}
      <div className="flex-shrink-0">
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded ${getBadgeColor(event.type)}`}
        >
          {event.type}
        </span>
      </div>

      {/* Agent name */}
      {agentName && (
        <div className="text-gray-700 font-medium w-32 flex-shrink-0 truncate pt-0.5">
          {agentName}
        </div>
      )}

      {/* Summary */}
      <div className="text-gray-600 flex-1 pt-0.5 break-words">{summary}</div>
    </div>
  );
}
