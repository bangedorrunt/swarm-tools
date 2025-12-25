/**
 * Events pane with live event stream
 * 
 * Features:
 * - Scrollable list with newest at bottom
 * - Auto-scroll when at bottom, pause when user scrolls up
 * - Color-coded event type badges
 * - Filter by event type
 * - Event count display
 */

import { useEffect, useRef, useState } from "react";
import { EventRow } from "./EventRow";
import type { AgentEvent } from "../lib/types";

interface EventsPaneProps {
  /** Events to display */
  events: AgentEvent[];
  /** Initial event type filter (optional) */
  initialFilter?: AgentEvent["type"] | "all";
}

type EventFilter = AgentEvent["type"] | "all";

// Event category filters
const FILTER_CATEGORIES = [
  { label: "All", value: "all" as const },
  { label: "Agent", prefix: "agent_" },
  { label: "Task", prefix: "task_" },
  { label: "Message", prefix: "message_" },
  { label: "File", prefix: "file_" },
] as const;

export function EventsPane({ events, initialFilter = "all" }: EventsPaneProps) {
  const [filter, setFilter] = useState<EventFilter>(initialFilter);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);

  // Filter events based on selected filter
  const filteredEvents = events.filter((event) => {
    if (filter === "all") return true;
    
    // Check if it's a specific event type
    if (filter === event.type) return true;
    
    // Check if it's a category prefix
    const category = FILTER_CATEGORIES.find(c => "prefix" in c && filter.startsWith(c.prefix as string));
    if (category && "prefix" in category) {
      return event.type.startsWith(category.prefix);
    }
    
    return false;
  });

  // Auto-scroll to bottom when new events arrive (if auto-scroll enabled)
  useEffect(() => {
    if (!isAutoScroll || !scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    container.scrollTop = container.scrollHeight;
  }, [filteredEvents.length, isAutoScroll]);

  // Detect manual scroll and disable auto-scroll
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Check if user is scrolling up
    if (scrollTop < lastScrollTop.current) {
      setIsAutoScroll(false);
    }
    
    // Re-enable auto-scroll if user scrolled to bottom
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setIsAutoScroll(true);
    }
    
    lastScrollTop.current = scrollTop;
  };

  // Get event count for current filter
  const eventCount = filteredEvents.length;

  return (
    <div className="flex flex-col h-full bg-white shadow rounded-lg">
      {/* Header with filters */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Events</h2>
          <span className="text-sm text-gray-500">
            {eventCount} {eventCount === 1 ? "event" : "events"}
          </span>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              filter === "all"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("agent_registered")}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              filter === "agent_registered" || filter === "agent_active"
                ? "bg-blue-600 text-white"
                : "bg-blue-100 text-blue-800 hover:bg-blue-200"
            }`}
          >
            Agent
          </button>
          <button
            type="button"
            onClick={() => setFilter("task_started")}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              filter.startsWith("task_")
                ? "bg-green-600 text-white"
                : "bg-green-100 text-green-800 hover:bg-green-200"
            }`}
          >
            Task
          </button>
          <button
            type="button"
            onClick={() => setFilter("message_sent")}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              filter.startsWith("message_")
                ? "bg-purple-600 text-white"
                : "bg-purple-100 text-purple-800 hover:bg-purple-200"
            }`}
          >
            Message
          </button>
          <button
            type="button"
            onClick={() => setFilter("file_reserved")}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              filter.startsWith("file_")
                ? "bg-gray-600 text-white"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200"
            }`}
          >
            File
          </button>
        </div>
      </div>

      {/* Scrollable event list */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>No events yet</p>
          </div>
        ) : (
          <div>
            {filteredEvents.map((event, index) => (
              <EventRow
                key={event.id || `${event.type}-${event.timestamp}-${index}`}
                event={event}
              />
            ))}
          </div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!isAutoScroll && filteredEvents.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={() => {
              setIsAutoScroll(true);
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop =
                  scrollContainerRef.current.scrollHeight;
              }
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            ↓ Auto-scroll paused. Click to resume.
          </button>
        </div>
      )}
    </div>
  );
}
