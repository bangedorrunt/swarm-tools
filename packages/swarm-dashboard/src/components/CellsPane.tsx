import { useState } from 'react';
import { CellNode, type Cell } from './CellNode';

/**
 * Mock cell data for development
 * TODO: Replace with real swarm-mail hive integration
 */
const MOCK_CELLS: Cell[] = [
  {
    id: 'epic-1',
    title: 'Swarm Dashboard',
    status: 'in_progress',
    priority: 0,
    issue_type: 'epic',
    children: [
      {
        id: 'task-1-1',
        title: 'Agent List View',
        status: 'closed',
        priority: 1,
        issue_type: 'task',
        parent_id: 'epic-1',
      },
      {
        id: 'task-1-2',
        title: 'Cells pane with tree view',
        status: 'in_progress',
        priority: 1,
        issue_type: 'task',
        parent_id: 'epic-1',
      },
      {
        id: 'task-1-3',
        title: 'Message Timeline',
        status: 'open',
        priority: 2,
        issue_type: 'task',
        parent_id: 'epic-1',
      },
    ],
  },
  {
    id: 'bug-1',
    title: 'Fix navigation state sync',
    status: 'blocked',
    priority: 0,
    issue_type: 'bug',
  },
  {
    id: 'epic-2',
    title: 'Observability Features',
    status: 'open',
    priority: 1,
    issue_type: 'epic',
    children: [
      {
        id: 'task-2-1',
        title: 'Add performance metrics',
        status: 'open',
        priority: 2,
        issue_type: 'task',
        parent_id: 'epic-2',
      },
      {
        id: 'task-2-2',
        title: 'Implement error tracking',
        status: 'open',
        priority: 1,
        issue_type: 'task',
        parent_id: 'epic-2',
      },
    ],
  },
  {
    id: 'chore-1',
    title: 'Update dependencies',
    status: 'open',
    priority: 3,
    issue_type: 'chore',
  },
];

interface CellsPaneProps {
  onCellSelect?: (cellId: string) => void;
}

/**
 * Cells pane component displaying epic/subtask hierarchy
 * 
 * Features:
 * - Tree view with expandable epics
 * - Status icons (○ open, ◐ in_progress, ● closed, ⊘ blocked)
 * - Priority badges (P0-P3)
 * - Cell selection with highlight
 * - Mock data for development (TODO: integrate with swarm-mail)
 * 
 * @param onCellSelect - Callback when a cell is selected
 */
export const CellsPane = ({ onCellSelect }: CellsPaneProps) => {
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  const handleSelect = (cellId: string) => {
    setSelectedCellId(cellId);
    if (onCellSelect) {
      onCellSelect(cellId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Cells
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {MOCK_CELLS.length} cells · {MOCK_CELLS.filter(c => c.status === 'open').length} open
        </p>
      </div>

      {/* Tree view */}
      <div className="flex-1 overflow-y-auto">
        {MOCK_CELLS.map((cell) => (
          <CellNode
            key={cell.id}
            cell={cell}
            isSelected={selectedCellId === cell.id}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Footer with legend */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span>○</span> Open
          </span>
          <span className="flex items-center gap-1">
            <span>◐</span> In Progress
          </span>
          <span className="flex items-center gap-1">
            <span>●</span> Closed
          </span>
          <span className="flex items-center gap-1">
            <span>⊘</span> Blocked
          </span>
        </div>
      </div>
    </div>
  );
};
