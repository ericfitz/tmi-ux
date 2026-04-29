# Per-Shape Layout Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-cell "layout lock" that opts a single DFD shape out of every auto-layout pass, exposed via a context-menu toggle and shown on the cell as a lock badge at the bottom-right corner.

**Architecture:** A boolean tag `cell.data._layoutLocked` is checked at five sites in `dfd.component.ts` (the existing auto-layout entry points and global toggle paths). When set, the cell is skipped over and cascade walks stop at it. The badge is added to the existing shape markup as a fourth element (alongside body/icon/text), with visibility driven by the same data flag. A new context-menu item toggles the flag; lock and unlock are each one undoable history operation.

**Tech Stack:** Angular standalone components, X6 graphing library (custom shape markup), Vitest for unit tests, Transloco for i18n, pnpm scripts for build/lint/test, `check-i18n.py` for locale file sync.

**Spec:** [docs/superpowers/specs/2026-04-27-per-shape-layout-lock-design.md](../specs/2026-04-27-per-shape-layout-lock-design.md)

**Issue:** [#641](https://github.com/ericfitz/tmi-ux/issues/641)

---

## File Structure

**New files:**
- `src/app/pages/dfd/utils/layout-lock.util.ts` — small pure helpers: `isCellLayoutLocked(cell)`, `LOCK_BADGE_ICON_HREF` constant (inline SVG data URL).
- `src/app/pages/dfd/utils/layout-lock.util.spec.ts` — unit tests for the helpers.

**Modified files:**
- `src/app/pages/dfd/infrastructure/adapters/infra-x6-shape-definitions.ts` — add `lockBadge` markup element to actor / process / store / security-boundary shapes.
- `src/app/pages/dfd/presentation/components/dfd.component.ts` — wire lock checks at five sites; add `applyLockBadge`, `selectedCellIsLockEligible`, `rightClickedCellIsLocked`, `toggleLayoutLock`.
- `src/app/pages/dfd/presentation/components/dfd.component.html` — add context-menu item.
- `src/assets/i18n/en-US.json` — add `contextMenu.lockLayout` and `contextMenu.unlockLayout` keys.
- 16 other locale files in `src/assets/i18n/` — synced via `pnpm check-i18n`.

---

## Task 1: Lock helper utility

**Goal:** Pure, testable utility that exposes `isCellLayoutLocked(cell)` and the lock-badge icon URL constant. Centralizes the "is this cell locked?" check so the five integration sites don't re-implement it.

**Files:**
- Create: `src/app/pages/dfd/utils/layout-lock.util.ts`
- Test: `src/app/pages/dfd/utils/layout-lock.util.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/pages/dfd/utils/layout-lock.util.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isCellLayoutLocked, LOCK_BADGE_ICON_HREF } from './layout-lock.util';

describe('layout-lock.util', () => {
  describe('isCellLayoutLocked', () => {
    function makeCell(data: unknown): { getData: () => unknown } {
      return { getData: () => data };
    }

    it('returns false when cell has no data', () => {
      expect(isCellLayoutLocked(makeCell(null))).toBe(false);
      expect(isCellLayoutLocked(makeCell(undefined))).toBe(false);
    });

    it('returns false when cell has data but no _layoutLocked field', () => {
      expect(isCellLayoutLocked(makeCell({}))).toBe(false);
      expect(isCellLayoutLocked(makeCell({ _arch: { kind: 'aws' } }))).toBe(false);
    });

    it('returns true when cell.data._layoutLocked is true', () => {
      expect(isCellLayoutLocked(makeCell({ _layoutLocked: true }))).toBe(true);
    });

    it('returns false when cell.data._layoutLocked is false', () => {
      expect(isCellLayoutLocked(makeCell({ _layoutLocked: false }))).toBe(false);
    });

    it('returns false when cell is null or undefined', () => {
      expect(isCellLayoutLocked(null)).toBe(false);
      expect(isCellLayoutLocked(undefined)).toBe(false);
    });

    it('returns false when cell has no getData method', () => {
      expect(isCellLayoutLocked({})).toBe(false);
    });
  });

  describe('LOCK_BADGE_ICON_HREF', () => {
    it('is an SVG data URL', () => {
      expect(LOCK_BADGE_ICON_HREF).toMatch(/^data:image\/svg\+xml/);
    });

    it('contains a path element (the lock glyph)', () => {
      expect(LOCK_BADGE_ICON_HREF).toContain('path');
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/app/pages/dfd/utils/layout-lock.util.spec.ts`

Expected: FAIL — `Cannot find module './layout-lock.util'` (or equivalent module-not-found error).

- [ ] **Step 3: Implement the utility**

Create `src/app/pages/dfd/utils/layout-lock.util.ts`:

```ts
/**
 * Per-cell layout-lock helpers (#641).
 *
 * The lock is a tag on cell.data: `_layoutLocked: true` when locked, absent otherwise.
 * Reading: `isCellLayoutLocked(cell)`. Writing is done in dfd.component via setData.
 */

const LOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <circle cx="12" cy="12" r="11" fill="white" stroke="white" stroke-width="2"/>
  <path fill="#666" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/>
</svg>`;

/**
 * The href used for the lock-badge image element on cells. Inlined SVG data URL
 * so the badge has zero asset-loading dependencies and renders immediately.
 */
export const LOCK_BADGE_ICON_HREF = `data:image/svg+xml;utf8,${encodeURIComponent(LOCK_SVG)}`;

/**
 * Returns true if the cell's data contains `_layoutLocked: true`.
 *
 * Tolerates null/undefined cells, cells without getData, and cells with empty data.
 * Used at every auto-layout entry point and cascade walk to gate layout effects.
 */
export function isCellLayoutLocked(cell: unknown): boolean {
  if (!cell || typeof (cell as { getData?: unknown }).getData !== 'function') {
    return false;
  }
  const data = (cell as { getData: () => unknown }).getData();
  if (!data || typeof data !== 'object') {
    return false;
  }
  return (data as { _layoutLocked?: unknown })._layoutLocked === true;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/app/pages/dfd/utils/layout-lock.util.spec.ts`

Expected: PASS — all 8 test cases green.

- [ ] **Step 5: Lint the new files**

Run: `pnpm run lint:all`

Expected: clean (formatting auto-applied by hooks). Fix any errors before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/dfd/utils/layout-lock.util.ts \
        src/app/pages/dfd/utils/layout-lock.util.spec.ts
git commit -m "feat(dfd): add layout-lock helper utility (#641)"
```

---

## Task 2: Wire lock checks at the five integration sites

**Goal:** Add `isCellLayoutLocked` checks at every auto-layout site so a locked cell is exempt from layout, cascade, and global preference toggles.

**Files:**
- Modify: `src/app/pages/dfd/presentation/components/dfd.component.ts`

These are private methods on a 3915-line component without a direct unit-test harness. Verification is via build + manual browser check (see Task 8). The changes are small and surgical — five small additions.

- [ ] **Step 1: Add the import**

In `src/app/pages/dfd/presentation/components/dfd.component.ts`, find the existing import block near the top of the file and add:

```ts
import { isCellLayoutLocked } from '../../utils/layout-lock.util';
```

(Place it alphabetically near the other `../../utils/` imports — there's already an `auto-layout.util` import.)

- [ ] **Step 2: Add lock check at `applyAutoLayout` entry**

Find the method around line 3111. Current first line:

```ts
private applyAutoLayout(cell: any, sortBy: 'ports' | 'position' = 'ports'): boolean {
  if (!this.userPreferencesService.getPreferences().autoLayoutEnabled) return false;
```

Insert the lock check immediately after the prefs check:

```ts
private applyAutoLayout(cell: any, sortBy: 'ports' | 'position' = 'ports'): boolean {
  if (!this.userPreferencesService.getPreferences().autoLayoutEnabled) return false;
  if (isCellLayoutLocked(cell)) return false;
```

- [ ] **Step 3: Add lock check at `cascadeContainerLayout`**

Find the method around line 3338. Current loop body:

```ts
private cascadeContainerLayout(startCell: any): void {
  let parent = startCell.getParent?.();
  while (parent) {
    const data = parent.getData?.() ?? {};
    const autoFit = data._archAutoFit as
      | { kind: 'icon-only' | 'container'; width: number; height: number }
      | undefined;
    if (!autoFit || autoFit.kind !== 'container') break;
    const allChildren = (parent.getChildren?.() ?? []) as any[];
    const layoutChildren = allChildren.filter(c => c.shape !== 'text-box');
    if (layoutChildren.length === 0) break;
    this.applyContainerFit(parent, layoutChildren, 'ports');
    parent = parent.getParent?.();
  }
}
```

Replace with the version that bails on a locked ancestor. Insert the locked check at the top of the loop body, before the autoFit check:

```ts
private cascadeContainerLayout(startCell: any): void {
  let parent = startCell.getParent?.();
  while (parent) {
    if (isCellLayoutLocked(parent)) break;
    const data = parent.getData?.() ?? {};
    const autoFit = data._archAutoFit as
      | { kind: 'icon-only' | 'container'; width: number; height: number }
      | undefined;
    if (!autoFit || autoFit.kind !== 'container') break;
    const allChildren = (parent.getChildren?.() ?? []) as any[];
    const layoutChildren = allChildren.filter(c => c.shape !== 'text-box');
    if (layoutChildren.length === 0) break;
    this.applyContainerFit(parent, layoutChildren, 'ports');
    parent = parent.getParent?.();
  }
}
```

- [ ] **Step 4: Add lock check at `_runLayoutCycle` ancestor capture**

Find the method around line 3361. The ancestor capture loop is around line 3375:

```ts
let ancestor = triggerCell.getParent?.();
while (ancestor) {
  const ancData = ancestor.getData?.() ?? {};
  const autoFit = ancData._archAutoFit as
    | { kind: 'icon-only' | 'container'; width: number; height: number }
    | undefined;
  if (!autoFit || autoFit.kind !== 'container') break;
  captureCell(ancestor);
  for (const child of (ancestor.getChildren?.() ?? []) as any[]) {
    captureCell(child);
  }
  ancestor = ancestor.getParent?.();
}
```

Insert the locked check at the top of the loop body (before `ancData`):

```ts
let ancestor = triggerCell.getParent?.();
while (ancestor) {
  if (isCellLayoutLocked(ancestor)) break;
  const ancData = ancestor.getData?.() ?? {};
  const autoFit = ancData._archAutoFit as
    | { kind: 'icon-only' | 'container'; width: number; height: number }
    | undefined;
  if (!autoFit || autoFit.kind !== 'container') break;
  captureCell(ancestor);
  for (const child of (ancestor.getChildren?.() ?? []) as any[]) {
    captureCell(child);
  }
  ancestor = ancestor.getParent?.();
}
```

- [ ] **Step 5: Add lock check at `applyAutoLayoutToAllEligibleCells`**

Find the method around line 3474. Current body:

```ts
private applyAutoLayoutToAllEligibleCells(): void {
  const graph = this.appDfdOrchestrator.getGraph;
  if (!graph) return;
  for (const node of graph.getNodes()) {
    const data = node.getData();
    const allChildren = (node.getChildren?.() ?? []) as any[];
    const hasLayoutChildren = allChildren.some(c => c.shape !== 'text-box');
    if (data?._arch || hasLayoutChildren) this.applyAutoLayout(node);
  }
}
```

Add the lock skip inside the loop:

```ts
private applyAutoLayoutToAllEligibleCells(): void {
  const graph = this.appDfdOrchestrator.getGraph;
  if (!graph) return;
  for (const node of graph.getNodes()) {
    if (isCellLayoutLocked(node)) continue;
    const data = node.getData();
    const allChildren = (node.getChildren?.() ?? []) as any[];
    const hasLayoutChildren = allChildren.some(c => c.shape !== 'text-box');
    if (data?._arch || hasLayoutChildren) this.applyAutoLayout(node);
  }
}
```

(Note: `applyAutoLayout` already early-returns on locked cells per Step 2, so this `continue` is technically redundant. Keeping it makes the intent clear at the call site and avoids a useless function call.)

- [ ] **Step 6: Add lock check at `revertAutoFitOnAllAutoFitCells`**

Find the method around line 3489:

```ts
private revertAutoFitOnAllAutoFitCells(): void {
  const graph = this.appDfdOrchestrator.getGraph;
  if (!graph) return;
  for (const node of graph.getNodes()) {
    const data = node.getData();
    if (data?._archAutoFit) this.revertAutoFit(node);
  }
}
```

Add the lock skip inside the loop:

```ts
private revertAutoFitOnAllAutoFitCells(): void {
  const graph = this.appDfdOrchestrator.getGraph;
  if (!graph) return;
  for (const node of graph.getNodes()) {
    if (isCellLayoutLocked(node)) continue;
    const data = node.getData();
    if (data?._archAutoFit) this.revertAutoFit(node);
  }
}
```

- [ ] **Step 7: Build to verify type-correctness**

Run: `pnpm run build`

Expected: build succeeds with no type errors. Fix any errors before continuing.

- [ ] **Step 8: Lint**

Run: `pnpm run lint:all`

Expected: clean. Fix any errors before continuing.

- [ ] **Step 9: Run unit tests**

Run: `pnpm test`

Expected: all pre-existing tests pass; the new layout-lock util test from Task 1 passes. Fix any failures before continuing.

- [ ] **Step 10: Commit**

```bash
git add src/app/pages/dfd/presentation/components/dfd.component.ts
git commit -m "feat(dfd): honor _layoutLocked in auto-layout entry points and cascade (#641)"
```

---

## Task 3: Add lock-badge markup to eligible shapes

**Goal:** Extend the X6 markup of the four eligible shapes (actor, process, store, security-boundary) with a `lockBadge` image element. Default `display: 'none'` so the badge is hidden until `_layoutLocked` flips on.

**Files:**
- Modify: `src/app/pages/dfd/infrastructure/adapters/infra-x6-shape-definitions.ts`

- [ ] **Step 1: Add lockBadge markup to the `actor` shape**

In `src/app/pages/dfd/infrastructure/adapters/infra-x6-shape-definitions.ts`, find the `actor` shape definition (around line 146). The `markup` array currently contains body/icon/text. Append a fourth element:

```ts
Shape.Rect.define({
  shape: 'actor',
  markup: [
    {
      tagName: 'rect',
      selector: 'body',
    },
    {
      tagName: 'image',
      selector: 'icon',
    },
    {
      tagName: 'text',
      selector: 'text',
    },
    {
      tagName: 'image',
      selector: 'lockBadge',
    },
  ],
  attrs: {
    body: {
      strokeWidth: DFD_STYLING.NODES.ACTOR.STROKE_WIDTH,
      stroke: DFD_STYLING.NODES.ACTOR.STROKE,
      fill: DFD_STYLING.NODES.ACTOR.FILL,
      rx: 0,
      ry: 0,
    },
    text: {
      refX: '50%',
      refY: '50%',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
      fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
      fill: DFD_STYLING.NODES.LABEL_TEXT_COLOR,
    },
    lockBadge: {
      width: 12,
      height: 12,
      refX: '100%',
      refY: '100%',
      refX2: -20,
      refY2: -20,
      display: 'none',
      pointerEvents: 'none',
    },
  },
});
```

The `lockBadge` block is inside `attrs` to give it default geometry (12×12, anchored 8px in from the bottom-right corner — the math is `refX2: -(8 inset + 12 size) = -20`) and a default `display: 'none'`. `pointerEvents: 'none'` keeps the badge from intercepting clicks.

- [ ] **Step 2: Add lockBadge markup to the `process` shape**

Find the `process` shape definition (around line 186). Apply the same pattern: append a `{ tagName: 'image', selector: 'lockBadge' }` to `markup`, and add a `lockBadge` block to `attrs`:

```ts
attrs: {
  body: { /* existing */ },
  text: { /* existing */ },
  lockBadge: {
    width: 12,
    height: 12,
    refX: '100%',
    refY: '100%',
    refX2: -20,
    refY2: -20,
    display: 'none',
    pointerEvents: 'none',
  },
},
```

- [ ] **Step 3: Add lockBadge markup to the `security-boundary` shape**

Find the `security-boundary` definition (around line 226). Apply the same pattern — append the markup element and the `lockBadge` attrs block.

- [ ] **Step 4: Add lockBadge markup to the `store` shape**

Find the `store` shape definition (around line 20). The `store` markup currently has `body`/`top`/`icon`/`text`. Append:

```ts
{
  tagName: 'image',
  selector: 'lockBadge',
},
```

…and add the `lockBadge` block to `attrs`:

```ts
attrs: {
  body: { /* existing */ },
  top: { /* existing */ },
  text: { /* existing */ },
  lockBadge: {
    width: 12,
    height: 12,
    refX: '100%',
    refY: '100%',
    refX2: -20,
    refY2: -20,
    display: 'none',
    pointerEvents: 'none',
  },
},
```

- [ ] **Step 5: Build**

Run: `pnpm run build`

Expected: build succeeds. Any type errors here are likely a typo in the `attrs` block — re-check brace matching.

- [ ] **Step 6: Lint**

Run: `pnpm run lint:all`

Expected: clean.

- [ ] **Step 7: Run unit tests**

Run: `pnpm test`

Expected: all tests pass. (Shape definitions are loaded at runtime; spec files that instantiate cells should still work because the new markup element is hidden by default.)

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/dfd/infrastructure/adapters/infra-x6-shape-definitions.ts
git commit -m "feat(dfd): add lock-badge markup element to lock-eligible shapes (#641)"
```

---

## Task 4: Implement `applyLockBadge` and wire to diagram load

**Goal:** Add a private `applyLockBadge(cell)` method on `DfdComponent` that sets the badge's `display` attr based on `_layoutLocked`, and call it from `applyIconsOnLoad` so the badge is restored after a save/reload.

**Files:**
- Modify: `src/app/pages/dfd/presentation/components/dfd.component.ts`

- [ ] **Step 1: Add the import for the icon constant**

Update the existing import from `layout-lock.util` (added in Task 2) to also import the icon constant:

```ts
import { isCellLayoutLocked, LOCK_BADGE_ICON_HREF } from '../../utils/layout-lock.util';
```

- [ ] **Step 2: Add the `applyLockBadge` private method**

Add this method to `DfdComponent` near the other shape-attr helpers (e.g., near `applyIconToCell` around line 3018, or near `_setAbsoluteIconAttrs` around line 3498 — pick whichever cluster reads more naturally; near `applyIconToCell` is fine):

```ts
/**
 * Sync the lock-badge markup on a cell to its `_layoutLocked` data flag.
 *
 * - When locked: sets the badge's `href` and shows it (display: '').
 * - When unlocked: hides the badge (display: 'none').
 *
 * Only eligible shapes (actor / process / store / security-boundary) have
 * the `lockBadge` markup element; calling this on other shapes is harmless —
 * `setAttrByPath` no-ops on a missing selector.
 */
private applyLockBadge(cell: any): void {
  const locked = isCellLayoutLocked(cell);
  if (locked) {
    cell.setAttrByPath('lockBadge/href', LOCK_BADGE_ICON_HREF);
    cell.setAttrByPath('lockBadge/display', '');
  } else {
    cell.setAttrByPath('lockBadge/display', 'none');
  }
}
```

- [ ] **Step 3: Call `applyLockBadge` from `applyIconsOnLoad`**

Find `applyIconsOnLoad` around line 3082. Current body:

```ts
private applyIconsOnLoad(): void {
  const graph = this.appDfdOrchestrator.getGraph;
  if (!graph) return;

  for (const node of graph.getNodes()) {
    const data = node.getData();
    const arch = data?._arch as ArchIconData | undefined;
    if (arch) {
      this.applyIconToCell(node, arch);
      this.applyBorderPreference(node);
    }
    // Auto-layout pass for both iconned cells and security boundaries with
    // embedded children. applyAutoLayout no-ops anything that isn't eligible.
    this.applyAutoLayout(node);
  }
}
```

Add a call to `applyLockBadge` per node:

```ts
private applyIconsOnLoad(): void {
  const graph = this.appDfdOrchestrator.getGraph;
  if (!graph) return;

  for (const node of graph.getNodes()) {
    const data = node.getData();
    const arch = data?._arch as ArchIconData | undefined;
    if (arch) {
      this.applyIconToCell(node, arch);
      this.applyBorderPreference(node);
    }
    // Auto-layout pass for both iconned cells and security boundaries with
    // embedded children. applyAutoLayout no-ops anything that isn't eligible.
    this.applyAutoLayout(node);
    // Sync lock badge visibility from persisted _layoutLocked.
    this.applyLockBadge(node);
  }
}
```

- [ ] **Step 4: Build**

Run: `pnpm run build`

Expected: build succeeds.

- [ ] **Step 5: Lint**

Run: `pnpm run lint:all`

Expected: clean.

- [ ] **Step 6: Run unit tests**

Run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/dfd/presentation/components/dfd.component.ts
git commit -m "feat(dfd): add applyLockBadge helper and wire to diagram load (#641)"
```

---

## Task 5: Context-menu state & template

**Goal:** Wire the context-menu item that toggles the lock — both the template and the two component getters that drive its visibility and label.

**Files:**
- Modify: `src/app/pages/dfd/presentation/components/dfd.component.ts`
- Modify: `src/app/pages/dfd/presentation/components/dfd.component.html`

- [ ] **Step 1: Add the import for `ICON_ELIGIBLE_SHAPES`**

In `dfd.component.ts`, find the existing imports block. There may already be an import from `arch-icon.types` — add `ICON_ELIGIBLE_SHAPES` to it. If there's no existing import:

```ts
import { ArchIconData, ICON_ELIGIBLE_SHAPES } from '../../types/arch-icon.types';
```

(If `ArchIconData` is already imported via that path, just add `ICON_ELIGIBLE_SHAPES` to the same import.)

- [ ] **Step 2: Add the two component fields**

Find the existing selection-state fields near line 278:

```ts
hasExactlyOneSelectedCell = false;
selectedCellIsTextBox = false;
selectedCellIsSecurityBoundary = false;
```

Add two new fields beside them:

```ts
hasExactlyOneSelectedCell = false;
selectedCellIsTextBox = false;
selectedCellIsSecurityBoundary = false;
selectedCellIsLockEligible = false;
rightClickedCellIsLocked = false;
```

- [ ] **Step 3: Compute `selectedCellIsLockEligible` in `updateSelectionState`**

Find `updateSelectionState` around line 2740. The relevant block reads the selected cell's shape and sets `selectedCellIsTextBox` / `selectedCellIsSecurityBoundary`. Extend it to compute lock-eligibility too:

Old:

```ts
const oldHasExactlyOneSelectedCell = this.hasExactlyOneSelectedCell;
const oldSelectedCellIsTextBox = this.selectedCellIsTextBox;
const oldSelectedCellIsSecurityBoundary = this.selectedCellIsSecurityBoundary;

this.hasSelectedCells = selectedCells.length > 0;
this.hasExactlyOneSelectedCell = selectedCells.length === 1;

if (this.hasExactlyOneSelectedCell) {
  const graph = this.appDfdOrchestrator.getGraph;
  if (graph) {
    const cell = graph.getCellById(selectedCells[0]);
    if (cell) {
      const cellData = cell.getData();
      this.selectedCellIsTextBox =
        cellData?.nodeType === 'text-box' || cell.shape === 'text-box';
      this.selectedCellIsSecurityBoundary =
        cellData?.nodeType === 'security-boundary' || cell.shape === 'security-boundary';
    } else {
      this.selectedCellIsTextBox = false;
      this.selectedCellIsSecurityBoundary = false;
    }
  }
} else {
  this.selectedCellIsTextBox = false;
  this.selectedCellIsSecurityBoundary = false;
}
```

New (adds `selectedCellIsLockEligible` in three places — old-state snapshot, the populated branch, the empty branch):

```ts
const oldHasExactlyOneSelectedCell = this.hasExactlyOneSelectedCell;
const oldSelectedCellIsTextBox = this.selectedCellIsTextBox;
const oldSelectedCellIsSecurityBoundary = this.selectedCellIsSecurityBoundary;
const oldSelectedCellIsLockEligible = this.selectedCellIsLockEligible;

this.hasSelectedCells = selectedCells.length > 0;
this.hasExactlyOneSelectedCell = selectedCells.length === 1;

if (this.hasExactlyOneSelectedCell) {
  const graph = this.appDfdOrchestrator.getGraph;
  if (graph) {
    const cell = graph.getCellById(selectedCells[0]);
    if (cell) {
      const cellData = cell.getData();
      this.selectedCellIsTextBox =
        cellData?.nodeType === 'text-box' || cell.shape === 'text-box';
      this.selectedCellIsSecurityBoundary =
        cellData?.nodeType === 'security-boundary' || cell.shape === 'security-boundary';
      this.selectedCellIsLockEligible =
        (ICON_ELIGIBLE_SHAPES as readonly string[]).includes(cell.shape);
    } else {
      this.selectedCellIsTextBox = false;
      this.selectedCellIsSecurityBoundary = false;
      this.selectedCellIsLockEligible = false;
    }
  }
} else {
  this.selectedCellIsTextBox = false;
  this.selectedCellIsSecurityBoundary = false;
  this.selectedCellIsLockEligible = false;
}
```

Update the change-detection trigger at the end of the method to include the new field:

Old:

```ts
if (
  oldHasSelectedCells !== this.hasSelectedCells ||
  oldHasExactlyOneSelectedCell !== this.hasExactlyOneSelectedCell ||
  oldSelectedCellIsTextBox !== this.selectedCellIsTextBox ||
  oldSelectedCellIsSecurityBoundary !== this.selectedCellIsSecurityBoundary
) {
  this.cdr.detectChanges();
}
```

New:

```ts
if (
  oldHasSelectedCells !== this.hasSelectedCells ||
  oldHasExactlyOneSelectedCell !== this.hasExactlyOneSelectedCell ||
  oldSelectedCellIsTextBox !== this.selectedCellIsTextBox ||
  oldSelectedCellIsSecurityBoundary !== this.selectedCellIsSecurityBoundary ||
  oldSelectedCellIsLockEligible !== this.selectedCellIsLockEligible
) {
  this.cdr.detectChanges();
}
```

- [ ] **Step 4: Compute `rightClickedCellIsLocked` in `openCellContextMenu`**

Find `openCellContextMenu` around line 2400. After `this._rightClickedCell = cell;`, add:

Old:

```ts
private openCellContextMenu(cell: any, x: number, y: number): void {
  // Store the right-clicked cell for context menu actions
  this._rightClickedCell = cell;

  // Update context menu position
  this.contextMenuPosition = {
    x: `${x}px`,
    y: `${y}px`,
  };
```

New:

```ts
private openCellContextMenu(cell: any, x: number, y: number): void {
  // Store the right-clicked cell for context menu actions
  this._rightClickedCell = cell;
  this.rightClickedCellIsLocked = isCellLayoutLocked(cell);

  // Update context menu position
  this.contextMenuPosition = {
    x: `${x}px`,
    y: `${y}px`,
  };
```

- [ ] **Step 5: Add the menu item to the template**

In `src/app/pages/dfd/presentation/components/dfd.component.html`, find the existing context-menu definition (`<mat-menu #cellContextMenu="matMenu">` around line 473). The structure has: edit-text, divider, four z-order items, conditional inverse-connection, conditional data-assets, divider, delete, threat, conditional show-object.

Insert a new conditional block immediately after the four z-order buttons (after the "moveToBack" button, around line 494) and before the conditional inverse-connection block (around line 495):

Old:

```html
<button mat-menu-item (click)="moveToBack()" [disabled]="isReadOnlyMode">
  <mat-icon>vertical_align_bottom</mat-icon>
  <span>{{ 'contextMenu.moveToBack' | transloco }}</span>
</button>
@if (isRightClickedCellEdge()) {
```

New:

```html
<button mat-menu-item (click)="moveToBack()" [disabled]="isReadOnlyMode">
  <mat-icon>vertical_align_bottom</mat-icon>
  <span>{{ 'contextMenu.moveToBack' | transloco }}</span>
</button>
@if (selectedCellIsLockEligible) {
  <mat-divider></mat-divider>
  <button mat-menu-item (click)="toggleLayoutLock()" [disabled]="isReadOnlyMode">
    <mat-icon>{{ rightClickedCellIsLocked ? 'lock_open' : 'lock' }}</mat-icon>
    <span>{{ (rightClickedCellIsLocked ? 'contextMenu.unlockLayout' : 'contextMenu.lockLayout') | transloco }}</span>
  </button>
}
@if (isRightClickedCellEdge()) {
```

- [ ] **Step 6: Add a stub `toggleLayoutLock` method**

In `dfd.component.ts`, add a stub method so the template compiles. The full implementation is in Task 6.

Place near the other context-menu action handlers (e.g., near `editCellText` or `deleteSelected` around lines 1500–1900):

```ts
toggleLayoutLock(): void {
  // Implementation in Task 6.
}
```

- [ ] **Step 7: Build**

Run: `pnpm run build`

Expected: build succeeds. The template should compile cleanly.

- [ ] **Step 8: Lint**

Run: `pnpm run lint:all`

Expected: clean.

- [ ] **Step 9: Run unit tests**

Run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/app/pages/dfd/presentation/components/dfd.component.ts \
        src/app/pages/dfd/presentation/components/dfd.component.html
git commit -m "feat(dfd): add lock-layout context-menu item and selection state (#641)"
```

---

## Task 6: Implement `toggleLayoutLock` with history batching

**Goal:** Real implementation of `toggleLayoutLock`. Lock applied → one history op (data change only). Lock removed → one batched history op covering the data change plus any cells touched by the post-unlock layout cycle.

**Files:**
- Modify: `src/app/pages/dfd/presentation/components/dfd.component.ts`

- [ ] **Step 1: Replace the stub `toggleLayoutLock`**

Replace the stub from Task 5 with the real implementation. Place it near the other context-menu handlers:

```ts
/**
 * Toggle the per-cell layout lock on the right-clicked cell (#641).
 *
 * - Lock applied: capture pre-state, set `_layoutLocked: true`, show badge,
 *   emit a single update-node history op. No layout pass.
 * - Lock removed: capture pre-state for the cell, its children, and any
 *   container-fit ancestors; clear `_layoutLocked`; hide badge; run a layout
 *   cycle (applyAutoLayout + cascade); emit one batched history op covering
 *   every touched cell. Single undo step per toggle.
 *
 * No-op if the right-clicked cell is missing, not lock-eligible, or in
 * read-only mode (the menu item is also disabled in that case).
 */
toggleLayoutLock(): void {
  if (this.isReadOnlyMode) return;
  const cell = this._rightClickedCell;
  if (!cell) return;
  if (!(ICON_ELIGIBLE_SHAPES as readonly string[]).includes(cell.shape)) return;

  const wasLocked = isCellLayoutLocked(cell);

  if (!wasLocked) {
    // Lock applied: data change only, single history op.
    const previousState = this._captureCellStateForHistory(cell);
    const next = { ...cell.getData() };
    next._layoutLocked = true;
    cell.setData(next, { silent: true, overwrite: true });
    this.applyLockBadge(cell);

    const ts = Date.now();
    const op = {
      id: `layout-lock-${ts}-${cell.id}`,
      type: 'update-node' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: ts,
      nodeId: cell.id,
      updates: {},
      includeInHistory: true,
      metadata: { previousCellState: previousState },
    };
    this.appDfdOrchestrator.executeOperation(op).subscribe();

    this.rightClickedCellIsLocked = true;
    return;
  }

  // Lock removed: capture pre-state for cell + children + cascade ancestors,
  // clear the flag, run a layout cycle inside one batched history entry.
  const previousStates = new Map<string, unknown>();
  const captureCell = (c: any): void => {
    if (!c?.id || previousStates.has(c.id)) return;
    previousStates.set(c.id, this._captureCellStateForHistory(c));
  };

  captureCell(cell);
  for (const child of (cell.getChildren?.() ?? []) as any[]) {
    captureCell(child);
  }
  let ancestor = cell.getParent?.();
  while (ancestor) {
    if (isCellLayoutLocked(ancestor)) break;
    const ancData = ancestor.getData?.() ?? {};
    const autoFit = ancData._archAutoFit as
      | { kind: 'icon-only' | 'container'; width: number; height: number }
      | undefined;
    if (!autoFit || autoFit.kind !== 'container') break;
    captureCell(ancestor);
    for (const child of (ancestor.getChildren?.() ?? []) as any[]) {
      captureCell(child);
    }
    ancestor = ancestor.getParent?.();
  }

  // Clear the flag and update the badge before running the layout cycle —
  // applyAutoLayout checks isCellLayoutLocked at entry.
  const next = { ...cell.getData() };
  delete next._layoutLocked;
  cell.setData(next, { silent: true, overwrite: true });
  this.applyLockBadge(cell);

  // Run a layout cycle on the now-unlocked cell. Re-uses the existing
  // applyAutoLayout + cascadeContainerLayout path. The `_inLayoutCycle` guard
  // prevents the resize/position events from re-entering _runLayoutCycle.
  this._inLayoutCycle = true;
  try {
    const changed = this.applyAutoLayout(cell);
    if (changed) {
      this.cascadeContainerLayout(cell);
    }
  } finally {
    this._inLayoutCycle = false;
  }

  const ts = Date.now();
  const ops = Array.from(previousStates.entries()).map(([id, prev], i) => ({
    id: `layout-unlock-${ts}-${i}-${id}`,
    type: 'update-node' as const,
    source: 'user-interaction' as const,
    priority: 'normal' as const,
    timestamp: ts,
    nodeId: id,
    updates: {},
    includeInHistory: true,
    metadata: { previousCellState: prev },
  }));

  if (ops.length === 1) {
    this.appDfdOrchestrator.executeOperation(ops[0]).subscribe();
  } else if (ops.length > 1) {
    const batch = {
      id: `layout-unlock-batch-${ts}`,
      type: 'batch-operation' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: ts,
      operations: ops,
      description: 'Unlock layout',
      includeInHistory: true,
    };
    this.appDfdOrchestrator.executeOperation(batch).subscribe();
  }

  this.rightClickedCellIsLocked = false;
}
```

Notes on the structure (the code above models itself on `_runLayoutCycle` around line 3361 — re-read that method if anything below the comment is unclear):
- The `_inLayoutCycle` guard prevents nested layout cycles from re-entering this code path.
- The batch shape (`batch-operation` with `operations` array, `description` field) matches `_runLayoutCycle`'s `batch` construction.
- We capture pre-state BEFORE clearing the flag so the undo restores both the flag and any geometry.

- [ ] **Step 2: Build**

Run: `pnpm run build`

Expected: build succeeds. If type errors mention `executeOperation` accepting different shapes, look at `_runLayoutCycle` for the canonical op/batch shapes — the batch type may have additional required fields.

- [ ] **Step 3: Lint**

Run: `pnpm run lint:all`

Expected: clean.

- [ ] **Step 4: Run unit tests**

Run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/dfd/presentation/components/dfd.component.ts
git commit -m "feat(dfd): implement toggleLayoutLock with batched history (#641)"
```

---

## Task 7: i18n keys

**Goal:** Add `contextMenu.lockLayout` and `contextMenu.unlockLayout` to the English locale and propagate to all other locales.

**Files:**
- Modify: `src/assets/i18n/en-US.json`
- Modify (auto-synced): all other locale files in `src/assets/i18n/`

- [ ] **Step 1: Add the two new keys to `en-US.json`**

Find the `"contextMenu"` block in `src/assets/i18n/en-US.json` (around line 798). Current block:

```json
"contextMenu": {
  "addInverseConnection": "Add Inverse Connection",
  "dataAssets": "Data Assets...",
  "editText": "Edit Text",
  "moveBackward": "Move Backward",
  "moveForward": "Move Forward",
  "moveToBack": "Move to Back",
  "moveToFront": "Move to Front",
  "noDataAssetsAvailable": "No data assets available",
  "showObject": "Show Object"
},
```

Add two new keys, alphabetically:

```json
"contextMenu": {
  "addInverseConnection": "Add Inverse Connection",
  "dataAssets": "Data Assets...",
  "editText": "Edit Text",
  "lockLayout": "Lock Layout",
  "moveBackward": "Move Backward",
  "moveForward": "Move Forward",
  "moveToBack": "Move to Back",
  "moveToFront": "Move to Front",
  "noDataAssetsAvailable": "No data assets available",
  "showObject": "Show Object",
  "unlockLayout": "Unlock Layout"
},
```

- [ ] **Step 2: Run the i18n sync tool**

Run: `pnpm run check-i18n`

Expected: the script reports the two new keys missing in the 16 other locale files and either auto-adds English placeholder values or prompts for translations. Read the script's output carefully — accept the additions if it asks. (`-y` is in the script; it auto-confirms.)

After the script runs, the new keys should appear in every locale file with the English value as a placeholder. Real translations are not blocking — the project's localization workflow handles those separately.

- [ ] **Step 3: Sanity-check one non-English locale**

Run: `rg '"lockLayout"' src/assets/i18n/`

Expected: 17 hits (one per locale file plus en-US). If only en-US is hit, re-run `check-i18n`.

- [ ] **Step 4: Build**

Run: `pnpm run build`

Expected: build succeeds.

- [ ] **Step 5: Lint**

Run: `pnpm run lint:all`

Expected: clean.

- [ ] **Step 6: Run unit tests**

Run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/assets/i18n/
git commit -m "feat(dfd): add lock/unlock layout i18n keys across locales (#641)"
```

---

## Task 8: Manual browser verification

**Goal:** Verify the feature end-to-end in the browser. Per `CLAUDE.md`, UI changes must be verified in a browser, not just by passing tests.

**Files:** None (manual verification).

- [ ] **Step 1: Start the dev server**

Run: `pnpm run dev`

Wait for the build to settle and the dev server to print its URL (typically `http://localhost:4200`).

- [ ] **Step 2: Open a diagram**

Navigate to a threat model with at least one DFD diagram, or create one. Add an actor, a process, a store, and a security-boundary. Embed at least one child shape inside a process container.

- [ ] **Step 3: Verify the menu item appears for eligible shapes**

Right-click on the actor → confirm "Lock Layout" appears with a `lock` icon.
Right-click on the process container → confirm "Lock Layout" appears.
Right-click on the store → confirm "Lock Layout" appears.
Right-click on the security-boundary → confirm "Lock Layout" appears.

- [ ] **Step 4: Verify the menu item is hidden for non-eligible shapes**

Right-click on an edge (between two shapes) → confirm "Lock Layout" does NOT appear.
Add a text-box to the diagram and right-click on it → confirm "Lock Layout" does NOT appear.

- [ ] **Step 5: Verify the lock badge appears**

Right-click on the process container → click "Lock Layout" → confirm:
- Menu closes.
- A small lock badge is rendered at the bottom-right of the process container, ~8px in from the corner.
- The container's size and child positions are unchanged.

- [ ] **Step 6: Verify the menu label updates**

Right-click on the same locked process container → confirm the menu now shows "Unlock Layout" with a `lock_open` icon.

- [ ] **Step 7: Verify drag-end re-sort is suppressed**

With the process container still locked, drag a child within it to a different grid position → confirm the child stays where dropped and the parent grid does NOT reflow.

- [ ] **Step 8: Verify global preference toggle is honored**

Open user preferences → toggle "Auto-layout shapes" off → confirm the locked container's size is preserved (`_archAutoFit` retained) while unlocked auto-fit cells revert.

Toggle "Auto-layout shapes" back on → confirm the locked container is still locked and at its preserved size; unlocked cells are re-laid-out.

- [ ] **Step 9: Verify save/reload persistence**

Save the diagram (or trigger a save, depending on the UI). Refresh the page or navigate away and back. The locked cell should still show the lock badge and remain exempt from auto-layout.

- [ ] **Step 10: Verify unlock triggers re-layout**

Right-click the locked cell → click "Unlock Layout" → confirm:
- The badge disappears.
- The cell's grid re-flows to the current auto-layout state.
- A drag of a child within the (now-unlocked) cell triggers re-sort as before.

- [ ] **Step 11: Verify undo/redo**

Lock a cell. Press Ctrl/Cmd+Z (undo) → the lock should be removed.
Press Ctrl/Cmd+Y (redo) → the lock should be restored.

Lock a cell, then unlock it (which may also re-flow). Press Ctrl/Cmd+Z → both the unlock action AND any re-flow side-effects should be reverted in one step (cell is locked again at pre-unlock geometry).

- [ ] **Step 12: Stop the dev server**

Press Ctrl+C in the terminal running `pnpm run dev`.

If any step fails, debug, fix, and re-verify before proceeding. Don't commit broken UI.

If everything passes, no commit needed for this task — it's a verification-only step.

---

## Task 9: File backlog issue for bulk operations (per Q5b)

**Goal:** Capture the deferred bulk-lock work in the GitHub backlog so it isn't lost.

**Files:** None (GitHub-only).

- [ ] **Step 1: Create the issue**

Run:

```bash
gh issue create \
  --repo ericfitz/tmi-ux \
  --title "feat: bulk layout-lock operations (lock/unlock all + lock/unlock subtree)" \
  --label enhancement \
  --body "## Summary

Follow-up to #641 (per-shape layout lock). The per-cell lock toggle ships in #641; this issue tracks bulk variants discussed during #641 design and deferred per YAGNI.

## Scope

### Lock/unlock all

A single command that toggles the lock on every layout-eligible cell in the diagram. Useful when a user wants to:
- Lock everything to freeze the current arrangement before sharing a screenshot.
- Unlock everything to let auto-layout re-flow the entire diagram fresh.

Open question: surface as kebab menu items, a toolbar button, or a context-menu sub-menu — TBD during this issue's design.

### Lock/unlock subtree

When a container shape is selected (or right-clicked), a command that:
- **Lock subtree**: locks the selected cell and all descendants, transitively.
- **Unlock subtree**: unlocks the selected cell and all descendants, transitively.

Useful for hand-tuning a region of the diagram without affecting unrelated cells.

Eligibility: descendants of any depth, but only those that are auto-layout-eligible (actor / process / store / security-boundary). text-box and edges are skipped.

History: each bulk operation is one undoable batch.

## Out of scope

- A 'lock except this one' inverse selection.
- Lock-by-shape-type (e.g., 'lock all stores').

## Depends on

- #641 (per-shape layout lock)" \
  --milestone 1.4.0
```

If `gh issue create` doesn't accept `--milestone` directly, omit it and add the milestone via the GitHub UI or `gh api` afterwards. If labels other than `enhancement` are conventional for this repo, adjust accordingly.

- [ ] **Step 2: Note the issue URL**

The command prints the issue URL. Save it for reference; no further action needed in this plan.

---

## Task 10: Close issue #641

**Goal:** Per CLAUDE.md, GitHub-issue-related changes need a commit reference comment and the issue closed.

**Files:** None (GitHub-only).

- [ ] **Step 1: Find the most recent commit SHA on the branch**

Run: `git log --oneline -1`

Note the SHA of the most recent commit related to this issue (likely the i18n commit or the `toggleLayoutLock` commit, depending on order).

- [ ] **Step 2: Comment on the issue with the resolving commit/branch**

Run:

```bash
gh issue comment 641 \
  --repo ericfitz/tmi-ux \
  --body "Resolved on branch dev/1.4.0. Implementation across: layout-lock util + helper integration in dfd.component, lock-badge markup on the four eligible shapes, context-menu toggle, i18n keys. Bulk operations follow-up tracked in <BULK-ISSUE-URL-FROM-TASK-9>."
```

Replace `<BULK-ISSUE-URL-FROM-TASK-9>` with the URL printed by Task 9.

- [ ] **Step 3: Close the issue**

Run: `gh issue close 641 --repo ericfitz/tmi-ux`

Expected: issue closed.

---

## Self-Review Checklist

Spec coverage:
- ✅ `_layoutLocked` data tag (Task 1, 6)
- ✅ Five integration sites checked (Task 2)
- ✅ Visual indicator at bottom-right inset (Task 3 markup, Task 4 helper, Task 6 toggle)
- ✅ Single-node gate for cascade (Task 2 cascadeContainerLayout)
- ✅ Eligibility limited to actor/process/store/security-boundary (Task 5 selectedCellIsLockEligible, Task 6 toggleLayoutLock guard)
- ✅ Lock honored across `autoLayoutEnabled` toggle (Task 2 applyAutoLayoutToAllEligibleCells, revertAutoFitOnAllAutoFitCells)
- ✅ Persistence via cell.data (Task 4 applyLockBadge in applyIconsOnLoad)
- ✅ Single history op per toggle (Task 6 toggleLayoutLock)
- ✅ Context-menu UX (Task 5)
- ✅ i18n (Task 7)
- ✅ Manual verification (Task 8)
- ✅ Bulk-ops follow-up issue (Task 9)
- ✅ Close issue (Task 10)

Type consistency:
- `isCellLayoutLocked(cell: unknown)` — used everywhere; tolerates null/missing-getData.
- `LOCK_BADGE_ICON_HREF` — string constant; used in `applyLockBadge` only.
- `applyLockBadge(cell: any)` — name consistent across Tasks 4/6.
- `toggleLayoutLock()` — name consistent across Tasks 5/6.
- `selectedCellIsLockEligible` / `rightClickedCellIsLocked` — names consistent across Tasks 5/6 and template.
- Op shapes (`update-node`, `batch-operation`) — modeled on existing `_runLayoutCycle`.

Placeholder scan: no TBD/TODO except inside the Task 9 issue body where they're literal text the issue will contain.
