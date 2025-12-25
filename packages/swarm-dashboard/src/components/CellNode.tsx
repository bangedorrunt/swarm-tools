import { useState } from 'react';

/**
 * Cell data structure matching swarm-mail hive schema
 */
export interface Cell {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'blocked' | 'closed';
  priority: number;
  issue_type: 'epic' | 'task' | 'bug' | 'chore' | 'feature';
  parent_id?: string;
  children?: Cell[];
}

interface CellNodeProps {
  cell: Cell;
  depth?: number;
  isSelected?: boolean;
  onSelect?: (cellId: string) => void;
}

/**
 * Status icon mapping with Unicode symbols
 */
const STATUS_ICONS: Record<Cell['status'], string> = {
  open: '○',
  in_progress: '◐',
  closed: '●',
  blocked: '⊘',
};

/**
 * Priority badge component
 */
const PriorityBadge = ({ priority }: { priority: number }) => {
  const colors: Record<number, string> = {
    0: 'bg-red-500 text-white',
    1: 'bg-orange-500 text-white',
    2: 'bg-yellow-500 text-black',
    3: 'bg-gray-400 text-black',
  };

  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors[priority] || colors[3]}`}>
      P{priority}
    </span>
  );
};

/**
 * Recursive tree node component for displaying cells
 * 
 * Features:
 * - Expandable epics with chevron indicator
 * - Status icons (○ open, ◐ in_progress, ● closed, ⊘ blocked)
 * - Priority badges (P0-P3)
 * - Click to select with highlight
 * - Indentation based on tree depth
 */
export const CellNode = ({ cell, depth = 0, isSelected = false, onSelect }: CellNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = cell.children && cell.children.length > 0;
  const isEpic = cell.issue_type === 'epic';

  const handleClick = () => {
    if (onSelect) {
      onSelect(cell.id);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="select-none">
      {/* Node row */}
      <button
        type="button"
        className={`
          w-full flex items-center gap-2 px-3 py-2 cursor-pointer
          hover:bg-gray-100 dark:hover:bg-gray-800
          ${isSelected ? 'bg-blue-100 dark:bg-blue-900' : ''}
          transition-colors text-left border-0
        `}
        style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
        onClick={handleClick}
      >
        {/* Expand/collapse chevron for epics */}
        {isEpic && hasChildren ? (
          <button
            type="button"
            onClick={handleToggle}
            className="w-4 h-4 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
              ▶
            </span>
          </button>
        ) : (
          <span className="w-4" /> // Spacer for alignment
        )}

        {/* Status icon */}
        <span className="text-lg leading-none" title={cell.status}>
          {STATUS_ICONS[cell.status]}
        </span>

        {/* Cell title */}
        <span className={`flex-1 text-sm ${isEpic ? 'font-semibold' : 'font-normal'}`}>
          {cell.title}
        </span>

        {/* Priority badge */}
        <PriorityBadge priority={cell.priority} />

        {/* Issue type badge */}
        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">
          {cell.issue_type}
        </span>
      </button>

      {/* Children (recursive) */}
      {isEpic && hasChildren && isExpanded && cell.children && (
        <div>
          {cell.children.map((child) => (
            <CellNode
              key={child.id}
              cell={child}
              depth={depth + 1}
              isSelected={isSelected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};
