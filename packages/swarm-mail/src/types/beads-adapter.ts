/**
 * BeadsAdapter - High-level interface for beads operations
 *
 * This interface abstracts all beads operations (CRUD, dependencies, labels,
 * comments, epic management) to enable different storage backends.
 *
 * ## Design Goals
 * - Database-agnostic (works with PGLite, SQLite, PostgreSQL, etc.)
 * - Parallel to SwarmMailAdapter pattern
 * - Event sourcing with projections for queries
 * - No implementation details leak through interface
 *
 * ## Layering
 * - DatabaseAdapter: Low-level SQL execution (shared with swarm-mail)
 * - BeadsAdapter: High-level beads operations (uses DatabaseAdapter internally)
 * - Plugin tools: Type-safe Zod-validated wrappers (use BeadsAdapter)
 *
 * ## Relationship to steveyegge/beads
 * This is a TypeScript rewrite of steveyegge/beads internal/storage/storage.go
 * interface, adapted for event sourcing and shared PGLite database.
 */

import type { DatabaseAdapter } from "./database.js";

// Re-export bead types from opencode-swarm-plugin for convenience
// (These are defined in packages/opencode-swarm-plugin/src/schemas/bead.ts)
export type BeadStatus = "open" | "in_progress" | "blocked" | "closed" | "tombstone";
export type BeadType = "bug" | "feature" | "task" | "epic" | "chore" | "message";
export type DependencyRelationship = 
  | "blocks" 
  | "related" 
  | "parent-child" 
  | "discovered-from" 
  | "replies-to" 
  | "relates-to" 
  | "duplicates" 
  | "supersedes";

// ============================================================================
// Core Bead Operations
// ============================================================================

/**
 * Full bead record (projection)
 */
export interface Bead {
  id: string;
  project_key: string;
  type: BeadType;
  status: BeadStatus;
  title: string;
  description: string | null;
  priority: number;
  parent_id: string | null;
  assignee: string | null;
  created_at: number;
  updated_at: number;
  closed_at: number | null;
  closed_reason: string | null;
  deleted_at: number | null;
  deleted_by: string | null;
  delete_reason: string | null;
  created_by: string | null;
}

/**
 * Bead creation options
 */
export interface CreateBeadOptions {
  title: string;
  description?: string;
  type: BeadType;
  priority?: number;
  parent_id?: string;
  assignee?: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Bead update options
 */
export interface UpdateBeadOptions {
  title?: string;
  description?: string;
  priority?: number;
  assignee?: string;
  updated_by?: string;
}

/**
 * Bead query filters
 */
export interface QueryBeadsOptions {
  status?: BeadStatus | BeadStatus[];
  type?: BeadType | BeadType[];
  parent_id?: string;
  assignee?: string;
  labels?: string[];
  limit?: number;
  offset?: number;
  /** Include deleted beads */
  include_deleted?: boolean;
  /** Include children for epics */
  include_children?: boolean;
}

export interface BeadAdapter {
  /**
   * Create a new bead
   * 
   * Emits: bead_created event
   */
  createBead(
    projectKey: string,
    options: CreateBeadOptions,
    projectPath?: string,
  ): Promise<Bead>;

  /**
   * Get a bead by ID
   */
  getBead(
    projectKey: string,
    beadId: string,
    projectPath?: string,
  ): Promise<Bead | null>;

  /**
   * Query beads with filters
   */
  queryBeads(
    projectKey: string,
    options?: QueryBeadsOptions,
    projectPath?: string,
  ): Promise<Bead[]>;

  /**
   * Update bead fields
   * 
   * Emits: bead_updated event
   */
  updateBead(
    projectKey: string,
    beadId: string,
    options: UpdateBeadOptions,
    projectPath?: string,
  ): Promise<Bead>;

  /**
   * Change bead status
   * 
   * Emits: bead_status_changed event
   */
  changeBeadStatus(
    projectKey: string,
    beadId: string,
    toStatus: BeadStatus,
    options?: {
      reason?: string;
      changed_by?: string;
    },
    projectPath?: string,
  ): Promise<Bead>;

  /**
   * Close a bead
   * 
   * Emits: bead_closed event
   */
  closeBead(
    projectKey: string,
    beadId: string,
    reason: string,
    options?: {
      closed_by?: string;
      files_touched?: string[];
      duration_ms?: number;
    },
    projectPath?: string,
  ): Promise<Bead>;

  /**
   * Reopen a closed bead
   * 
   * Emits: bead_reopened event
   */
  reopenBead(
    projectKey: string,
    beadId: string,
    options?: {
      reason?: string;
      reopened_by?: string;
    },
    projectPath?: string,
  ): Promise<Bead>;

  /**
   * Delete a bead (soft delete)
   * 
   * Emits: bead_deleted event
   */
  deleteBead(
    projectKey: string,
    beadId: string,
    options?: {
      reason?: string;
      deleted_by?: string;
    },
    projectPath?: string,
  ): Promise<void>;
}

// ============================================================================
// Dependency Operations
// ============================================================================

/**
 * Dependency between beads
 */
export interface BeadDependency {
  bead_id: string;
  depends_on_id: string;
  relationship: DependencyRelationship;
  created_at: number;
  created_by: string | null;
}

export interface DependencyAdapter {
  /**
   * Add a dependency between beads
   * 
   * Emits: bead_dependency_added event
   */
  addDependency(
    projectKey: string,
    beadId: string,
    dependsOnId: string,
    relationship: DependencyRelationship,
    options?: {
      reason?: string;
      added_by?: string;
    },
    projectPath?: string,
  ): Promise<BeadDependency>;

  /**
   * Remove a dependency
   * 
   * Emits: bead_dependency_removed event
   */
  removeDependency(
    projectKey: string,
    beadId: string,
    dependsOnId: string,
    relationship: DependencyRelationship,
    options?: {
      reason?: string;
      removed_by?: string;
    },
    projectPath?: string,
  ): Promise<void>;

  /**
   * Get all dependencies for a bead
   */
  getDependencies(
    projectKey: string,
    beadId: string,
    projectPath?: string,
  ): Promise<BeadDependency[]>;

  /**
   * Get beads that depend on this bead
   */
  getDependents(
    projectKey: string,
    beadId: string,
    projectPath?: string,
  ): Promise<BeadDependency[]>;

  /**
   * Check if a bead is blocked
   * 
   * Uses blocked_beads_cache for fast lookups
   */
  isBlocked(
    projectKey: string,
    beadId: string,
    projectPath?: string,
  ): Promise<boolean>;

  /**
   * Get all blockers for a bead
   */
  getBlockers(
    projectKey: string,
    beadId: string,
    projectPath?: string,
  ): Promise<string[]>;
}

// ============================================================================
// Label Operations
// ============================================================================

/**
 * Label on a bead
 */
export interface BeadLabel {
  bead_id: string;
  label: string;
  created_at: number;
}

export interface LabelAdapter {
  /**
   * Add a label to a bead
   * 
   * Emits: bead_label_added event
   */
  addLabel(
    projectKey: string,
    beadId: string,
    label: string,
    options?: {
      added_by?: string;
    },
    projectPath?: string,
  ): Promise<BeadLabel>;

  /**
   * Remove a label from a bead
   * 
   * Emits: bead_label_removed event
   */
  removeLabel(
    projectKey: string,
    beadId: string,
    label: string,
    options?: {
      removed_by?: string;
    },
    projectPath?: string,
  ): Promise<void>;

  /**
   * Get all labels for a bead
   */
  getLabels(
    projectKey: string,
    beadId: string,
    projectPath?: string,
  ): Promise<string[]>;

  /**
   * Get all beads with a label
   */
  getBeadsWithLabel(
    projectKey: string,
    label: string,
    projectPath?: string,
  ): Promise<Bead[]>;
}

// ============================================================================
// Comment Operations
// ============================================================================

/**
 * Comment on a bead
 */
export interface BeadComment {
  id: number;
  bead_id: string;
  author: string;
  body: string;
  parent_id: number | null;
  created_at: number;
  updated_at: number | null;
}

export interface CommentAdapter {
  /**
   * Add a comment to a bead
   * 
   * Emits: bead_comment_added event
   */
  addComment(
    projectKey: string,
    beadId: string,
    author: string,
    body: string,
    options?: {
      parent_id?: number;
      metadata?: Record<string, unknown>;
    },
    projectPath?: string,
  ): Promise<BeadComment>;

  /**
   * Update a comment
   * 
   * Emits: bead_comment_updated event
   */
  updateComment(
    projectKey: string,
    commentId: number,
    newBody: string,
    updated_by: string,
    projectPath?: string,
  ): Promise<BeadComment>;

  /**
   * Delete a comment
   * 
   * Emits: bead_comment_deleted event
   */
  deleteComment(
    projectKey: string,
    commentId: number,
    deleted_by: string,
    options?: {
      reason?: string;
    },
    projectPath?: string,
  ): Promise<void>;

  /**
   * Get all comments for a bead
   */
  getComments(
    projectKey: string,
    beadId: string,
    projectPath?: string,
  ): Promise<BeadComment[]>;
}

// ============================================================================
// Epic Operations
// ============================================================================

export interface EpicAdapter {
  /**
   * Add a child bead to an epic
   * 
   * Emits: bead_epic_child_added event
   */
  addChildToEpic(
    projectKey: string,
    epicId: string,
    childId: string,
    options?: {
      child_index?: number;
      added_by?: string;
    },
    projectPath?: string,
  ): Promise<void>;

  /**
   * Remove a child from an epic
   * 
   * Emits: bead_epic_child_removed event
   */
  removeChildFromEpic(
    projectKey: string,
    epicId: string,
    childId: string,
    options?: {
      reason?: string;
      removed_by?: string;
    },
    projectPath?: string,
  ): Promise<void>;

  /**
   * Get all children of an epic
   */
  getEpicChildren(
    projectKey: string,
    epicId: string,
    projectPath?: string,
  ): Promise<Bead[]>;

  /**
   * Check if epic is eligible for closure
   * 
   * Returns true if all children are closed
   */
  isEpicClosureEligible(
    projectKey: string,
    epicId: string,
    projectPath?: string,
  ): Promise<boolean>;
}

// ============================================================================
// Query Helpers
// ============================================================================

export interface QueryAdapter {
  /**
   * Get next ready bead (unblocked, highest priority)
   * 
   * Implements steveyegge/beads ready_issues view logic
   */
  getNextReadyBead(
    projectKey: string,
    projectPath?: string,
  ): Promise<Bead | null>;

  /**
   * Get all in-progress beads
   */
  getInProgressBeads(
    projectKey: string,
    projectPath?: string,
  ): Promise<Bead[]>;

  /**
   * Get all blocked beads with their blockers
   */
  getBlockedBeads(
    projectKey: string,
    projectPath?: string,
  ): Promise<Array<{ bead: Bead; blockers: string[] }>>;

  /**
   * Mark bead as dirty for JSONL export
   */
  markDirty(
    projectKey: string,
    beadId: string,
    projectPath?: string,
  ): Promise<void>;

  /**
   * Get all dirty beads (for incremental export)
   */
  getDirtyBeads(
    projectKey: string,
    projectPath?: string,
  ): Promise<string[]>;

  /**
   * Clear dirty flag after export
   */
  clearDirty(
    projectKey: string,
    beadId: string,
    projectPath?: string,
  ): Promise<void>;
}

// ============================================================================
// Schema Operations
// ============================================================================

export interface BeadsSchemaAdapter {
  /**
   * Run beads-specific migrations
   * 
   * Adds beads tables to shared PGLite database
   */
  runMigrations(projectPath?: string): Promise<void>;

  /**
   * Get beads statistics
   */
  getBeadsStats(projectPath?: string): Promise<{
    total_beads: number;
    open: number;
    in_progress: number;
    blocked: number;
    closed: number;
    by_type: Record<BeadType, number>;
  }>;

  /**
   * Rebuild blocked beads cache
   * 
   * Recalculates all blockers and updates blocked_beads_cache
   */
  rebuildBlockedCache(
    projectKey: string,
    projectPath?: string,
  ): Promise<void>;
}

// ============================================================================
// Combined BeadsAdapter Interface
// ============================================================================

/**
 * BeadsAdapter - Complete interface for beads operations
 * 
 * Combines all sub-adapters into a single interface.
 * Implementations provide a DatabaseAdapter and implement all operations.
 * 
 * This adapter shares the same PGLite database with SwarmMailAdapter.
 */
export interface BeadsAdapter
  extends BeadAdapter,
    DependencyAdapter,
    LabelAdapter,
    CommentAdapter,
    EpicAdapter,
    QueryAdapter,
    BeadsSchemaAdapter {
  /**
   * Get the underlying database adapter
   * 
   * Same instance as SwarmMailAdapter uses
   */
  getDatabase(projectPath?: string): Promise<DatabaseAdapter>;

  /**
   * Close the database connection
   * 
   * Note: This is shared with SwarmMailAdapter, so closing should be coordinated
   */
  close(projectPath?: string): Promise<void>;

  /**
   * Close all database connections
   */
  closeAll(): Promise<void>;
}

// ============================================================================
// Factory Function Type
// ============================================================================

/**
 * BeadsAdapterFactory - Function that creates a BeadsAdapter instance
 * 
 * Adapters export a factory function with this signature.
 * 
 * @example
 * ```typescript
 * import { createPGLiteBeadsAdapter } from '@opencode/swarm-mail/adapters/pglite-beads';
 * 
 * const adapter = createPGLiteBeadsAdapter({ path: './streams.db' });
 * ```
 */
export type BeadsAdapterFactory = (config: {
  path?: string;
  timeout?: number;
}) => BeadsAdapter;
