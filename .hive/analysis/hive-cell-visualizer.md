# Architecture Decision Record: Hive/Cell Visualizer

**Date:** 2025-12-23  
**Status:** Draft (Pending Review)  
**Cell:** opencode-swarm-monorepo-lf2p4u-mjfzlbckh37  
**Authors:** Coordinator

---

## Context

### The Problem

The swarm plugin tracks work items (cells) in `.hive/issues.jsonl` - a git-synced event log. While this format is excellent for:
- Git-native versioning and merging
- Agent-readable structured data
- Distributed coordination

It's **terrible for human comprehension**. When you have 50+ cells across multiple epics with complex dependency chains, understanding "what's happening" requires:

1. Parsing JSONL mentally
2. Reconstructing dependency graphs in your head
3. Tracking status across multiple dimensions (open/blocked/in_progress/closed)
4. Understanding agent assignments and file reservations

**Current state:** Humans must use `hive_query` tool calls and piece together state from JSON output. This is cognitively expensive and error-prone.

### Inspiration: beads_viewer

[beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) by Jeffrey Emanuel is a TUI for Steve Yegge's Beads issue tracker. Key features:

- **Graph-first philosophy**: Treats the dependency graph as the primary view, not a list
- **9 graph-theoretic metrics**: PageRank, Betweenness, HITS, Critical Path, Eigenvector, Degree, Density, Cycles, Topo Sort
- **Multiple views**: List, Kanban, Graph, Insights Dashboard, History
- **Robot protocol**: JSON output for AI agent consumption
- **Static site export**: Self-contained HTML for sharing

beads_viewer is written in Go with Bubble Tea TUI framework. It's comprehensive (10,000+ lines) but tightly coupled to the Beads data format.

### Our Constraints

1. **Data format**: We use `.hive/issues.jsonl` (cells), not `.beads/beads.jsonl` (beads)
2. **Ecosystem**: We're TypeScript/Bun, not Go
3. **Integration**: Must work with swarm plugin tools, not standalone
4. **Scope**: We need visualization, not a full issue tracker replacement

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **A. Fork beads_viewer** | Full-featured, battle-tested | Go codebase, different data format, maintenance burden |
| **B. Build TUI from scratch** | TypeScript native, tight integration | Significant effort, reinventing wheel |
| **C. Web-based visualizer** | Rich interactivity, easy sharing | Requires server or static build, context switch |
| **D. Static HTML export** | Zero dependencies, shareable, works offline | Limited interactivity, build step required |
| **E. Hybrid: CLI + Static HTML** | Best of both worlds | More code to maintain |

---

## Decision

### Build a Hybrid Visualizer (Option E)

We will build a **two-part visualizer**:

1. **CLI Query Tool** (`swarm viz`): Quick terminal-based status views
2. **Static HTML Export** (`swarm viz --export`): Self-contained interactive visualization

This mirrors beads_viewer's architecture but scoped to our needs and ecosystem.

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HIVE VISUALIZER                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐ │
│  │  Data Layer     │    │  Analysis       │    │  Presentation       │ │
│  │  ─────────────  │    │  ─────────────  │    │  ─────────────────  │ │
│  │                 │    │                 │    │                     │ │
│  │  issues.jsonl   │───▶│  Graph Builder  │───▶│  CLI Views          │ │
│  │  HiveAdapter    │    │  Metrics Engine │    │  - Status table     │ │
│  │                 │    │  - PageRank     │    │  - Dependency tree  │ │
│  │                 │    │  - Betweenness  │    │  - Kanban ASCII     │ │
│  │                 │    │  - Critical Path│    │                     │ │
│  │                 │    │  - Cycles       │    │  HTML Export        │ │
│  │                 │    │                 │    │  - Force graph      │ │
│  │                 │    │                 │    │  - Detail pane      │ │
│  │                 │    │                 │    │  - Filters          │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Model Mapping

Our cells map to beads_viewer concepts:

| Hive Concept | beads_viewer Equivalent | Notes |
|--------------|-------------------------|-------|
| Cell | Bead/Issue | Work item |
| `parent_id` | `blocked_by` | Dependency relationship |
| `status` | `status` | open, in_progress, blocked, closed |
| `issue_type` | `type` | bug, feature, task, epic, chore |
| `priority` | `priority` | 0-3 (we use 0=highest, they use 0=lowest) |
| Epic + subtasks | Parent-child hierarchy | Our `parent_id` creates tree structure |

### Graph Metrics (Subset of beads_viewer)

We'll implement a **focused subset** of beads_viewer's 9 metrics:

| Metric | Priority | Rationale |
|--------|----------|-----------|
| **Dependency Graph** | P0 | Core visualization - who blocks whom |
| **Status Distribution** | P0 | How many open/blocked/done |
| **Critical Path** | P1 | What's the longest chain to completion |
| **Cycle Detection** | P1 | Circular dependencies are bugs |
| **Blocked Cascade** | P1 | What gets unblocked if X completes |
| PageRank | P2 | Nice-to-have for large projects |
| Betweenness | P2 | Nice-to-have for bottleneck detection |
| HITS | P3 | Probably overkill for our scale |

### CLI Views

#### 1. Status Table (Default)

```
$ swarm viz

┌─────────────────────────────────────────────────────────────────────────┐
│  🐝 HIVE STATUS                                    opencode-swarm-plugin │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SUMMARY                                                                │
│  ───────                                                                │
│  Total: 47 cells    Open: 12    In Progress: 3    Blocked: 2    Done: 30│
│                                                                         │
│  ACTIVE EPICS                                                           │
│  ────────────                                                           │
│  🎯 bd-abc123 "LLM-Powered Compaction"           [████████░░] 80%       │
│     ├─ ✅ bd-abc123.1 ADR: Architecture                                 │
│     ├─ ✅ bd-abc123.2 Implementation                                    │
│     └─ 🚧 bd-abc123.3 Tests                      ← IN PROGRESS          │
│                                                                         │
│  🎯 bd-def456 "Hive Visualizer"                  [░░░░░░░░░░] 0%        │
│     └─ 📋 bd-def456.1 ADR (this document)        ← IN PROGRESS          │
│                                                                         │
│  READY TO START (unblocked, highest priority)                           │
│  ─────────────────────────────────────────────                          │
│  1. bd-xyz789 "Fix memory leak in daemon"        P0  bug                │
│  2. bd-xyz790 "Add retry logic to sync"          P1  task               │
│                                                                         │
│  BLOCKED (waiting on dependencies)                                      │
│  ─────────────────────────────────                                      │
│  ⛔ bd-xyz791 "OAuth integration"                                       │
│     └─ Blocked by: bd-xyz792 "Auth service refactor"                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2. Dependency Tree

```
$ swarm viz --tree

bd-abc123 "LLM-Powered Compaction" (epic)
├── bd-abc123.1 "ADR: Architecture" ✅
├── bd-abc123.2 "Implementation" ✅
│   └── depends on: bd-abc123.1
└── bd-abc123.3 "Tests" 🚧
    └── depends on: bd-abc123.2

bd-def456 "Hive Visualizer" (epic)
└── bd-def456.1 "ADR" 🚧
```

#### 3. Kanban ASCII

```
$ swarm viz --kanban

┌─────────────┬─────────────┬─────────────┬─────────────┐
│    OPEN     │ IN PROGRESS │   BLOCKED   │   CLOSED    │
│    (12)     │     (3)     │     (2)     │    (30)     │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ bd-xyz789   │ bd-abc123.3 │ bd-xyz791   │ bd-abc123.1 │
│ P0 bug      │ Tests       │ OAuth       │ ADR         │
│             │             │             │             │
│ bd-xyz790   │ bd-def456.1 │ bd-xyz793   │ bd-abc123.2 │
│ P1 task     │ ADR         │ Metrics     │ Impl        │
│             │             │             │             │
│ ...+10      │ bd-ghi789   │             │ ...+28      │
│             │ Refactor    │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### HTML Export

The static HTML export will be a **self-contained single file** with:

1. **Force-directed graph** (D3.js or force-graph)
2. **Detail pane** (click node to see full cell info)
3. **Filters** (status, type, priority)
4. **Search** (fuzzy match on title/description)
5. **Embedded data** (JSON blob in `<script>` tag)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Hive Visualizer - opencode-swarm-plugin</title>
  <style>/* Tailwind or inline CSS */</style>
</head>
<body>
  <div id="app">
    <!-- Alpine.js reactive UI -->
    <div id="graph"></div>
    <div id="detail-pane"></div>
    <div id="filters"></div>
  </div>
  
  <script>
    // Embedded cell data
    const HIVE_DATA = {
      cells: [...],
      edges: [...],
      metrics: {...},
      generated_at: "2025-12-23T..."
    };
  </script>
  
  <script src="https://unpkg.com/force-graph"></script>
  <script src="https://unpkg.com/alpinejs"></script>
  <script>/* Visualization logic */</script>
</body>
</html>
```

**File size target:** < 500KB including all dependencies (inline CDN scripts).

---

## Implementation Plan

### Phase 1: Data Layer (Week 1)

**Goal:** Extract and transform hive data for visualization.

```typescript
// packages/opencode-swarm-plugin/src/viz/data.ts

interface VizCell {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "blocked" | "closed";
  type: "bug" | "feature" | "task" | "epic" | "chore";
  priority: number;
  parent_id?: string;
  dependencies: string[];  // Cells this blocks
  dependents: string[];    // Cells blocked by this
  created_at: string;
  updated_at: string;
  closed_at?: string;
  closed_reason?: string;
}

interface VizGraph {
  cells: VizCell[];
  edges: Array<{ from: string; to: string; type: "blocks" | "parent" }>;
  metrics: {
    total: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    critical_path: string[];
    cycles: string[][];
  };
  generated_at: string;
}

async function buildVizGraph(projectPath: string): Promise<VizGraph>;
```

**Tasks:**
- [ ] Create `VizCell` and `VizGraph` types
- [ ] Implement `buildVizGraph()` using HiveAdapter
- [ ] Add dependency resolution (parent_id → blocks relationship)
- [ ] Implement cycle detection (Tarjan's SCC)
- [ ] Implement critical path calculation

### Phase 2: CLI Views (Week 2)

**Goal:** Terminal-based visualization with ASCII art.

```typescript
// packages/opencode-swarm-plugin/src/viz/cli.ts

async function renderStatusTable(graph: VizGraph): Promise<string>;
async function renderDependencyTree(graph: VizGraph): Promise<string>;
async function renderKanban(graph: VizGraph): Promise<string>;
```

**Tasks:**
- [ ] Implement status table with box-drawing characters
- [ ] Implement dependency tree with indentation
- [ ] Implement kanban columns
- [ ] Add color coding (chalk/picocolors)
- [ ] Add `swarm viz` CLI command

### Phase 3: HTML Export (Week 3)

**Goal:** Self-contained interactive HTML visualization.

```typescript
// packages/opencode-swarm-plugin/src/viz/html.ts

async function exportHtml(graph: VizGraph, outputPath: string): Promise<void>;
```

**Tasks:**
- [ ] Create HTML template with embedded CSS
- [ ] Integrate force-graph library
- [ ] Implement detail pane
- [ ] Add filter controls
- [ ] Add search functionality
- [ ] Inline all dependencies (no external requests)
- [ ] Add `swarm viz --export` CLI command

### Phase 4: Integration (Week 4)

**Goal:** Polish and integrate with existing tools.

**Tasks:**
- [ ] Add `viz_status` tool to plugin
- [ ] Add `viz_export` tool to plugin
- [ ] Write tests for graph building
- [ ] Write tests for cycle detection
- [ ] Documentation
- [ ] Changeset and release

---

## Technical Decisions

### 1. No TUI Framework (Bubble Tea Alternative)

**Decision:** Use simple string rendering, not a full TUI framework.

**Rationale:**
- Bubble Tea is Go-only; TypeScript alternatives (ink, blessed) are heavy
- Our CLI views are read-only status displays, not interactive
- Simple `console.log` with ANSI codes is sufficient
- Keeps bundle size small

**Tradeoff:**
- No interactive navigation (j/k keys, etc.)
- Acceptable because we have HTML export for rich interaction

### 2. Force-Graph over D3 Raw

**Decision:** Use [force-graph](https://github.com/vasturiano/force-graph) library.

**Rationale:**
- Built on D3 but with simpler API
- Handles zoom, pan, node dragging out of the box
- WebGL rendering for performance
- Same library beads_viewer uses

**Tradeoff:**
- ~150KB minified
- Acceptable for HTML export (not bundled in CLI)

### 3. Alpine.js for Reactivity

**Decision:** Use Alpine.js for HTML export UI.

**Rationale:**
- Tiny (~15KB)
- No build step required
- Declarative syntax in HTML attributes
- Perfect for "sprinkle of interactivity" use case

**Alternative considered:** Vanilla JS
- More code, harder to maintain
- Alpine.js is worth the 15KB

### 4. Inline Everything

**Decision:** HTML export is a single file with no external dependencies.

**Rationale:**
- Works offline
- No CORS issues
- Easy to share (email, Slack, etc.)
- No server required

**Implementation:**
- Inline CSS (Tailwind or custom)
- Inline JS libraries via CDN snapshot or bundled
- Inline data as JSON in `<script>` tag

### 5. Subset of Metrics

**Decision:** Implement only essential metrics, not all 9 from beads_viewer.

**Rationale:**
- Our projects are smaller (typically <100 cells)
- PageRank/Betweenness/HITS are overkill
- Focus on actionable insights: cycles, critical path, blocked cascade

**Metrics included:**
- Dependency graph (core)
- Status distribution
- Critical path
- Cycle detection
- Blocked cascade (what unblocks if X completes)

**Metrics deferred:**
- PageRank (P2)
- Betweenness centrality (P2)
- HITS hub/authority (P3)
- Eigenvector centrality (P3)

---

## Data Format

### Input: issues.jsonl

```jsonl
{"id":"bd-abc123","title":"Epic Title","status":"open","issue_type":"epic","priority":1,"created_at":"2025-12-23T..."}
{"id":"bd-abc123.1","title":"Subtask 1","status":"closed","issue_type":"task","priority":2,"parent_id":"bd-abc123","created_at":"2025-12-23T...","closed_at":"2025-12-23T...","closed_reason":"Done"}
```

### Output: VizGraph JSON

```json
{
  "cells": [
    {
      "id": "bd-abc123",
      "title": "Epic Title",
      "status": "open",
      "type": "epic",
      "priority": 1,
      "dependencies": ["bd-abc123.1", "bd-abc123.2"],
      "dependents": [],
      "created_at": "2025-12-23T..."
    }
  ],
  "edges": [
    { "from": "bd-abc123.1", "to": "bd-abc123", "type": "parent" }
  ],
  "metrics": {
    "total": 47,
    "by_status": { "open": 12, "in_progress": 3, "blocked": 2, "closed": 30 },
    "by_type": { "epic": 5, "task": 30, "bug": 10, "feature": 2 },
    "critical_path": ["bd-abc123", "bd-abc123.2", "bd-abc123.3"],
    "cycles": []
  },
  "generated_at": "2025-12-23T16:00:00.000Z"
}
```

---

## User Experience

### CLI Workflow

```bash
# Quick status check
$ swarm viz

# Dependency tree view
$ swarm viz --tree

# Kanban view
$ swarm viz --kanban

# Export to HTML
$ swarm viz --export ./hive-status.html

# Open in browser
$ open ./hive-status.html
```

### HTML Export Workflow

1. Run `swarm viz --export ./status.html`
2. Open in browser
3. Explore:
   - Click nodes to see details
   - Filter by status/type/priority
   - Search for specific cells
   - Zoom/pan the graph
4. Share the HTML file (email, Slack, etc.)

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Force-graph performance with large graphs | Low | Medium | Limit to 500 nodes, warn user |
| HTML file size too large | Medium | Low | Minify, compress, lazy-load |
| Cycle detection slow | Low | Low | Use efficient Tarjan's algorithm |
| CLI output ugly in non-Unicode terminals | Medium | Low | Detect and fall back to ASCII |
| Scope creep (adding more metrics) | High | Medium | Strict P0/P1/P2 prioritization |

---

## Success Criteria

### MVP (Phase 1-3)

- [ ] `swarm viz` shows status table with epic progress
- [ ] `swarm viz --tree` shows dependency tree
- [ ] `swarm viz --export` generates working HTML file
- [ ] HTML export has force-directed graph
- [ ] HTML export has detail pane on node click
- [ ] Cycle detection works and displays warnings
- [ ] Critical path is highlighted

### Nice-to-Have (Phase 4+)

- [ ] Kanban ASCII view
- [ ] Search in HTML export
- [ ] Filter by label
- [ ] Agent assignment visualization
- [ ] File reservation overlay
- [ ] Time-travel (compare to git revision)

---

## Alternatives Considered

### A. Fork beads_viewer

**Pros:**
- Full-featured, battle-tested
- Beautiful TUI with Bubble Tea
- All 9 metrics implemented

**Cons:**
- Go codebase (we're TypeScript)
- Different data format (beads.jsonl vs issues.jsonl)
- Maintenance burden of a fork
- Overkill for our needs

**Verdict:** Too much friction. Better to build focused tool.

### B. Use beads_viewer with adapter

**Pros:**
- No code to write
- Get all features for free

**Cons:**
- Requires Go installation
- Need to convert issues.jsonl → beads.jsonl
- Two-way sync complexity
- User must learn two tools

**Verdict:** Integration complexity not worth it.

### C. Web app with server

**Pros:**
- Rich interactivity
- Real-time updates possible
- Could integrate with swarm mail

**Cons:**
- Requires running server
- Context switch from terminal
- More infrastructure to maintain

**Verdict:** Overkill. Static HTML is sufficient.

### D. VS Code extension

**Pros:**
- Integrated into editor
- Rich UI capabilities
- Could show inline in sidebar

**Cons:**
- VS Code only (excludes Vim, Emacs, etc.)
- Extension development overhead
- Separate codebase to maintain

**Verdict:** Too narrow. CLI + HTML is more universal.

---

## References

- [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) - Inspiration and reference implementation
- [force-graph](https://github.com/vasturiano/force-graph) - Graph visualization library
- [Alpine.js](https://alpinejs.dev/) - Lightweight reactivity
- [Tarjan's SCC Algorithm](https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm) - Cycle detection
- [Critical Path Method](https://en.wikipedia.org/wiki/Critical_path_method) - Longest path calculation

---

## Appendix: beads_viewer Feature Comparison

| Feature | beads_viewer | Our Visualizer | Notes |
|---------|--------------|----------------|-------|
| List view | ✅ | ✅ (status table) | Simplified |
| Kanban board | ✅ | ✅ (ASCII) | Simplified |
| Graph view | ✅ | ✅ (HTML export) | Force-graph |
| Insights dashboard | ✅ | ❌ | Deferred |
| History view | ✅ | ❌ | Deferred |
| PageRank | ✅ | ❌ | P2 |
| Betweenness | ✅ | ❌ | P2 |
| HITS | ✅ | ❌ | P3 |
| Critical path | ✅ | ✅ | Core |
| Cycle detection | ✅ | ✅ | Core |
| Robot JSON output | ✅ | ✅ | Via existing tools |
| Static HTML export | ✅ | ✅ | Core |
| Time-travel | ✅ | ❌ | P3 |
| Fuzzy search | ✅ | ✅ (HTML) | HTML only |
| Live reload | ✅ | ❌ | Not needed |
| Vim keybindings | ✅ | ❌ | No TUI |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-23 | Coordinator | Initial draft |
