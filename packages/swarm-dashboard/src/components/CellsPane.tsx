import { useState, useMemo } from 'react';
import { CellNode, type Cell } from './CellNode';
import type {
  AgentEvent,
  CellCreatedEvent,
  CellUpdatedEvent,
  CellStatusChangedEvent,
  CellClosedEvent,
} from '../lib/types';

interface CellsPaneProps {
  /** Events array from useSwarmSocket hook */
  events: AgentEvent[];
  onCellSelect?: (cellId: string) => void;
}

/**
 * Cells pane component displaying epic/subtask hierarchy
 * 
 * Features:
 * - Tree view with expandable epics
 * - Status icons (○ open, ◐ in_progress, ● closed, ⊘ blocked)
 * - Priority badges (P0-P3) with Catppuccin colors
 * - Cell selection with highlight
 * - Real-time updates via WebSocket events
 */
export const CellsPane = ({ events, onCellSelect }: CellsPaneProps) => {
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  // Derive cell state from events
  const cells = useMemo<Cell[]>(() => {
    console.log("[CellsPane] Computing cells from", events.length, "events");
    
    // Helper to filter events by type
    const getEventsByType = <T extends AgentEvent["type"]>(type: T) => {
      return events.filter((e) => e.type === type) as Extract<
        AgentEvent,
        { type: T }
      >[];
    };

    // Get cell events
    const cellCreated = getEventsByType("cell_created") as CellCreatedEvent[];
    const cellUpdated = getEventsByType("cell_updated") as CellUpdatedEvent[];
    const cellStatusChanged = getEventsByType("cell_status_changed") as CellStatusChangedEvent[];
    const cellClosed = getEventsByType("cell_closed") as CellClosedEvent[];

    // Build map of cell_id -> cell state
    const cellMap = new Map<string, Cell>();

    // Initialize from cell_created events
    for (const event of cellCreated) {
      cellMap.set(event.cell_id, {
        id: event.cell_id,
        title: event.title,
        status: 'open',
        priority: event.priority ?? 3,
        issue_type: (event.issue_type as Cell['issue_type']) ?? 'task',
        parent_id: event.parent_id ?? undefined,
      });
    }

    // Apply updates
    for (const event of cellUpdated) {
      const cell = cellMap.get(event.cell_id);
      if (cell) {
        if (event.title !== undefined) cell.title = event.title;
        if (event.description !== undefined) {
          // Note: Cell type doesn't have description field
        }
        if (event.priority !== undefined) cell.priority = event.priority;
        if (event.status !== undefined) {
          cell.status = event.status as Cell['status'];
        }
      }
    }

    // Apply status changes
    for (const event of cellStatusChanged) {
      const cell = cellMap.get(event.cell_id);
      if (cell) {
        cell.status = event.to_status as Cell['status'];
      }
    }

    // Apply closed events
    for (const event of cellClosed) {
      const cell = cellMap.get(event.cell_id);
      if (cell) {
        cell.status = 'closed';
      }
    }

    // Build tree structure: parent cells with children
    const rootCells: Cell[] = [];
    const childrenMap = new Map<string, Cell[]>();

    // Group children by parent_id
    for (const cell of cellMap.values()) {
      if (cell.parent_id) {
        const siblings = childrenMap.get(cell.parent_id) || [];
        siblings.push(cell);
        childrenMap.set(cell.parent_id, siblings);
      } else {
        rootCells.push(cell);
      }
    }

    // Attach children to parents
    for (const cell of cellMap.values()) {
      const children = childrenMap.get(cell.id);
      if (children) {
        cell.children = children.sort((a, b) => a.priority - b.priority);
      }
    }

    // Sort root cells by priority
    return rootCells.sort((a, b) => a.priority - b.priority);
  }, [events]);

  const handleSelect = (cellId: string) => {
    setSelectedCellId(cellId);
    if (onCellSelect) {
      onCellSelect(cellId);
    }
  };

  const openCellsCount = cells.reduce((count, cell) => {
    const cellCount = cell.status === 'open' ? 1 : 0;
    const childrenCount = cell.children?.filter(c => c.status === 'open').length || 0;
    return count + cellCount + childrenCount;
  }, 0);

  const totalCellsCount = cells.reduce((count, cell) => {
    return count + 1 + (cell.children?.length || 0);
  }, 0);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--background1)',
        borderRadius: '0.5rem',
        border: '1px solid var(--surface0, #313244)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--surface0, #313244)',
        }}
      >
        <h2
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--foreground0)',
            margin: 0,
          }}
        >
          Cells
        </h2>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--foreground2)',
            margin: '0.25rem 0 0',
          }}
        >
          {totalCellsCount} cells · {openCellsCount} open
        </p>
      </div>

      {/* Tree view */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {cells.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--foreground2)',
            }}
          >
            No cells found
          </div>
        ) : (
          <div style={{ padding: '0.25rem 0' }}>
            {cells.map((cell) => (
              <CellNode
                key={cell.id}
                cell={cell}
                isSelected={selectedCellId === cell.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with legend */}
      <div
        style={{
          padding: '0.5rem 1rem',
          borderTop: '1px solid var(--surface0, #313244)',
          backgroundColor: 'var(--surface0, #313244)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '0.75rem',
            color: 'var(--foreground2)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color: 'var(--foreground1)' }}>○</span> Open
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color: 'var(--yellow, #f9e2af)' }}>◐</span> In Progress
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color: 'var(--green, #a6e3a1)' }}>●</span> Closed
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ color: 'var(--red, #f38ba8)' }}>⊘</span> Blocked
          </span>
        </div>
      </div>
    </div>
  );
};
