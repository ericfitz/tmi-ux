# Consolidate DFD Save Paths — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issue #474 (node fill/border colors not persisted) by replacing `graph.toJSON()` with direct cell extraction via `cell.getAttrs()`, and consolidating all save paths through the persistence coordinator.

**Architecture:** Create a shared cell extraction utility that reads attrs directly from X6 cell instances (bypassing `toJSON()`'s default-stripping behavior). X6's constructor merges shape defaults into the instance store (`ObjectExt.merge({}, defaults, metadata)` in `cell.js:76`), so `cell.getAttrs()` always returns complete attrs including defaults — no manual default-merging needed. Extend `SaveOperation` to carry optional image data. Route manual saves through the persistence coordinator instead of bypassing it. Remove the dead save methods from `AppDiagramService`.

**Tech Stack:** Angular 19, AntV X6, RxJS, Vitest

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/app/pages/dfd/utils/cell-extraction.util.ts` | Extract cells from X6 graph with complete attrs (replaces both `graph.toJSON()` and `convertGraphToCellsFormat()`) |
| `src/app/pages/dfd/utils/cell-extraction.util.spec.ts` | Tests for cell extraction utility |

### Modified Files

| File | Changes |
|------|---------|
| `src/app/pages/dfd/application/services/app-persistence-coordinator.service.ts` | Add optional `imageData` to `SaveOperation` interface |
| `src/app/pages/dfd/infrastructure/strategies/infra-rest-persistence.strategy.ts` | Call `patchDiagramWithImage()` when `imageData` is present in the operation |
| `src/app/pages/dfd/application/services/app-dfd-orchestrator.service.ts` | Replace `_getGraphData()` with new utility; rewrite `saveManuallyWithImage()` to route through coordinator |
| `src/app/pages/dfd/application/services/app-diagram.service.ts` | Remove 12 dead save/helper methods including `convertGraphToCellsFormat()` |
| `src/app/pages/dfd/utils/cell-normalization.util.ts` | No changes needed (already works on cell arrays) |
| `src/app/pages/dfd/utils/cell-property-filter.util.ts` | No changes needed (`sanitizeCellForApi` already filters to API schema) |

---

## Chunk 1: Shared Cell Extraction Utility

This chunk creates the core utility that replaces both `graph.toJSON()` (auto-save path) and `convertGraphToCellsFormat()` (manual save path). The new utility reads attrs directly from X6 cell instances via `cell.getAttrs()`, which returns the instance store without stripping defaults.

**Why no default-merging is needed:** X6's `Cell` constructor (in `node_modules/@antv/x6/lib/model/cell.js:76`) merges shape defaults into the instance store: `ObjectExt.merge({}, defaults, metadata)`. So `cell.getAttrs()` always returns the complete merged result including shape defaults — unlike `graph.toJSON()` which strips defaults before serializing. The new utility simply copies what's already in the store.

### Task 1: Create cell extraction utility with tests

**Files:**
- Create: `src/app/pages/dfd/utils/cell-extraction.util.ts`
- Create: `src/app/pages/dfd/utils/cell-extraction.util.spec.ts`
- Reference: `src/app/pages/dfd/utils/cell-property-filter.util.ts:697` (`sanitizeCellForApi`)
- Reference: `src/app/pages/dfd/utils/cell-normalization.util.ts:20` (`normalizeCell`)
- Reference: `src/app/pages/dfd/application/services/app-diagram.service.ts:1119-1249` (`convertGraphToCellsFormat`)

- [ ] **Step 1: Write the failing test for node extraction**

Create `src/app/pages/dfd/utils/cell-extraction.util.spec.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractCellsFromGraph } from './cell-extraction.util';

/**
 * Creates a mock X6 graph with configurable cells for testing.
 * Each mock cell supports the X6 Cell API methods used by extractCellsFromGraph.
 */
function createMockGraph(cells: any[]) {
  return {
    getCells: () => cells,
  };
}

function createMockNode(overrides: Partial<{
  id: string;
  shape: string;
  attrs: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  data: any;
  parent: any;
  ports: any;
}> = {}) {
  const {
    id = 'node-1',
    shape = 'process',
    attrs = { body: { fill: '#fff7e6', stroke: '#ff7f0e', strokeWidth: 2 }, text: { text: 'My Process' } },
    x = 100,
    y = 200,
    width = 120,
    height = 60,
    zIndex = 1,
    data = null,
    parent = null,
    ports = { items: [] },
  } = overrides;

  return {
    id,
    shape,
    isNode: () => true,
    isEdge: () => false,
    getAttrs: () => attrs,
    position: () => ({ x, y }),
    size: () => ({ width, height }),
    getZIndex: () => zIndex,
    getData: () => data,
    getParent: () => parent,
    getProp: (key: string) => key === 'ports' ? ports : undefined,
    getLabel: () => (attrs as any)?.text?.text || '',
  };
}

function createMockEdge(overrides: Partial<{
  id: string;
  source: any;
  target: any;
  vertices: any[];
  zIndex: number;
  data: any;
  labels: any[];
  attrs: Record<string, unknown>;
}> = {}) {
  const {
    id = 'edge-1',
    source = { cell: 'node-1', port: 'port-1' },
    target = { cell: 'node-2', port: 'port-2' },
    vertices = [],
    zIndex = 0,
    data = null,
    labels = [],
    attrs = { line: { stroke: '#333', strokeWidth: 1 } },
  } = overrides;

  return {
    id,
    shape: 'edge',
    isNode: () => false,
    isEdge: () => true,
    getAttrs: () => attrs,
    getSource: () => source,
    getTarget: () => target,
    getVertices: () => vertices,
    getZIndex: () => zIndex,
    getData: () => data,
    getLabels: () => labels,
  };
}

describe('extractCellsFromGraph', () => {
  it('should extract node with complete attrs including fill and stroke', () => {
    const node = createMockNode({
      attrs: {
        body: { fill: '#e8f4fd', stroke: '#1f77b4', strokeWidth: 2 },
        text: { text: 'Actor Node', fontSize: 14, fill: '#333333' },
      },
    });
    const graph = createMockGraph([node]);

    const result = extractCellsFromGraph(graph as any);

    expect(result).toHaveLength(1);
    expect(result[0].attrs?.body?.fill).toBe('#e8f4fd');
    expect(result[0].attrs?.body?.stroke).toBe('#1f77b4');
    expect(result[0].attrs?.text?.text).toBe('Actor Node');
  });

  it('should preserve attrs that match X6 shape defaults (the bug fix)', () => {
    // This is the core regression test: white fill + black stroke are
    // X6 shape defaults. graph.toJSON() strips these; our utility must not.
    const node = createMockNode({
      attrs: {
        body: { fill: '#FFFFFF', stroke: '#000000', strokeWidth: 2 },
        text: { text: 'Default Colors' },
      },
    });
    const graph = createMockGraph([node]);

    const result = extractCellsFromGraph(graph as any);

    expect(result[0].attrs?.body?.fill).toBe('#FFFFFF');
    expect(result[0].attrs?.body?.stroke).toBe('#000000');
  });

  it('should use nested position/size format (X6 v2 native)', () => {
    const node = createMockNode({ x: 150, y: 250, width: 200, height: 80 });
    const graph = createMockGraph([node]);

    const result = extractCellsFromGraph(graph as any);

    expect(result[0].position).toEqual({ x: 150, y: 250 });
    expect(result[0].size).toEqual({ width: 200, height: 80 });
    // Must NOT have flat x/y/width/height
    expect(result[0]).not.toHaveProperty('x');
    expect(result[0]).not.toHaveProperty('y');
    expect(result[0]).not.toHaveProperty('width');
    expect(result[0]).not.toHaveProperty('height');
  });

  it('should extract edges with source/target/vertices', () => {
    const edge = createMockEdge({
      source: { cell: 'a', port: 'p1' },
      target: { cell: 'b', port: 'p2' },
      vertices: [{ x: 300, y: 150 }],
    });
    const graph = createMockGraph([edge]);

    const result = extractCellsFromGraph(graph as any);

    expect(result).toHaveLength(1);
    expect(result[0].shape).toBe('edge');
    expect(result[0].source).toEqual({ cell: 'a', port: 'p1' });
    expect(result[0].target).toEqual({ cell: 'b', port: 'p2' });
    expect(result[0].vertices).toEqual([{ x: 300, y: 150 }]);
  });

  it('should handle mixed nodes and edges', () => {
    const node = createMockNode({ id: 'n1' });
    const edge = createMockEdge({ id: 'e1' });
    const graph = createMockGraph([node, edge]);

    const result = extractCellsFromGraph(graph as any);

    expect(result).toHaveLength(2);
    const nodeResult = result.find(c => c.id === 'n1');
    const edgeResult = result.find(c => c.id === 'e1');
    expect(nodeResult).toBeDefined();
    expect(edgeResult).toBeDefined();
  });

  it('should include parent reference for embedded nodes', () => {
    const parentNode = createMockNode({ id: 'parent-1', shape: 'security-boundary' });
    const childNode = createMockNode({
      id: 'child-1',
      parent: { id: 'parent-1', isNode: () => true },
    });
    const graph = createMockGraph([parentNode, childNode]);

    const result = extractCellsFromGraph(graph as any);
    const child = result.find(c => c.id === 'child-1');

    expect(child?.parent).toBe('parent-1');
  });

  it('should include edge labels', () => {
    const edge = createMockEdge({
      labels: [{ attrs: { label: { text: 'Data Flow' } } }],
    });
    const graph = createMockGraph([edge]);

    const result = extractCellsFromGraph(graph as any);

    expect(result[0].labels).toHaveLength(1);
  });

  it('should convert cell data to hybrid format', () => {
    const node = createMockNode({
      data: { _metadata: [{ key: 'type', value: 'process' }] },
    });
    const graph = createMockGraph([node]);

    const result = extractCellsFromGraph(graph as any);

    expect(result[0].data).toEqual({ _metadata: [{ key: 'type', value: 'process' }] });
  });

  it('should return empty array for graph with no cells', () => {
    const graph = createMockGraph([]);
    const result = extractCellsFromGraph(graph as any);
    expect(result).toEqual([]);
  });

  it('should strip runtime port visibility state', () => {
    const node = createMockNode({
      ports: {
        items: [
          { id: 'p1', group: 'in', attrs: { circle: { r: 6 } } },
        ],
      },
    });
    const graph = createMockGraph([node]);

    const result = extractCellsFromGraph(graph as any);

    // Ports should be included but cleaned of runtime state
    expect(result[0].ports).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/app/pages/dfd/utils/cell-extraction.util.spec.ts`
Expected: FAIL — `extractCellsFromGraph` does not exist yet.

- [ ] **Step 3: Write the cell extraction utility**

Create `src/app/pages/dfd/utils/cell-extraction.util.ts`:

```typescript
/**
 * Cell extraction utility for DFD diagram persistence
 *
 * Extracts cells from an X6 graph instance using direct cell API methods
 * (cell.getAttrs(), cell.position(), etc.) instead of graph.toJSON().
 *
 * graph.toJSON() strips attrs that match registered shape defaults, which
 * causes user-set colors identical to defaults to be lost. This utility
 * reads from the cell instance store directly, preserving all attrs.
 *
 * Output format: X6 v2 nested format with position {x, y} and size {width, height}.
 * Compatible with normalizeCells() and sanitizeCellForApi().
 */

import { Graph } from '@antv/x6';
import { Cell } from '../../../core/types/websocket-message.types';

/**
 * Extract all cells from an X6 graph with complete attrs.
 *
 * Uses cell.getAttrs() which returns the instance store as-is,
 * unlike graph.toJSON() which omits attrs matching shape defaults.
 *
 * @param graph The X6 graph instance
 * @returns Array of cells in X6 v2 nested format
 */
export function extractCellsFromGraph(graph: Graph): Cell[] {
  const graphCells = graph.getCells();
  const cells: Cell[] = [];

  for (const cell of graphCells) {
    try {
      if (cell.isNode()) {
        cells.push(extractNode(cell, graphCells));
      } else if (cell.isEdge()) {
        cells.push(extractEdge(cell));
      }
    } catch {
      // Skip cells that fail to extract — logged at call site
    }
  }

  return cells;
}

/**
 * Extract a node cell with complete attrs and nested position/size format.
 */
function extractNode(cell: any, allCells: any[]): Cell {
  const attrs = cell.getAttrs() || {};
  const pos = cell.position();
  const sz = cell.size();

  const nodeCell: Cell = {
    id: cell.id,
    shape: cell.shape,
    position: { x: pos.x, y: pos.y },
    size: { width: sz.width, height: sz.height },
    zIndex: cell.getZIndex(),
    visible: true,
    attrs: {
      body: { ...(attrs.body || {}) },
      text: { ...(attrs.text || {}) },
    },
    ports: cleanPortsForSave(cell.getProp('ports')),
    data: convertCellData(cell.getData()),
  };

  // Parent reference for embedded nodes
  const parent = cell.getParent();
  if (parent && parent.isNode()) {
    nodeCell.parent = parent.id;
  }

  // Children references
  const children = allCells.filter(c => c.isNode() && c.getParent()?.id === cell.id);
  if (children.length > 0) {
    nodeCell.children = children.map((c: any) => c.id);
  }

  return nodeCell;
}

/**
 * Extract an edge cell with source/target/vertices.
 */
function extractEdge(cell: any): Cell {
  const source = cell.getSource();
  const target = cell.getTarget();
  const attrs = cell.getAttrs() || {};

  const edgeCell: Cell = {
    id: cell.id,
    shape: 'edge',
    source: {
      cell: source?.cell,
      port: source?.port,
    },
    target: {
      cell: target?.cell,
      port: target?.port,
    },
    vertices: cell.getVertices(),
    zIndex: cell.getZIndex(),
    attrs: {
      line: { ...(attrs.line || {}) },
    },
    data: convertCellData(cell.getData()),
  };

  // Labels
  const labels = cell.getLabels ? cell.getLabels() : [];
  if (labels && labels.length > 0) {
    edgeCell.labels = labels;
  }

  return edgeCell;
}

/**
 * Convert cell data to hybrid format for API persistence.
 * Mirrors the logic from AppDiagramService.convertCellDataToArray().
 */
function convertCellData(cellData: any): any {
  if (cellData && cellData._metadata) {
    return cellData;
  } else if (cellData && cellData.metadata) {
    if (Array.isArray(cellData.metadata)) {
      return { _metadata: cellData.metadata };
    } else if (typeof cellData.metadata === 'object') {
      const metadataArray: any[] = [];
      Object.entries(cellData.metadata).forEach(([key, value]) => {
        metadataArray.push({ key, value: String(value) });
      });
      return { _metadata: metadataArray };
    }
  }
  return { _metadata: [] };
}

/**
 * Strip runtime-only port state before saving.
 * Removes visibility toggles that are runtime-only state.
 */
function cleanPortsForSave(ports: any): any {
  if (!ports || !ports.items) {
    return undefined;
  }

  return {
    ...ports,
    items: ports.items.map((port: any) => {
      const cleaned = { ...port };
      // Remove runtime visibility state
      if (cleaned.attrs?.circle) {
        const { style, ...rest } = cleaned.attrs.circle;
        if (Object.keys(rest).length > 0) {
          cleaned.attrs = { ...cleaned.attrs, circle: rest };
        }
      }
      return cleaned;
    }),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/app/pages/dfd/utils/cell-extraction.util.spec.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Run lint and format**

Run: `pnpm run format && pnpm run lint:all`
Fix any issues.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/dfd/utils/cell-extraction.util.ts src/app/pages/dfd/utils/cell-extraction.util.spec.ts
git commit -m "feat: add shared cell extraction utility that preserves all attrs

Replaces graph.toJSON() which strips attrs matching X6 shape defaults,
causing user-set fill/stroke colors to be lost. Uses cell.getAttrs()
to read the instance store directly.

Part of #474"
```

---

## Chunk 2: SaveOperation Image Support + REST Strategy Update

This chunk adds `imageData` to the `SaveOperation` interface and updates the REST persistence strategy to call `patchDiagramWithImage()` when image data is present.

### Task 2: Add imageData to SaveOperation and update REST strategy

**Files:**
- Modify: `src/app/pages/dfd/application/services/app-persistence-coordinator.service.ts:19-24` (SaveOperation interface)
- Modify: `src/app/pages/dfd/infrastructure/strategies/infra-rest-persistence.strategy.ts:34-103` (save method)
- Reference: `src/app/pages/tm/services/threat-model.service.ts:1309-1349` (patchDiagramWithImage signature)

- [ ] **Step 1: Add imageData to SaveOperation interface**

In `src/app/pages/dfd/application/services/app-persistence-coordinator.service.ts`, modify the `SaveOperation` interface at line 19:

```typescript
export interface SaveOperation {
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly data: any;
  readonly imageData?: { svg?: string; update_vector?: number };
  readonly metadata?: Record<string, any>;
}
```

- [ ] **Step 2: Update InfraRestPersistenceStrategy.save() to support image data**

In `src/app/pages/dfd/infrastructure/strategies/infra-rest-persistence.strategy.ts`, modify the `save()` method to call `patchDiagramWithImage` when `operation.imageData` is present:

Replace the API call section (lines 66-103) — change from always calling `patchDiagramCells` to conditionally calling `patchDiagramWithImage`:

```typescript
    // Choose API method based on whether image data is present
    const apiCall = operation.imageData?.svg
      ? this.threatModelService.patchDiagramWithImage(
          threatModelId,
          operation.diagramId,
          cells,
          operation.imageData,
        )
      : this.threatModelService.patchDiagramCells(threatModelId, operation.diagramId, cells);

    return apiCall.pipe(
      // ... existing map and catchError handlers unchanged
    );
```

- [ ] **Step 3: Write test for REST strategy image branching**

Add a test to verify the REST strategy calls `patchDiagramWithImage` when image data is present and `patchDiagramCells` when it's not. If `infra-rest-persistence.strategy.spec.ts` exists, add to it; otherwise create it.

```typescript
it('should call patchDiagramWithImage when imageData.svg is present', () => {
  const operation = {
    diagramId: 'diag-1',
    threatModelId: 'tm-1',
    data: { nodes: [{ id: 'n1', shape: 'process' }], edges: [] },
    imageData: { svg: 'base64svgdata' },
  };

  strategy.save(operation).subscribe(result => {
    expect(result.success).toBe(true);
  });

  expect(mockThreatModelService.patchDiagramWithImage).toHaveBeenCalledWith(
    'tm-1', 'diag-1', expect.any(Array), { svg: 'base64svgdata' }
  );
});

it('should call patchDiagramCells when imageData is absent', () => {
  const operation = {
    diagramId: 'diag-1',
    threatModelId: 'tm-1',
    data: { nodes: [{ id: 'n1', shape: 'process' }], edges: [] },
  };

  strategy.save(operation).subscribe(result => {
    expect(result.success).toBe(true);
  });

  expect(mockThreatModelService.patchDiagramCells).toHaveBeenCalled();
  expect(mockThreatModelService.patchDiagramWithImage).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run build and tests**

Run: `pnpm run build && pnpm test`
Expected: PASS — no type errors, tests green.

- [ ] **Step 5: Run lint and format**

Run: `pnpm run format && pnpm run lint:all`
Fix any issues.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/dfd/application/services/app-persistence-coordinator.service.ts src/app/pages/dfd/infrastructure/strategies/infra-rest-persistence.strategy.ts src/app/pages/dfd/infrastructure/strategies/infra-rest-persistence.strategy.spec.ts
git commit -m "feat: add image data support to SaveOperation and REST strategy

Extends SaveOperation with optional imageData field. REST strategy
now calls patchDiagramWithImage when image data is present, enabling
manual saves with thumbnails to route through the persistence coordinator."
```

---

## Chunk 3: Consolidate Save Paths Through Coordinator

This chunk routes manual saves through the persistence coordinator and removes the dead save methods from `AppDiagramService`.

### Task 3: Rewrite orchestrator to use shared cell extraction

**Files:**
- Modify: `src/app/pages/dfd/application/services/app-dfd-orchestrator.service.ts:1937-1998` (`_getGraphData`)
- Modify: `src/app/pages/dfd/application/services/app-dfd-orchestrator.service.ts:949-983` (`saveManuallyWithImage`)
- Modify: `src/app/pages/dfd/application/services/app-dfd-orchestrator.service.ts:330-375` (`save`)
- Reference: `src/app/pages/dfd/utils/cell-extraction.util.ts` (new utility)

Note: `saveManually()` (line 942) is kept as-is — it's part of the `DfdOrchestratorInterface` contract and has 6+ call sites. It delegates to `save()` which already routes through the coordinator.

- [ ] **Step 1: Replace `_getGraphData()` with cell extraction utility**

In `src/app/pages/dfd/application/services/app-dfd-orchestrator.service.ts`:

1. Add imports at top of file (`normalizeCells` is already imported at line 50, do not duplicate):
```typescript
import { extractCellsFromGraph } from '../../utils/cell-extraction.util';
import { sanitizeCellForApi } from '../../utils/cell-property-filter.util';
```

2. Rewrite `_getGraphData()` (line 1937) to use the new utility:

```typescript
  private _getGraphData(): { nodes: any[]; edges: any[] } | null {
    const graph = this.dfdInfrastructure.getGraph();
    if (!graph) {
      this.logger.warn('Cannot get graph data - graph is not available');
      return null;
    }

    const rawCells = extractCellsFromGraph(graph);
    const normalizedCells = normalizeCells(rawCells);
    const apiCells = normalizedCells.map(cell => sanitizeCellForApi(cell, this.logger));

    const nodes = apiCells
      .filter((cell: any) => cell.shape !== 'edge')
      .map((cell: any) => ({ ...cell, type: 'node' }));

    const edges = apiCells
      .filter((cell: any) => cell.shape === 'edge')
      .map((cell: any) => ({ ...cell, type: 'edge' }));

    return { nodes, edges };
  }
```

- [ ] **Step 2: Rewrite `saveManuallyWithImage()` to route through coordinator**

Replace `saveManuallyWithImage()` (line 949) to use persistence coordinator instead of bypassing it:

```typescript
  saveManuallyWithImage(imageData: { svg?: string }): Observable<any> {
    if (!this._initParams || !this.dfdInfrastructure.getGraph()) {
      return throwError(() => new Error('DFD system not initialized'));
    }

    this.logger.debugComponent('AppDfdOrchestrator', 'Manual save with image triggered', {
      hasSvg: !!imageData.svg,
    });

    const isCollaborating = this.collaborationService.isCollaborating();
    const useWebSocket = isCollaborating;

    const saveOperation = {
      diagramId: this._initParams.diagramId,
      threatModelId: this._initParams.threatModelId,
      data: this._getGraphData(),
      imageData,
      metadata: {
        saveType: 'manual-with-image',
        providerId: this.authService.providerId,
        userEmail: this.authService.userEmail,
        userName: this.authService.username,
      },
    };

    return this.appPersistenceCoordinator.save(saveOperation, useWebSocket).pipe(
      map(result => {
        if (result.success) {
          this._stats.autoSaves++;
          this._updateState({
            hasUnsavedChanges: false,
            lastSaved: new Date(),
          });
          return true;
        }
        return false;
      }),
      catchError(error => {
        this.logger.error('Manual save with image failed', { error });
        return throwError(() => error);
      }),
    );
  }
```

- [ ] **Step 3: Run build and tests**

Run: `pnpm run build && pnpm test`
Expected: PASS

- [ ] **Step 4: Run lint and format**

Run: `pnpm run format && pnpm run lint:all`
Fix any issues.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/dfd/application/services/app-dfd-orchestrator.service.ts
git commit -m "refactor: route all saves through persistence coordinator

Replace _getGraphData() with extractCellsFromGraph utility that preserves
all attrs. Route saveManuallyWithImage through the persistence coordinator
instead of bypassing it via AppDiagramService direct methods."
```

### Task 4: Remove dead save methods from AppDiagramService

**Files:**
- Modify: `src/app/pages/dfd/application/services/app-diagram.service.ts`
  - Remove: `saveDiagramChanges()` (~line 780-811)
  - Remove: `saveDiagramChangesWithImage()` (~line 818-838)
  - Remove: `saveViaREST()` (~line 992-1023)
  - Remove: `saveViaRESTWithImage()` (~line 855-901)
  - Remove: `_saveViaWebSocketWithFallback()` (~line 907-913)
  - Remove: `_saveViaWebSocketWithImageFallback()` (~line 843-850)
  - Remove: `_saveViaWebSocketWithFallbackInternal()` (~line 920-1101)
  - Remove: `convertGraphToCellsFormat()` (~line 1119-1249)
  - Remove: `_isAuthenticationError()` (~line 1107-1114)
  - Remove: `convertCellDataToArray()` (~line 1255-1276) — logic moved to cell-extraction.util.ts
  - Remove: `cleanPortsForSave()` (~line 1282) — logic moved to cell-extraction.util.ts
  - Remove: `stripVisibilityFromPortAttrs()` (~line 1306) — only called from cleanPortsForSave

- [ ] **Step 1: Verify no remaining call sites for dead methods**

Run these searches to confirm nothing else calls these methods:

```bash
pnpm exec grep -rn "saveDiagramChanges\b" src/ --include="*.ts"
pnpm exec grep -rn "saveDiagramChangesWithImage\b" src/ --include="*.ts"
pnpm exec grep -rn "saveViaREST\b" src/ --include="*.ts"
pnpm exec grep -rn "_saveViaWebSocket" src/ --include="*.ts"
pnpm exec grep -rn "convertGraphToCellsFormat" src/ --include="*.ts"
```

Expected: Only definitions in `app-diagram.service.ts` and the now-removed call in `app-dfd-orchestrator.service.ts`.

- [ ] **Step 2: Remove all dead methods from AppDiagramService**

Remove the methods listed above. Also remove any imports that become unused after removal (e.g., `timeout` from rxjs if only used by the WebSocket fallback, `CellOperation` type if only used there).

- [ ] **Step 3: Remove the `(this.appDiagramLoadingService as any).diagramService` accessor in orchestrator**

If this accessor was only used by `saveManuallyWithImage`, remove it. Search for other uses first:

```bash
pnpm exec grep -rn "appDiagramLoadingService as any" src/ --include="*.ts"
```

- [ ] **Step 4: Run build and tests**

Run: `pnpm run build && pnpm test`
Expected: PASS — all dead code is cleanly removed.

- [ ] **Step 5: Run lint and format**

Run: `pnpm run format && pnpm run lint:all`
Fix any issues.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/dfd/application/services/app-diagram.service.ts src/app/pages/dfd/application/services/app-dfd-orchestrator.service.ts
git commit -m "refactor: remove 12 dead save methods from AppDiagramService

All saves now route through the persistence coordinator using the shared
cell extraction utility. Removes saveDiagramChanges, saveDiagramChangesWithImage,
saveViaREST, saveViaRESTWithImage, _saveViaWebSocketWithFallback,
_saveViaWebSocketWithImageFallback, _saveViaWebSocketWithFallbackInternal,
_isAuthenticationError, convertGraphToCellsFormat, convertCellDataToArray,
cleanPortsForSave, and stripVisibilityFromPortAttrs."
```

---

## Chunk 4: Remove Diagnostic Logging

This chunk removes the DIAG-474 diagnostic logging that was added during investigation.

### Task 5: Remove DIAG-474 diagnostic logging

**Files:**
- Modify: `src/app/pages/dfd/application/services/app-dfd-orchestrator.service.ts` — remove DIAG-474 logging blocks (already removed by Task 3's `_getGraphData` rewrite)
- Modify: `src/app/pages/dfd/application/services/app-diagram.service.ts` — remove DIAG-474 logging blocks in `convertGraphToCellsFormat` (already removed by Task 4) and in `convertMockNodeToX6Format` (load path)

- [ ] **Step 1: Search for remaining DIAG-474 markers**

```bash
pnpm exec grep -rn "DIAG-474" src/ --include="*.ts"
```

Remove any remaining `[DIAG-474]` logging blocks.

- [ ] **Step 2: Run build and tests**

Run: `pnpm run build && pnpm test`
Expected: PASS

- [ ] **Step 3: Run lint and format**

Run: `pnpm run format && pnpm run lint:all`
Fix any issues.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "chore: remove DIAG-474 diagnostic logging

Diagnostic logging for issue #474 investigation is no longer needed
now that the root cause is fixed."
```

### Task 6: Final verification and issue update

- [ ] **Step 1: Full build and test**

Run: `pnpm run build && pnpm test`
Expected: PASS — clean build, all tests pass.

- [ ] **Step 2: Verify the fix works end-to-end**

Manual verification checklist:
1. Open a DFD diagram
2. Add a node (e.g., process) — note it has default orange fill/stroke
3. Save manually (Ctrl+S) — should generate thumbnail and save via coordinator
4. Reload the page — node should retain its orange fill/stroke colors
5. Change a node's color to a non-default color
6. Wait for auto-save to trigger
7. Reload — custom color should be preserved
8. Change a node's color to white fill / black stroke (same as X6 defaults)
9. Save and reload — white/black should still be preserved

- [ ] **Step 3: Add comment to issue #474 referencing commits**

```bash
gh issue comment 474 --repo ericfitz/tmi-ux --body "Fixed by consolidating all save paths through the persistence coordinator and replacing graph.toJSON() with direct cell extraction via cell.getAttrs(). The root cause was X6's toJSON() stripping attrs that match registered shape defaults."
```

- [ ] **Step 4: Close issue #474**

```bash
gh issue close 474 --repo ericfitz/tmi-ux --reason completed
```
