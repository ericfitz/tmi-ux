# E2E Phase 2: DFD Editor Full Coverage — Design Spec

**Date:** 2026-04-15
**Issue:** [#576](https://github.com/ericfitz/tmi-ux/issues/576)
**Dependencies:** Phase 0 (complete), Phase 1 (complete)
**Estimated tests:** ~45-52

## Overview

Complete E2E coverage for the DFD editor — the most technically complex component. Covers all controls/chrome around the graph, interaction workflows, cell property editing, complex diagram rendering, and visual regression with composite screenshot baselines.

## Technical Strategy

### Hybrid Interaction Model

- **DOM interaction** for testing user-facing workflows: clicking toolbar buttons, opening panels, mouse drag operations
- **`page.evaluate()` through application services** for test setup (quickly reaching a precondition state) and state assertions (verifying outcomes reliably)
- Graph mutation wrappers call through the existing `AppDfdOrchestrator` service — the same entry point the component uses — to avoid duplicating logic or bypassing validation, history tracking, and auto-save triggers
- Read-only structural queries (node positions, edge connections, embedding relationships) go through the X6 Graph instance

### E2E Bridge

The `DfdComponent` exposes `window.__e2e.dfd` when running with the `enableE2eTools` environment flag:

```typescript
(window as any).__e2e = {
  dfd: {
    orchestrator: this.appDfdOrchestrator,
    graph: this.appDfdOrchestrator.dfdInfrastructure.graphAdapter.graph
  }
};
```

- **Gated behind `environment.enableE2eTools`** — not present in dev/production builds
- **Cleanup in `ngOnDestroy()`** — removes the window property
- **No new imports required** — the component already injects `AppDfdOrchestrator` and has access to the graph through the orchestrator's infrastructure facade
- **No circular dependency risk** — the presentation layer already imports from the application layer; this change adds no new import paths

### Graph Render Stability

Before capturing screenshots or making assertions on graph state after loading:

1. Assert expected node/edge count via `page.evaluate()` on the X6 model
2. Add a short `waitForTimeout` for CSS transitions to settle

This is simpler and more deterministic than network-idle or DOM-stability polling since we know exactly what the seeded diagrams contain.

## Infrastructure Changes

### Environment Configuration

| File | Change |
|------|--------|
| `src/environments/environment.interface.ts` | Add `enableE2eTools?: boolean` |
| `src/environments/environment.e2e.ts` (new) | Extends dev config with `enableE2eTools: true` |
| `src/environments/environment.ts` | No change (`enableE2eTools` defaults to falsy) |
| `angular.json` | Add `e2e` build configuration with file replacement |
| `package.json` | Add `pnpm run dev:e2e` script |

### Data-testid Additions

The DFD component template currently has 5 `data-testid` attributes. Phase 2 adds ~25 more:

**Toolbar — Node creation:** `add-security-boundary-button`, `add-text-box-button` (actor, process, store already exist)

**Toolbar — Edit operations:** `cut-button`, `copy-button`, `paste-button`, `delete-button`

**Toolbar — History/View:** `undo-button`, `redo-button`, `zoom-to-fit-button`, `save-button`, `help-button`

**Toolbar — Panels:** `style-panel-toggle`, `icon-picker-toggle`

**Toolbar — Export:** `export-menu-button`, `export-svg-option`, `export-png-option`, `export-jpeg-option`

**Toolbar — Dev tools:** `show-graph-data-button`, `show-history-button`, `show-clipboard-button`

**Toolbar — Threats:** `manage-metadata-button`, `add-threat-button`, `manage-threats-button`

**Sub-components:** Style panel controls, icon picker panel controls, and dialog elements get `data-testid` attributes as needed during implementation.

### DfdEditorPage Expansion

The page object grows from 5 locators to include:

**Locators** for all `data-testid`'d controls listed above.

**Graph mutation methods** (thin `page.evaluate()` wrappers through `AppDfdOrchestrator`, used for test setup):

- `addNode(type)` → `orchestrator.addNode(type)`
- `deleteSelectedCells()` → `orchestrator.deleteSelectedCells()`
- `undo()` / `redo()` → `orchestrator.undo()` / `orchestrator.redo()`
- `selectAll()` / `clearSelection()` → `orchestrator.selectAll()` / `clearSelection()`

**Graph query methods** (thin `page.evaluate()` wrappers for assertions):

- `getState()` → `orchestrator.getState()`
- `canUndo()` / `canRedo()` → `orchestrator.canUndo()` / `canRedo()`
- `getSelectedCells()` → `orchestrator.getSelectedCells()`
- `getHistoryState()` → `orchestrator.getHistoryState()`

**X6 graph structural queries** (read-only, through `window.__e2e.dfd.graph`):

- `getNodeCount()`, `getEdgeCount()`
- `getNodes()`, `getEdges()`
- `getNodeById(id)` — returns position, type, attrs, parent
- `getEmbeddedChildren(parentId)`
- `waitForGraphSettled(expectedNodeCount, timeoutMs = 10000)` — polls X6 node count every 200ms until it matches expected, throws on timeout

### DiagramFlow Expansion

Add `openSeededDiagram(name: string)` for navigating to pre-seeded diagrams by name (currently only supports creating new diagrams).

## Test Organization

### Spec Files

**Workflows project** (`e2e/tests/workflows/`):

| File | Description | Tests |
|------|-------------|-------|
| `dfd-controls.spec.ts` | Toolbar buttons, panels, dialogs (all controls/chrome) | 8-10 |
| `dfd-interactions.spec.ts` | Node/edge lifecycle, embedding, multi-select, drag/resize | 8-10 |
| `dfd-history.spec.ts` | Undo/redo chains, history state verification | 4-5 |
| `dfd-autosave.spec.ts` | Auto-save trigger, reload persistence | 2-3 |
| `dfd-seeded-diagram.spec.ts` | Load seeded diagrams, verify structure, zoom | 3-4 |

**Field coverage project** (`e2e/tests/field-coverage/`):

| File | Description | Tests |
|------|-------------|-------|
| `dfd-node-properties.spec.ts` | Label, stroke, fill, opacity, label position | 6-8 |
| `dfd-edge-properties.spec.ts` | Edge label, vertices | 3-4 |
| `dfd-icon-properties.spec.ts` | Icon search, select, placement, remove | 3-4 |

**Visual regression project** (`e2e/tests/visual-regression/`):

| File | Description | Tests |
|------|-------------|-------|
| `dfd-visual-regression.spec.ts` | 6 composite plates x 4 themes | 6 |
| `dfd-translation-icons.spec.ts` | Translation key scan, icon rendering | 2 |

Field coverage tests use **targeted test cases** (explicit per-property tests), not the schema-driven `field-definitions.ts` approach used by other phases. This avoids introducing a translation layer that could itself be a source of test failures.

## Test Scenarios

### Workflow: Controls (`dfd-controls.spec.ts`)

Each control renders, is interactive, and produces the expected effect:

- **Node creation buttons (5):** Click each toolbar button → verify node count increments via orchestrator → verify correct node type
- **Style panel toggle:** Click → verify panel visible → click again → verify hidden
- **Icon picker toggle:** Click → verify panel visible → click again → verify hidden
- **Export menu:** Click → verify dropdown with SVG/PNG/JPEG options
- **Help dialog:** Open → verify content renders → close
- **Dev tool dialogs (3):** Graph data, history, clipboard — each opens and closes
- **Save button:** Click → verify no error (manual save trigger)

### Workflow: Interactions (`dfd-interactions.spec.ts`)

- **Node lifecycle (per type):** Add via toolbar → select by clicking in canvas → verify via `getSelectedCells()` → move via mouse drag → verify position changed → delete via toolbar → verify count decremented
- **Edge lifecycle:** Add two nodes (setup via orchestrator) → create edge via mouse on ports → verify edge exists → select → delete → verify removed
- **Embedding:** Add security boundary + process (setup) → drag process into boundary → verify `node.getParent()` returns boundary ID → verify embedding depth color → drag out → verify unembedded
- **Multi-select:** Add 3 nodes (setup) → select all → delete → verify count 0 → undo → verify count 3
- **Resize:** Add node → resize via drag handles → verify dimensions changed

### Workflow: History (`dfd-history.spec.ts`)

- **Undo/redo chain:** 3-4 operations → undo each → verify state at each step → redo each → verify final state
- **Undo/redo button state:** Verify undo disabled on fresh diagram → add node → verify enabled → undo → verify disabled. Same for redo.
- **History after save:** Perform operations → save → verify history intact

### Workflow: Auto-save (`dfd-autosave.spec.ts`)

- **Auto-save persistence:** Add nodes via toolbar → wait for auto-save to fire (Normal mode: 1s debounce; poll `orchestrator.getState()` for `hasUnsavedChanges === false` or use `waitForTimeout(3000)` as a conservative fallback) → reload page → navigate back → verify nodes present
- **Auto-save after style change:** Change fill color → wait for auto-save (same strategy) → reload → verify persisted

### Workflow: Seeded Diagram (`dfd-seeded-diagram.spec.ts`)

- **Complex DFD structure:** Navigate to seeded "Complex DFD" → wait for settled (10 nodes) → assert 10 nodes, 10 edges, correct types → assert "Validator" embedded in "API Gateway"
- **Simple DFD structure:** Navigate to seeded "Simple DFD" → assert 3 nodes, 2 edges, correct labels
- **Zoom operations:** On complex DFD → zoom to fit → verify viewport

### Field Coverage: Node Properties (`dfd-node-properties.spec.ts`)

Targeted tests, one per property:

- **Label editing:** Double-click node → edit label → verify updated in X6 model
- **Stroke color:** Select node → open style panel → change color → verify in X6
- **Fill color:** Same pattern
- **Fill opacity:** Same pattern with slider
- **Label position:** Select node → style panel → click position in 3x3 grid → verify label moved

### Field Coverage: Edge Properties (`dfd-edge-properties.spec.ts`)

- **Edge label:** Select edge → edit label → verify in model
- **Edge vertices:** Select edge → add vertex by dragging midpoint → verify vertex count

### Field Coverage: Icon Properties (`dfd-icon-properties.spec.ts`)

- **Icon search and select:** Select node → open icon picker → search → select icon → verify assigned
- **Icon placement:** Change placement via grid → verify updated
- **Icon remove:** Remove icon → verify cleared

### Visual Regression: Composite Plates (`dfd-visual-regression.spec.ts`)

Instead of one screenshot per visual state, **composite plates** batch multiple states into single screenshots. Each node in a known position demonstrates a different property/state. Failures are diagnosable by spatial position within the plate.

| Plate | Contents |
|-------|----------|
| **1 — Node types** | One node of each type (actor, process, store, security boundary, text box) arranged left-to-right |
| **2 — Style variations** | Several processes in a grid, each with a different property (custom stroke, custom fill, adjusted opacity, label top-left, label bottom-right, etc.) |
| **3 — Edge variations** | Small network with different edge states: labeled, unlabeled, multi-vertex (bent) |
| **4 — Embedding** | Security boundary containing nodes at different depths, plus non-embedded nodes outside |
| **5 — Seeded Complex DFD** | The 10-node/10-edge seeded diagram loaded as-is |
| **6 — After operations** | Start from known state, perform move + resize, screenshot result |

Each plate captured in all 4 theme modes (light, dark, light-colorblind, dark-colorblind) via `takeThemeScreenshots()`. Total: ~24 baseline images.

Setup for each plate uses orchestrator methods to build the visual state, then `waitForGraphSettled()` before capture.

### Visual Regression: Translation/Icons (`dfd-translation-icons.spec.ts`)

- Navigate to DFD editor → `assertNoMissingTranslations()` → `assertIconsRendered()`
- Repeat with style panel open and icon picker open

## Implementation Sequencing

### Sub-phase 2A: Infrastructure (prerequisite)

1. Environment flag + `environment.e2e.ts` + build config + `dev:e2e` script
2. E2E bridge in `DfdComponent` (window exposure, gated, cleanup)
3. `data-testid` attributes on `dfd.component.html` and sub-component templates
4. `DfdEditorPage` expansion (locators + graph wrappers)
5. `DiagramFlow` expansion (`openSeededDiagram`)

### Sub-phase 2B: Workflow Tests (depends on 2A)

6. `dfd-controls.spec.ts`
7. `dfd-interactions.spec.ts`
8. `dfd-history.spec.ts`
9. `dfd-autosave.spec.ts`
10. `dfd-seeded-diagram.spec.ts`

### Sub-phase 2C: Field Coverage Tests (depends on 2A, parallel with 2B)

11. `dfd-node-properties.spec.ts`
12. `dfd-edge-properties.spec.ts`
13. `dfd-icon-properties.spec.ts`

### Sub-phase 2D: Visual Regression (depends on 2A, parallel with 2B/2C)

14. `dfd-visual-regression.spec.ts`
15. `dfd-translation-icons.spec.ts`

## Acceptance Criteria

- [ ] All DFD toolbar controls (including dev tools) tested and functional
- [ ] Node and edge CRUD lifecycle complete for all 5 node types
- [ ] Embedding and z-order verified (embed, unembed, depth colors)
- [ ] Undo/redo chain works correctly across multiple operation types
- [ ] Auto-save persists through page reload
- [ ] Complex seeded diagram (10 nodes, 10 edges, embedding) renders correctly
- [ ] Style panel properties (stroke, fill, opacity, label position) verified per node type
- [ ] Icon picker search, select, placement, and remove verified
- [ ] ~6 composite screenshot plates baselined in 4 theme modes
- [ ] No missing translation keys on DFD pages
- [ ] All Material icons render correctly on DFD pages
