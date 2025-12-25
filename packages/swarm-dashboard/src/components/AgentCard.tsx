/**
 * Individual agent card component
 * 
 * Displays agent name, status indicator, current task, and last active time
 */

interface AgentCardProps {
  name: string;
  status: "active" | "idle";
  lastActiveTime: number;
  currentTask?: string;
}

/**
 * Format relative time (e.g., "2 min ago", "1 hour ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} min ago`;
  return "just now";
}

export function AgentCard({
  name,
  status,
  lastActiveTime,
  currentTask,
}: AgentCardProps) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        {/* Agent name and status indicator */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
          <div className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                status === "active" ? "bg-green-500" : "bg-gray-400"
              }`}
              data-testid="status-indicator"
              title={status === "active" ? "Active" : "Idle"}
            />
            <span className="text-sm text-gray-500 capitalize">{status}</span>
          </div>
        </div>

        {/* Current task */}
        {currentTask && (
          <div className="mb-3">
            <p className="text-sm text-gray-600 line-clamp-2">{currentTask}</p>
          </div>
        )}

        {/* Last active time */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Last active:</span>
          <span className="font-medium">{formatRelativeTime(lastActiveTime)}</span>
        </div>
      </div>
    </div>
  );
}
