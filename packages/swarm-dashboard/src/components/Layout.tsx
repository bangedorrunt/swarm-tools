/**
 * Responsive grid layout container for swarm dashboard
 * 
 * Mobile: stacks panes vertically
 * Desktop: 3-column grid (agents | events | cells)
 */

import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

/**
 * Main layout grid - responsive 3-pane dashboard
 * 
 * Breakpoints:
 * - Mobile (<768px): vertical stack
 * - Tablet (768-1024px): 2-column, cells full width below
 * - Desktop (>1024px): 3-column grid
 */
export function Layout({ children }: LayoutProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 h-[calc(100vh-120px)]">
      {children}
    </div>
  );
}

interface PaneProps {
  children: ReactNode;
  className?: string;
}

/**
 * Individual pane container with consistent styling
 */
export function Pane({ children, className = "" }: PaneProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}
