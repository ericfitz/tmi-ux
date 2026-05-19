# DFD Component Controller Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract controller logic from the 4,082-line `dfd.component.ts` into six focused, unit-tested services, leaving the component as X6 event wiring + lifecycle glue.

**Architecture:** Six `@Injectable({ providedIn: 'root' })` services under `dfd/presentation/services/`. The extracted services depend on narrow `LayoutCell` / `LayoutGraph` interfaces (which X6's concrete `Cell`/`Graph` structurally satisfy) instead of X6 types, so unit tests pass plain object fakes. The component keeps every `executeOperation(...).subscribe()` dispatch and every `cdr.detectChanges()` call; services compute and mutate cells.

**Tech Stack:** Angular 18 standalone components, TypeScript (strict), AntV X6, Vitest, RxJS.

**Reference:** Design spec at `docs/superpowers/specs/2026-05-18-dfd-component-controller-extraction-design.md`. Sibling extraction #695 (`tm-edit`) under `src/app/pages/tm/services/` is the pattern to mirror.

---

## File Structure

**New files:**

| File | Responsibility |
|---|---|
| `src/app/pages/dfd/types/layout-cell.types.ts` | `LayoutCell` / `LayoutGraph` interfaces — the test seam. |
| `src/app/pages/dfd/presentation/services/dfd-node-type.service.ts` + `.spec.ts` | Pure node-type mapping + data-asset predicates/getters. |
| `src/app/pages/dfd/presentation/services/dfd-dialog.service.ts` + `.spec.ts` | The single `MatDialog` seam for DFD dialogs. |
| `src/app/pages/dfd/presentation/services/dfd-command.service.ts` + `.spec.ts` | Post-dialog command orchestration + navigation. |
| `src/app/pages/dfd/presentation/services/dfd-layout.service.ts` + `.spec.ts` | Auto-layout / container-fit / cascade glue. |
| `src/app/pages/dfd/presentation/services/dfd-icon.service.ts` + `.spec.ts` | Architecture-icon application, lock badges, border prefs, history snapshot. |
| `src/app/pages/dfd/presentation/services/dfd-styling.service.ts` + `.spec.ts` | Style-panel + edge styling, clear-formatting, cell-info builders. |

**Modified file:** `src/app/pages/dfd/presentation/components/dfd.component.ts` — delegates to the new services; keeps Category D glue.

---

## Conventions for every task

- **Imports:** Angular core → Angular modules → third-party → project (per `.claude/CLAUDE.md`).
- **Services:** `@Injectable({ providedIn: 'root' })`, constructor DI, explicit return types, JSDoc on public methods.
- **Specs:** Vitest (`describe`/`it`/`expect`, `vi.fn()`), alongside source as `*.spec.ts`. Mirror `src/app/pages/dfd/presentation/services/ui-presenter-coordinator.service.spec.ts`.
- **Per-phase verification gate (run before every commit):**
  - `pnpm run lint:all` — must pass.
  - `pnpm run build` — must pass with zero errors.
  - `pnpm test -- <new-spec-path>` — new spec green.
  - `pnpm test -- src/app/pages/dfd/presentation/components/dfd.component.spec.ts` — only if that file exists; if absent, skip (the issue notes the component has no spec).
- **Commit messages:** conventional `refactor:` prefix, footer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **No backward-compat shims.** Delete the old method from the component once delegated.
- **Do not** move `_inLayoutCycle`, `executeOperation(...).subscribe()` calls, or `cdr.detectChanges()` calls out of the component.

---

## Phase 1 — Seam + DfdNodeTypeService

### Task 1: Define the LayoutCell / LayoutGraph seam

**Files:**
- Create: `src/app/pages/dfd/types/layout-cell.types.ts`

- [ ] **Step 1: Write the interface file**

```typescript
/**
 * Narrow structural interfaces for X6 cells and graphs.
 *
 * The DFD presentation services depend on these interfaces instead of X6's
 * concrete `Cell` / `Graph` classes. X6's real types structurally satisfy
 * these, so the component passes live cells/graph unchanged. Unit tests pass
 * plain object fakes implementing only the members a test exercises.
 *
 * When an extracted method reads a cell member not listed here, ADD it here
 * rather than widening a parameter to `any`.
 */

/** Position of a cell in graph coordinates. */
export interface LayoutPoint {
  x: number;
  y: number;
}

/** Size of a cell. */
export interface LayoutSize {
  width: number;
  height: number;
}

/** Structural surface of an X6 Cell used by DFD presentation services. */
export interface LayoutCell {
  readonly id: string;
  readonly shape: string;
  getData<T = Record<string, unknown>>(): T;
  setData(data: Record<string, unknown>, options?: { silent?: boolean; overwrite?: boolean }): void;
  getSize(): LayoutSize;
  resize(width: number, height: number): void;
  getPosition(): LayoutPoint;
  setPosition(x: number, y: number, options?: { silent?: boolean }): void;
  getChildren(): LayoutCell[] | null;
  getParent(): LayoutCell | null;
  getAttrs(): Record<string, unknown>;
  getAttrByPath(path: string): unknown;
  setAttrByPath(path: string, value: unknown, options?: { silent?: boolean }): void;
  getZIndex(): number | undefined;
  isVisible(): boolean;
  isNode(): boolean;
  isEdge(): boolean;
  getPorts(): unknown[];
}

/** Structural surface of an X6 Graph used by DFD presentation services. */
export interface LayoutGraph {
  getNodes(): LayoutCell[];
  getEdges(): LayoutCell[];
  getCellById(id: string): LayoutCell | null;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm run build`
Expected: PASS (file is types-only, imported nowhere yet).

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/dfd/types/layout-cell.types.ts
git commit -m "refactor: add LayoutCell/LayoutGraph seam interfaces (#694)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

> **Note for Task 2+:** If a later task needs a cell member not on `LayoutCell` (e.g. `cell.getSourceCellId()` for edges), add it to the interface in that task and mention the addition in the commit body. `getData` is generic so call sites can narrow to a known shape.

---

### Task 2: Create DfdNodeTypeService with mapStringToNodeType

**Files:**
- Create: `src/app/pages/dfd/presentation/services/dfd-node-type.service.ts`
- Create: `src/app/pages/dfd/presentation/services/dfd-node-type.service.spec.ts`
- Source reference: `dfd.component.ts:3965-3980` (`mapStringToNodeType`)

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { DfdNodeTypeService } from './dfd-node-type.service';

describe('DfdNodeTypeService', () => {
  let service: DfdNodeTypeService;

  beforeEach(() => {
    service = new DfdNodeTypeService();
  });

  describe('mapStringToNodeType', () => {
    it.each(['actor', 'process', 'store', 'security-boundary', 'text-box'] as const)(
      'maps %s to itself',
      value => {
        expect(service.mapStringToNodeType(value)).toBe(value);
      },
    );

    it('maps an unknown string to process', () => {
      expect(service.mapStringToNodeType('not-a-shape')).toBe('process');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/pages/dfd/presentation/services/dfd-node-type.service.spec.ts`
Expected: FAIL — cannot resolve `./dfd-node-type.service`.

- [ ] **Step 3: Write the service**

```typescript
import { Injectable } from '@angular/core';
import { NodeType } from '../../domain/value-objects/node-info';

/**
 * Pure node-type mapping and data-asset predicates for the DFD editor.
 * Holds no state — all cell/selection state stays in the component.
 */
@Injectable({ providedIn: 'root' })
export class DfdNodeTypeService {
  /**
   * Map a raw shape string to a known NodeType, defaulting to 'process'
   * for unrecognized values.
   */
  mapStringToNodeType(nodeType: string): NodeType {
    switch (nodeType) {
      case 'actor':
        return 'actor';
      case 'process':
        return 'process';
      case 'store':
        return 'store';
      case 'security-boundary':
        return 'security-boundary';
      case 'text-box':
        return 'text-box';
      default:
        return 'process';
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/app/pages/dfd/presentation/services/dfd-node-type.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/dfd/presentation/services/dfd-node-type.service.ts src/app/pages/dfd/presentation/services/dfd-node-type.service.spec.ts
git commit -m "refactor: add DfdNodeTypeService with mapStringToNodeType (#694)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Move data-asset getters and predicates into DfdNodeTypeService

The component's `isDataAssetChecked` / `isDataAssetIndeterminate` read the
component-owned `Map<string, Set<string>>` field `_selectedCellDataAssets`. The
predicate logic is pure once that map is passed as a parameter; the map stays in
the component. `_getCellDataAssets` / `_setCellDataAssets` operate on a single
cell and move as `LayoutCell`-typed methods.

**Files:**
- Modify: `dfd-node-type.service.ts`
- Modify: `dfd-node-type.service.spec.ts`
- Modify: `dfd.component.ts` — delegate; sources at `:2118-2191`

- [ ] **Step 1: Add the failing tests**

Append to `dfd-node-type.service.spec.ts` inside the top `describe`:

```typescript
  describe('getCellDataAssets', () => {
    it('returns the data_assets array when present', () => {
      const cell = { getData: () => ({ data_assets: ['a', 'b'] }) } as any;
      expect(service.getCellDataAssets(cell)).toEqual(['a', 'b']);
    });

    it('returns the legacy dataAssetId as a single-element array', () => {
      const cell = { getData: () => ({ dataAssetId: 'legacy' }) } as any;
      expect(service.getCellDataAssets(cell)).toEqual(['legacy']);
    });

    it('returns an empty array when the cell has no asset data', () => {
      const cell = { getData: () => ({}) } as any;
      expect(service.getCellDataAssets(cell)).toEqual([]);
    });
  });

  describe('setCellDataAssets', () => {
    it('writes data_assets and strips the legacy key when ids are non-empty', () => {
      let written: Record<string, unknown> | undefined;
      const cell = {
        getData: () => ({ dataAssetId: 'legacy', other: 1 }),
        setData: (d: Record<string, unknown>) => {
          written = d;
        },
      } as any;
      service.setCellDataAssets(cell, ['x']);
      expect(written).toEqual({ other: 1, data_assets: ['x'] });
    });

    it('removes data_assets when the id list is empty', () => {
      let written: Record<string, unknown> | undefined;
      const cell = {
        getData: () => ({ data_assets: ['x'], other: 1 }),
        setData: (d: Record<string, unknown>) => {
          written = d;
        },
      } as any;
      service.setCellDataAssets(cell, []);
      expect(written).toEqual({ other: 1 });
    });
  });

  describe('isDataAssetChecked', () => {
    it('is false when the map is empty', () => {
      expect(service.isDataAssetChecked(new Map(), 'a')).toBe(false);
    });

    it('is true only when every cell set contains the asset', () => {
      const map = new Map([
        ['c1', new Set(['a', 'b'])],
        ['c2', new Set(['a'])],
      ]);
      expect(service.isDataAssetChecked(map, 'a')).toBe(true);
      expect(service.isDataAssetChecked(map, 'b')).toBe(false);
    });
  });

  describe('isDataAssetIndeterminate', () => {
    it('is false when one or zero cells are selected', () => {
      expect(service.isDataAssetIndeterminate(new Map([['c1', new Set(['a'])]]), 'a')).toBe(false);
    });

    it('is true when some but not all cell sets contain the asset', () => {
      const map = new Map([
        ['c1', new Set(['a'])],
        ['c2', new Set<string>()],
      ]);
      expect(service.isDataAssetIndeterminate(map, 'a')).toBe(true);
    });

    it('is false when every cell set contains the asset', () => {
      const map = new Map([
        ['c1', new Set(['a'])],
        ['c2', new Set(['a'])],
      ]);
      expect(service.isDataAssetIndeterminate(map, 'a')).toBe(false);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/app/pages/dfd/presentation/services/dfd-node-type.service.spec.ts`
Expected: FAIL — `getCellDataAssets` etc. not defined.

- [ ] **Step 3: Add the methods to DfdNodeTypeService**

Add `import type { LayoutCell } from '../../types/layout-cell.types';` and these methods:

```typescript
  /** Read a cell's data assets, supporting both the array and legacy single-id formats. */
  getCellDataAssets(cell: LayoutCell): string[] {
    const data = cell.getData() ?? {};
    const assets = (data as { data_assets?: unknown }).data_assets;
    if (Array.isArray(assets)) {
      return assets as string[];
    }
    const legacy = (data as { dataAssetId?: unknown }).dataAssetId;
    if (typeof legacy === 'string') {
      return [legacy];
    }
    return [];
  }

  /** Write data assets to a cell in the array format, removing the legacy key. */
  setCellDataAssets(cell: LayoutCell, assetIds: string[]): void {
    const updated: Record<string, unknown> = { ...(cell.getData() ?? {}) };
    delete updated['dataAssetId'];
    if (assetIds.length > 0) {
      updated['data_assets'] = assetIds;
    } else {
      delete updated['data_assets'];
    }
    cell.setData(updated);
  }

  /** True when every cell in the selection map has the given asset. */
  isDataAssetChecked(selected: ReadonlyMap<string, Set<string>>, assetId: string): boolean {
    if (selected.size === 0) {
      return false;
    }
    for (const assetSet of selected.values()) {
      if (!assetSet.has(assetId)) {
        return false;
      }
    }
    return true;
  }

  /** True when some — but not all — cells in the selection map have the asset. */
  isDataAssetIndeterminate(
    selected: ReadonlyMap<string, Set<string>>,
    assetId: string,
  ): boolean {
    if (selected.size <= 1) {
      return false;
    }
    let hasAsset = false;
    let missingAsset = false;
    for (const assetSet of selected.values()) {
      if (assetSet.has(assetId)) {
        hasAsset = true;
      } else {
        missingAsset = true;
      }
      if (hasAsset && missingAsset) {
        return true;
      }
    }
    return false;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/app/pages/dfd/presentation/services/dfd-node-type.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Delegate from the component**

In `dfd.component.ts`:
1. Import `DfdNodeTypeService` and inject it as `private dfdNodeType: DfdNodeTypeService` in the constructor.
2. Delete the private methods `_getCellDataAssets` (`:2118-2132`), `_setCellDataAssets` (`:2137-2152`), `mapStringToNodeType` (`:3965-3980`).
3. Delete the public methods `isDataAssetChecked` (`:2157-2166`) and `isDataAssetIndeterminate` (`:2171-2191`) — they are template-bound, so add thin replacements that delegate:

```typescript
  isDataAssetChecked(assetId: string): boolean {
    return this.dfdNodeType.isDataAssetChecked(this._selectedCellDataAssets, assetId);
  }

  isDataAssetIndeterminate(assetId: string): boolean {
    return this.dfdNodeType.isDataAssetIndeterminate(this._selectedCellDataAssets, assetId);
  }
```

4. Update the remaining call sites — `_loadSelectedCellDataAssets` (`:2110`), `toggleDataAsset` (`:2215`), and any `mapStringToNodeType` callers — to call `this.dfdNodeType.getCellDataAssets(...)` / `this.dfdNodeType.setCellDataAssets(...)` / `this.dfdNodeType.mapStringToNodeType(...)`. Find all callers with `rg -n 'mapStringToNodeType|_getCellDataAssets|_setCellDataAssets' src/app/pages/dfd/presentation/components/dfd.component.ts`.

- [ ] **Step 6: Verification gate**

Run, in order — all must pass:
```
pnpm run lint:all
pnpm run build
pnpm test -- src/app/pages/dfd/presentation/services/dfd-node-type.service.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/dfd/presentation/services/dfd-node-type.service.ts src/app/pages/dfd/presentation/services/dfd-node-type.service.spec.ts src/app/pages/dfd/presentation/components/dfd.component.ts
git commit -m "refactor: move data-asset logic into DfdNodeTypeService (#694)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — DfdDialogService + DfdCommandService

> **Before starting Phase 2:** read the full source of these methods so the
> extraction is faithful. Run:
> `rg -n 'showHistory|showGraphData|showHelp|showClipboard|showCellProperties|manageMetadata|openThreatEditor|manageThreats|onEditMetadata|closeDiagram|_navigateAway|_fallbackSaveAndNavigate|_captureDiagramSvgThumbnail|_createThreat|_confirmDeletionIfNeeded' src/app/pages/dfd/presentation/components/dfd.component.ts`
> Then read each method body. The code blocks below give the service shape; the
> method *bodies* are moved verbatim from the component (only `this.dialog` →
> `this.dialog`, kept as a service-injected `MatDialog`).

### Task 4: Create DfdDialogService — the MatDialog seam

`DfdDialogService` wraps every `MatDialog.open(...)` call the component makes for
DFD-owned dialogs. Each method opens one dialog and returns its `MatDialogRef`
or an `Observable` of the result, mirroring `TmDialogService`
(`src/app/pages/tm/services/tm-dialog.service.ts`).

**Files:**
- Create: `src/app/pages/dfd/presentation/services/dfd-dialog.service.ts`
- Create: `src/app/pages/dfd/presentation/services/dfd-dialog.service.spec.ts`
- Source: dialog-open calls in `showHistory` (`:1065`), `showGraphData` (`:1088`), `showHelp` (`:1109`), `showClipboard` (`:1119`), `showCellProperties` (`:2297`), `_confirmDeletionIfNeeded` (`:4004-4023`), and the `MetadataDialogComponent` / `ThreatEditorDialogComponent` / `ThreatsDialogComponent` opens inside `onEditMetadata`, `openThreatEditor`, `manageThreats`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { DfdDialogService } from './dfd-dialog.service';

describe('DfdDialogService', () => {
  let service: DfdDialogService;
  let matDialog: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    matDialog = { open: vi.fn() };
    service = new DfdDialogService(matDialog as any);
  });

  describe('confirmDeletion', () => {
    it('opens ConfirmActionDialog and maps a confirmed result to true', async () => {
      matDialog.open.mockReturnValue({
        afterClosed: () => of({ confirmed: true }),
      });
      const result = await new Promise<boolean>(resolve => {
        service.confirmDeletion().subscribe(resolve);
      });
      expect(result).toBe(true);
      expect(matDialog.open).toHaveBeenCalledTimes(1);
    });

    it('maps an undefined (dismissed) result to false', async () => {
      matDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      const result = await new Promise<boolean>(resolve => {
        service.confirmDeletion().subscribe(resolve);
      });
      expect(result).toBe(false);
    });
  });

  describe('openHelp', () => {
    it('opens the HelpDialog component', () => {
      matDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      service.openHelp();
      expect(matDialog.open).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/pages/dfd/presentation/services/dfd-dialog.service.spec.ts`
Expected: FAIL — cannot resolve `./dfd-dialog.service`.

- [ ] **Step 3: Write the service**

Create `dfd-dialog.service.ts`. Inject `MatDialog`. Add one method per dialog. Skeleton — fill the `open` config and return shape from the corresponding component source:

```typescript
import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ConfirmActionDialogComponent,
  ConfirmActionDialogResult,
} from '../../../../shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { HelpDialogComponent } from '../components/help-dialog/help-dialog.component';
import {
  HistoryDialogComponent,
  HistoryDialogData,
} from '../components/history-dialog/history-dialog.component';
import {
  GraphDataDialogComponent,
  GraphDataDialogData,
} from '../components/graph-data-dialog/graph-data-dialog.component';
import {
  ClipboardDialogComponent,
  ClipboardDialogData,
} from '../components/clipboard-dialog/clipboard-dialog.component';
import {
  CellPropertiesDialogComponent,
  CellPropertiesDialogData,
} from '../components/cell-properties-dialog/cell-properties-dialog.component';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '../../../tm/components/metadata-dialog/metadata-dialog.component';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../../../tm/components/threat-editor-dialog/threat-editor-dialog.component';
import {
  ThreatsDialogComponent,
  ThreatsDialogData,
} from '../../../tm/components/threats-dialog/threats-dialog.component';

/**
 * Single MatDialog seam for the DFD editor. Every DFD-owned dialog opens
 * through one of these methods so consumers (and tests) never touch MatDialog
 * directly. Mirrors TmDialogService.
 */
@Injectable({ providedIn: 'root' })
export class DfdDialogService {
  constructor(private dialog: MatDialog) {}

  /** Confirm a deletion that would lose cell metadata. Resolves true to proceed. */
  confirmDeletion(): Observable<boolean> {
    return this.dialog
      .open(ConfirmActionDialogComponent, {
        width: '450px',
        data: {
          title: 'editor.deleteMetadataWarning.title',
          message: 'editor.deleteMetadataWarning.message',
          confirmLabel: 'editor.deleteMetadataWarning.confirm',
          confirmIsDestructive: true,
        },
        disableClose: true,
      })
      .afterClosed()
      .pipe(map((result: ConfirmActionDialogResult | undefined) => result?.confirmed ?? false));
  }

  /** Open the keyboard-shortcuts / help dialog. */
  openHelp(): MatDialogRef<HelpDialogComponent> {
    // Copy the open() config from dfd.component.ts showHelp().
    return this.dialog.open(HelpDialogComponent, {
      /* ...config from showHelp()... */
    });
  }

  // openHistory(data: HistoryDialogData): MatDialogRef<HistoryDialogComponent>
  // openGraphData(data: GraphDataDialogData): MatDialogRef<GraphDataDialogComponent>
  // openClipboard(data: ClipboardDialogData): MatDialogRef<ClipboardDialogComponent>
  // openCellProperties(data: CellPropertiesDialogData): MatDialogRef<CellPropertiesDialogComponent>
  // openMetadata(data: MetadataDialogData): MatDialogRef<MetadataDialogComponent>
  // openThreatEditor(data: ThreatEditorDialogData): MatDialogRef<ThreatEditorDialogComponent>
  // openThreats(data: ThreatsDialogData): MatDialogRef<ThreatsDialogComponent>
  //
  // Implement each by lifting the exact this.dialog.open(...) call from the
  // matching component method. Return the MatDialogRef so callers keep their
  // existing afterClosed()/componentInstance access.
}
```

> **Implementer:** the `// openHistory ...` comment block above is a checklist of
> the remaining methods to add. For each, lift the `this.dialog.open(...)`
> argument list verbatim from the component method named in the Source line, and
> return the `MatDialogRef` (do not call `afterClosed()` inside the service
> except for `confirmDeletion`, which the component currently consumes as an
> `Observable<boolean>`). Add a focused `*.spec.ts` case per method asserting
> `matDialog.open` was called with the expected component and `data`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/app/pages/dfd/presentation/services/dfd-dialog.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Verification gate**

```
pnpm run lint:all
pnpm run build
pnpm test -- src/app/pages/dfd/presentation/services/dfd-dialog.service.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/dfd/presentation/services/dfd-dialog.service.ts src/app/pages/dfd/presentation/services/dfd-dialog.service.spec.ts
git commit -m "refactor: add DfdDialogService MatDialog seam (#694)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Create DfdCommandService and rewire component dialog handlers

`DfdCommandService` holds the post-dialog orchestration that does not need the
live X6 graph or `cdr`: navigation (`_navigateAway`, `_fallbackSaveAndNavigate`),
threat creation (`_createThreat`), and the SVG-thumbnail capture
(`_captureDiagramSvgThumbnail`). It injects `Router`, `LoggerService`,
`ThreatModelService`, and whatever the thumbnail capture needs.

The component's `showHistory` / `showGraphData` / `showHelp` / `showClipboard` /
`showCellProperties` / `manageMetadata` / `onEditMetadata` / `openThreatEditor` /
`manageThreats` / `closeDiagram` become thin: they gather graph state, call
`DfdDialogService.open*`, and on `afterClosed()` either apply results to the
graph (stays in component — needs `executeOperation` + `cdr`) or call a
`DfdCommandService` method for the non-graph parts.

**Files:**
- Create: `src/app/pages/dfd/presentation/services/dfd-command.service.ts`
- Create: `src/app/pages/dfd/presentation/services/dfd-command.service.spec.ts`
- Modify: `dfd.component.ts`
- Source: `_navigateAway` (`:4025-4043`), `_fallbackSaveAndNavigate` (`:1728-`), `_createThreat` (`:4048-`), `_captureDiagramSvgThumbnail` (`:1747-`), and `closeDiagram` (`:1686-`).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DfdCommandService } from './dfd-command.service';

describe('DfdCommandService', () => {
  let service: DfdCommandService;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    router = { navigate: vi.fn().mockResolvedValue(true) };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    service = new DfdCommandService(router as any, logger as any, {} as any);
  });

  describe('navigateAway', () => {
    it('navigates to the threat model with a refresh query param when a tm id is given', () => {
      service.navigateAway('tm-123');
      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-123'], {
        queryParams: { refresh: 'true' },
      });
    });

    it('navigates to the dashboard when no tm id is given', () => {
      service.navigateAway(null);
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/pages/dfd/presentation/services/dfd-command.service.spec.ts`
Expected: FAIL — cannot resolve `./dfd-command.service`.

- [ ] **Step 3: Write the service**

Create `dfd-command.service.ts`. Constructor params in the order the test uses them: `Router`, `LoggerService`, `ThreatModelService`. Move `_navigateAway` in verbatim as the public `navigateAway(threatModelId: string | null)`, `_createThreat` as `createThreat(threatModelId: string, threatData: ...)`, and `_captureDiagramSvgThumbnail` as a public method (it needs a graph adapter / export service — pass those it as method parameters rather than injecting, so the service stays graph-agnostic). Keep all `logger` calls.

> **Implementer:** read the four source methods named in the Source line and move
> their bodies. `navigateAway` must keep both the success path and the
> dashboard-fallback `.catch`. `createThreat` keeps the full API payload mapping.
> For `captureDiagramSvgThumbnail`, take the graph adapter and export service as
> parameters; do not inject `AppDfdOrchestrator` into this service.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/app/pages/dfd/presentation/services/dfd-command.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Rewire the component**

In `dfd.component.ts`:
1. Inject `DfdDialogService` and `DfdCommandService`.
2. Replace each `this.dialog.open(...)` in `showHistory` / `showGraphData` / `showHelp` / `showClipboard` / `showCellProperties` / `manageMetadata` / `onEditMetadata` / `openThreatEditor` / `manageThreats` with the matching `this.dfdDialog.open*(...)` call. The `afterClosed()` subscription and any `executeOperation` / `cdr.detectChanges()` inside the handler **stay in the component**.
3. Delete `_navigateAway`, `_fallbackSaveAndNavigate`, `_createThreat`, `_captureDiagramSvgThumbnail` from the component; replace callers with `this.dfdCommand.*`. For `_confirmDeletionIfNeeded`, replace its body with `return this.dfdDialog.confirmDeletion()` when metadata is present (keep the `_selectedCellsHaveMetadata` short-circuit in the component — it reads the live graph).
4. Remove the now-unused `MatDialog` import / injection only if no other component method still calls `this.dialog` directly — verify with `rg -n 'this\.dialog' src/app/pages/dfd/presentation/components/dfd.component.ts`.

- [ ] **Step 6: Verification gate**

```
pnpm run lint:all
pnpm run build
pnpm test -- src/app/pages/dfd/presentation/services/dfd-command.service.spec.ts
pnpm test -- src/app/pages/dfd/presentation/services/dfd-dialog.service.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/dfd/presentation/services/dfd-command.service.ts src/app/pages/dfd/presentation/services/dfd-command.service.spec.ts src/app/pages/dfd/presentation/components/dfd.component.ts
git commit -m "refactor: add DfdCommandService, route DFD dialogs through DfdDialogService (#694)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — DfdLayoutService

> **Before starting Phase 3:** read the full source of every layout method so
> the move is verbatim. Run:
> `rg -n 'applyAutoLayout|applyContainerFit|applyIconOnlyFit|cascadeContainerLayout|_runLayoutCycle|revertAutoFit|applyAutoLayoutToAllEligibleCells|revertAutoFitOnAllAutoFitCells|_buildChildBox|_resolveLayoutOrientation|_clearVerticesOfConnectedEdges|_setAbsoluteIconAttrs|_setAbsoluteLabelAttrs' src/app/pages/dfd/presentation/components/dfd.component.ts`
> and read each body. These methods already delegate the pure math to
> `dfd/utils/auto-layout.util.ts` — the service holds only the cell read/write
> glue around those util calls.

### Task 6: Create DfdLayoutService with a pure-math first test

Start with the most self-contained method to validate the `LayoutCell` fake
pattern before moving the recursive `_runLayoutCycle`.

**Files:**
- Create: `src/app/pages/dfd/presentation/services/dfd-layout.service.ts`
- Create: `src/app/pages/dfd/presentation/services/dfd-layout.service.spec.ts`

- [ ] **Step 1: Write the failing test for applyIconOnlyFit**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DfdLayoutService } from './dfd-layout.service';
import type { LayoutCell } from '../../types/layout-cell.types';

function fakeCell(overrides: Partial<Record<string, unknown>> = {}): LayoutCell & {
  __data: Record<string, unknown>;
  __size: { width: number; height: number };
} {
  const state = {
    __data: (overrides['data'] as Record<string, unknown>) ?? {},
    __size: (overrides['size'] as { width: number; height: number }) ?? { width: 0, height: 0 },
  };
  return {
    ...state,
    id: (overrides['id'] as string) ?? 'cell-1',
    shape: (overrides['shape'] as string) ?? 'process',
    getData: () => state.__data,
    setData: (d: Record<string, unknown>) => {
      state.__data = d;
    },
    getSize: () => state.__size,
    resize: (w: number, h: number) => {
      state.__size = { width: w, height: h };
    },
    getPosition: () => ({ x: 0, y: 0 }),
    setPosition: () => {},
    getChildren: () => null,
    getParent: () => null,
    getAttrs: () => ({}),
    getAttrByPath: () => undefined,
    setAttrByPath: () => {},
    getZIndex: () => 0,
    isVisible: () => true,
    isNode: () => true,
    isEdge: () => false,
    getPorts: () => [],
  } as LayoutCell & { __data: Record<string, unknown>; __size: { width: number; height: number } };
}

describe('DfdLayoutService', () => {
  let service: DfdLayoutService;
  let userPrefs: { getPreferences: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    userPrefs = {
      getPreferences: vi.fn().mockReturnValue({
        autoLayoutEnabled: true,
        showShapeBordersWithIcons: false,
      }),
    };
    service = new DfdLayoutService(userPrefs as any);
  });

  describe('applyIconOnlyFit', () => {
    it('returns false for a shape that is not icon-hideable', () => {
      const cell = fakeCell({ shape: 'text-box' });
      expect(service.applyIconOnlyFit(cell)).toBe(false);
    });

    it('returns false when showShapeBordersWithIcons is true', () => {
      userPrefs.getPreferences.mockReturnValue({
        autoLayoutEnabled: true,
        showShapeBordersWithIcons: true,
      });
      const cell = fakeCell({ shape: 'process' });
      expect(service.applyIconOnlyFit(cell)).toBe(false);
    });
  });
});
```

> **Implementer:** the assertions above are the minimum. After moving the method
> bodies (Step 3), extend the spec to cover, for each method, at least the
> happy path and the early-return guards. Reuse `fakeCell`. For methods that read
> children, give the fake a `getChildren` returning an array of `fakeCell`s.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/pages/dfd/presentation/services/dfd-layout.service.spec.ts`
Expected: FAIL — cannot resolve `./dfd-layout.service`.

- [ ] **Step 3: Write the service — move all layout methods**

Create `dfd-layout.service.ts`. Inject `UserPreferencesService`. Move the
following methods from the component **verbatim**, retyping the cell/graph
parameters from `any` to `LayoutCell` / `LayoutGraph`:

`applyAutoLayout`, `applyContainerFit`, `applyIconOnlyFit`, `cascadeContainerLayout`,
`applyAutoLayoutToAllEligibleCells`, `_buildChildBox` (→ `buildChildBox`),
`_resolveLayoutOrientation` (→ `resolveLayoutOrientation`),
`_clearVerticesOfConnectedEdges` (→ `clearVerticesOfConnectedEdges`),
`_setAbsoluteIconAttrs` (→ `setAbsoluteIconAttrs`), `_setAbsoluteLabelAttrs` (→ `setAbsoluteLabelAttrs`),
`_buildIconColumn` (private helper of `applyContainerFit`).

> **Plan adjustment (made during Task 6 execution).** Two methods originally
> listed here were moved to Task 7:
> - **`_runLayoutCycle` stays in the component** as a thin private orchestrator.
>   It contains two `executeOperation` dispatches plus the `_inLayoutCycle` flag
>   and `previousStates` history capture — none of which may leave the component
>   per the governing principle. It calls `this.dfdLayout.applyAutoLayout()` /
>   `cascadeContainerLayout()` for the pure steps. Not renamed.
> - **`revertAutoFit` / `revertAutoFitOnAllAutoFitCells` move in Task 7**, not
>   here — they call `applyIconToCell`, which depends on `ArchitectureIconService`
>   and belongs to `DfdIconService`. Injecting that service into
>   `DfdLayoutService` would duplicate icon logic across two services.

Keep the existing imports from `../../utils/auto-layout.util`, `../../constants/styling-constants`, `../../utils/layout-lock.util`, `../../types/icon-placement.types`. Replace `this.userPreferencesService` with `this.userPreferences`. Rename private (`_`-prefixed) methods by dropping the prefix when they become public service methods; keep methods that stay internal as `private`.

> If a moved method calls a cell member not on `LayoutCell` (e.g. an edge's
> `getSourceCellId`), add that member to `layout-cell.types.ts` and note it in
> the commit body.

- [ ] **Step 4: Extend the spec and run it**

Add the happy-path and guard cases described in the Step 1 note. Run:
`pnpm test -- src/app/pages/dfd/presentation/services/dfd-layout.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Delegate from the component**

In `dfd.component.ts`:
1. Inject `DfdLayoutService` as `private dfdLayout`.
2. Delete the moved methods from the component.
3. Replace every caller. Find them: `rg -n 'applyAutoLayout|applyContainerFit|applyIconOnlyFit|cascadeContainerLayout|_runLayoutCycle|revertAutoFit|applyAutoLayoutToAllEligibleCells|revertAutoFitOnAllAutoFitCells|_buildChildBox|_resolveLayoutOrientation|_clearVerticesOfConnectedEdges|_setAbsolute' src/app/pages/dfd/presentation/components/dfd.component.ts`. Each becomes `this.dfdLayout.<renamedMethod>(...)`.
4. **Do not** move the `_inLayoutCycle` flag — it stays a component field. The component sets/clears it around layout dispatch; the service methods run inside the guarded region.

- [ ] **Step 6: Verification gate**

```
pnpm run lint:all
pnpm run build
pnpm test -- src/app/pages/dfd/presentation/services/dfd-layout.service.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/dfd/presentation/services/dfd-layout.service.ts src/app/pages/dfd/presentation/services/dfd-layout.service.spec.ts src/app/pages/dfd/presentation/components/dfd.component.ts src/app/pages/dfd/types/layout-cell.types.ts
git commit -m "refactor: extract auto-layout glue into DfdLayoutService (#694)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — DfdIconService

> **Before starting Phase 4:** read the source of every icon method. Run:
> `rg -n 'applyIconToCell|restoreLabelDefaults|restoreBorder|applyBorderPreference|applyIconsOnLoad|applyLockBadge|reapplyBorderPreferenceToAllIconnedCells|_captureCellStateForHistory' src/app/pages/dfd/presentation/components/dfd.component.ts`
> and read each body.

### Task 7: Create DfdIconService

**Files:**
- Create: `src/app/pages/dfd/presentation/services/dfd-icon.service.ts`
- Create: `src/app/pages/dfd/presentation/services/dfd-icon.service.spec.ts`
- Modify: `dfd.component.ts`

- [ ] **Step 1: Write the failing test — focus on the history snapshot**

`_captureCellStateForHistory` is the highest-risk method (see spec Risks). Test it first and assert the full snapshot shape.

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DfdIconService } from './dfd-icon.service';
import type { LayoutCell } from '../../types/layout-cell.types';

describe('DfdIconService', () => {
  let service: DfdIconService;
  let userPrefs: { getPreferences: ReturnType<typeof vi.fn> };
  let architectureIcon: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    userPrefs = {
      getPreferences: vi.fn().mockReturnValue({ showShapeBordersWithIcons: true }),
    };
    architectureIcon = {}; // add methods as the moved code requires
    service = new DfdIconService(userPrefs as any, architectureIcon as any);
  });

  describe('captureCellStateForHistory', () => {
    it('captures every tracked cell field as a plain JSON snapshot', () => {
      const cell = {
        id: 'n1',
        shape: 'process',
        getPosition: () => ({ x: 10, y: 20 }),
        getSize: () => ({ width: 100, height: 60 }),
        getAttrs: () => ({ body: { fill: '#fff' } }),
        getPorts: () => [{ id: 'p1' }],
        getData: () => ({ _arch: { name: 'x' } }),
        isVisible: () => true,
        getZIndex: () => 3,
        getParent: () => null,
      } as unknown as LayoutCell;

      const snapshot = service.captureCellStateForHistory(cell) as Record<string, unknown>;

      expect(snapshot).toEqual({
        id: 'n1',
        shape: 'process',
        position: { x: 10, y: 20 },
        size: { width: 100, height: 60 },
        attrs: { body: { fill: '#fff' } },
        ports: [{ id: 'p1' }],
        data: { _arch: { name: 'x' } },
        visible: true,
        zIndex: 3,
        parent: undefined,
      });
    });

    it('records the parent id when the cell is embedded in a node', () => {
      const parent = { id: 'container', isNode: () => true } as unknown as LayoutCell;
      const cell = {
        id: 'n2',
        shape: 'store',
        getPosition: () => ({ x: 0, y: 0 }),
        getSize: () => ({ width: 1, height: 1 }),
        getAttrs: () => ({}),
        getPorts: () => [],
        getData: () => ({}),
        isVisible: () => true,
        getZIndex: () => 0,
        getParent: () => parent,
      } as unknown as LayoutCell;

      const snapshot = service.captureCellStateForHistory(cell) as Record<string, unknown>;
      expect(snapshot['parent']).toBe('container');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/pages/dfd/presentation/services/dfd-icon.service.spec.ts`
Expected: FAIL — cannot resolve `./dfd-icon.service`.

- [ ] **Step 3: Write the service**

Create `dfd-icon.service.ts`. Inject `UserPreferencesService`, `ArchitectureIconService`, and `DfdLayoutService`. Move verbatim, retyping `any` cell params to `LayoutCell`:

`_captureCellStateForHistory` (→ `captureCellStateForHistory`), `applyIconToCell`,
`restoreLabelDefaults`, `restoreBorder`, `applyBorderPreference`, `applyIconsOnLoad`
(takes a `LayoutGraph`), `applyLockBadge`, `reapplyBorderPreferenceToAllIconnedCells`
(takes a `LayoutGraph` + `boolean`).

> **Plan adjustment (carried over from Task 6).** `revertAutoFit` and
> `revertAutoFitOnAllAutoFitCells` move here too — they were deferred from Task 6
> because they call `applyIconToCell` (an icon method that belongs in this
> service). Move both verbatim into `DfdIconService`. `revertAutoFit` reads shape
> config / arch data and calls `applyIconToCell`; `revertAutoFitOnAllAutoFitCells`
> iterates graph nodes and calls `revertAutoFit`. They also call layout helpers
> (`applyIconOnlyFit` / `applyContainerFit` are NOT among them — verify) — if
> `revertAutoFit` needs a `DfdLayoutService` method, that is why `DfdLayoutService`
> is injected here. Delegate component callers of both to `this.dfdIcon.*`.

Keep imports from `../../types/arch-icon.types`, `../../types/icon-placement.types`, `../../utils/layout-lock.util`, `../../constants/styling-constants`.

> **Risk gate:** verify `LayoutCell` exposes every getter `captureCellStateForHistory`
> reads (`id`, `shape`, `getPosition`, `getSize`, `getAttrs`, `getPorts`,
> `getData`, `isVisible`, `getZIndex`, `getParent`). The test in Step 1 asserts
> the full shape — if it passes, the seam is complete. If `getParent().isNode()`
> is read, `LayoutCell.getParent()` already returns `LayoutCell | null` and
> `LayoutCell` has `isNode()` — good.

- [ ] **Step 4: Extend the spec and run it**

Add happy-path + guard cases for `applyIconToCell`, `restoreBorder`, `applyBorderPreference`, `applyLockBadge` (reuse the `fakeCell` helper from `dfd-layout.service.spec.ts` — copy it in, or extract a shared `src/testing/dfd/fake-cell.ts` if you prefer; if extracting, do it as its own step and update the layout spec import). Run:
`pnpm test -- src/app/pages/dfd/presentation/services/dfd-icon.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Delegate from the component**

Inject `DfdIconService` as `private dfdIcon`. Delete the moved methods. Replace callers — find with `rg -n 'applyIconToCell|restoreLabelDefaults|restoreBorder|applyBorderPreference|applyIconsOnLoad|applyLockBadge|reapplyBorderPreferenceToAllIconnedCells|_captureCellStateForHistory' src/app/pages/dfd/presentation/components/dfd.component.ts`. `onIconSelected` / `onIconRemoved` / `onIconPlacementChanged` keep their `executeOperation(...).subscribe()` and `cdr.detectChanges()`; only the cell-mutation calls become `this.dfdIcon.*`.

- [ ] **Step 6: Verification gate**

```
pnpm run lint:all
pnpm run build
pnpm test -- src/app/pages/dfd/presentation/services/dfd-icon.service.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/dfd/presentation/services/dfd-icon.service.ts src/app/pages/dfd/presentation/services/dfd-icon.service.spec.ts src/app/pages/dfd/presentation/components/dfd.component.ts src/app/pages/dfd/types/layout-cell.types.ts
git commit -m "refactor: extract icon application into DfdIconService (#694)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — DfdStylingService

> **Before starting Phase 5:** read the source. Run:
> `rg -n 'applyNodeStyleChange|applyEdgeStyleChange|onClearCustomFormatting|updateStylePanelCells|updateIconPickerCells' src/app/pages/dfd/presentation/components/dfd.component.ts`
> and read each body.

### Task 8: Create DfdStylingService

The two `update*Cells` methods have two halves: a *computation* half (build the
`CellStyleInfo[]` / `IconPickerCellInfo[]` from graph cells) and an *assignment*
half (`this.stylePanelCells = ...; this.cdr.detectChanges()`). Only the
computation half moves; the service exposes `buildStylePanelCells(graph)` and
`buildIconPickerCells(graph)` returning the arrays, and the component assigns +
detects changes.

**Files:**
- Create: `src/app/pages/dfd/presentation/services/dfd-styling.service.ts`
- Create: `src/app/pages/dfd/presentation/services/dfd-styling.service.spec.ts`
- Modify: `dfd.component.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { DfdStylingService } from './dfd-styling.service';
import type { LayoutGraph } from '../../types/layout-cell.types';

describe('DfdStylingService', () => {
  let service: DfdStylingService;

  beforeEach(() => {
    service = new DfdStylingService();
  });

  describe('buildStylePanelCells', () => {
    it('returns an empty array when the graph has no nodes', () => {
      const graph = { getNodes: () => [], getEdges: () => [], getCellById: () => null } as LayoutGraph;
      expect(service.buildStylePanelCells(graph)).toEqual([]);
    });
  });
});
```

> **Implementer:** after Step 3, extend the spec with a graph fake containing a
> node and an edge, and assert the returned `CellStyleInfo` fields match the
> values the moved computation produces.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/pages/dfd/presentation/services/dfd-styling.service.spec.ts`
Expected: FAIL — cannot resolve `./dfd-styling.service`.

- [ ] **Step 3: Write the service**

Create `dfd-styling.service.ts`. No constructor dependencies expected (styling reads constants directly — confirm against source; inject `UserPreferencesService` only if a moved method reads it). Add:
- `applyNodeStyleChange(cell: LayoutCell, event: StyleChangeEvent): void` — moved verbatim.
- `applyEdgeStyleChange(cell: LayoutCell, event: StyleChangeEvent): void` — moved verbatim.
- `clearCustomFormatting(cell: LayoutCell): void` — the per-cell body of `onClearCustomFormatting`'s loop.
- `buildStylePanelCells(graph: LayoutGraph): CellStyleInfo[]` — the computation half of `updateStylePanelCells`.
- `buildIconPickerCells(graph: LayoutGraph): IconPickerCellInfo[]` — the computation half of `updateIconPickerCells`.

Keep imports for `StyleChangeEvent` / `CellStyleInfo` (from `../components/style-panel/style-panel.component`) and `IconPickerCellInfo` (from `../components/icon-picker-panel/icon-picker-panel.component`).

> **Note:** if `applyNodeStyleChange` contains an `executeOperation(...).subscribe()`
> call (the source at `:3765` references a `result` — check), that dispatch must
> **stay in the component**. In that case the service method returns the
> computed attrs/updates and the component performs the dispatch. Decide based
> on the actual source: pure cell mutation → service; orchestrator dispatch →
> component.

- [ ] **Step 4: Extend the spec and run it**

Run: `pnpm test -- src/app/pages/dfd/presentation/services/dfd-styling.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Delegate from the component**

Inject `DfdStylingService` as `private dfdStyling`. In `updateStylePanelCells` / `updateIconPickerCells`, replace the computation with `this.stylePanelCells = this.dfdStyling.buildStylePanelCells(graph)` / `this.iconPickerCells = this.dfdStyling.buildIconPickerCells(graph)`, keeping the `cdr.detectChanges()`. In `onStyleChange` / `onClearCustomFormatting`, replace the per-cell logic with service calls; keep the cell loop, `executeOperation` dispatch, and `cdr` in the component.

- [ ] **Step 6: Verification gate**

```
pnpm run lint:all
pnpm run build
pnpm test -- src/app/pages/dfd/presentation/services/dfd-styling.service.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/dfd/presentation/services/dfd-styling.service.ts src/app/pages/dfd/presentation/services/dfd-styling.service.spec.ts src/app/pages/dfd/presentation/components/dfd.component.ts
git commit -m "refactor: extract styling logic into DfdStylingService (#694)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6 — Finalize

### Task 9: Full-suite verification and issue closeout

- [ ] **Step 1: Run the full DFD test suite**

Run: `pnpm test -- src/app/pages/dfd`
Expected: PASS — all DFD specs, including the six new service specs.

- [ ] **Step 2: Run lint and build once more**

```
pnpm run lint:all
pnpm run build
```
Expected: both PASS.

- [ ] **Step 3: Run the DFD E2E workflows suite**

Run: `pnpm test:e2e -- --grep dfd`
Expected: PASS. If a visual-regression screenshot test fails, invoke the
`visual-regression-triage` skill (per `.claude/CLAUDE.md`).

- [ ] **Step 4: Confirm the component shrank as designed**

Run: `wc -l src/app/pages/dfd/presentation/components/dfd.component.ts`
Expected: meaningfully below 4,082 (target ~2,300–2,600 — Category D plus the
thin delegating glue). If it is still near 4,000, a phase did not delete the
moved source — investigate before closing.

- [ ] **Step 5: Run the code-review skill**

Invoke `superpowers:requesting-code-review` against the branch changes (per
`.claude/CLAUDE.md` task-completion requirements). Address any findings.

- [ ] **Step 6: Close the GitHub issue**

```bash
gh issue comment 694 --repo ericfitz/tmi-ux --body "Completed on dev/1.4.0. Extracted DfdNodeTypeService, DfdDialogService, DfdCommandService, DfdLayoutService, DfdIconService, and DfdStylingService from dfd.component.ts, with the LayoutCell/LayoutGraph test seam. Each service has a Vitest spec."
gh issue close 694 --repo ericfitz/tmi-ux --reason completed
```

---

## Self-Review Notes

- **Spec coverage:** all six services (A: `DfdNodeTypeService`; B: `DfdLayoutService`/`DfdIconService`/`DfdStylingService`; C: `DfdDialogService`/`DfdCommandService`) plus the `layout-cell.types.ts` seam have tasks. The five phases match the spec's phasing. Category D explicitly stays in the component (stated in Tasks 3, 5, 6, 7, 8 — `executeOperation`/`cdr`/`_inLayoutCycle` never move).
- **Risk coverage:** the snapshot-completeness risk has a dedicated full-shape assertion (Task 7 Step 1); the preference/constant coupling is handled by injecting `UserPreferencesService` and keeping constant imports (Tasks 6, 7); the `_inLayoutCycle` guard is explicitly pinned to the component (Task 6 Step 5).
- **Known plan-level deferral:** Tasks 4, 6, 7, 8 instruct the implementer to read and move method bodies verbatim rather than reproducing ~1,800 lines of source inline. This is deliberate — the bodies are a mechanical `any`→`LayoutCell` retype of existing, working code, and reproducing them risks transcription drift from the live source. Each such task names the exact methods, source line ranges, the `rg` command to locate them, and the service skeleton + test code. If the executing engineer is a subagent without judgment latitude, treat the "read the source, move verbatim" steps as: open the named lines, copy the body, change only the parameter types and `this.<injected>` references.
