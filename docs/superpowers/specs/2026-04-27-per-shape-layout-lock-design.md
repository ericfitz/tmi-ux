# Per-Shape Layout Lock — Design Spec

**Issue:** [#641](https://github.com/ericfitz/tmi-ux/issues/641)
**Depends on:** [#642](https://github.com/ericfitz/tmi-ux/issues/642) (container auto-layout — landed in `5d3839af`)
**Related:** [#638](https://github.com/ericfitz/tmi-ux/issues/638) (icon-only auto-fit), [`2026-04-26-arch-icon-auto-layout-design.md`](2026-04-26-arch-icon-auto-layout-design.md)
**Date:** 2026-04-27
**Branch:** `dev/1.4.0`

## Overview

The auto-layout system from #638/#642 reads a global `autoLayoutEnabled` preference. When on, leaf iconned shapes shrink to fit and container shapes auto-size around a grid of children. Some users will want auto-layout on overall but want to preserve a hand-tuned arrangement inside a particular container — for diagram readability, narrative purposes, or screenshots.

This spec adds a per-cell "layout lock" that opts a single cell out of every auto-layout pass without disabling auto-layout globally. The lock is explicit, persistent across save/load, and survives global preference toggles. It is exposed via a context-menu toggle and shown on the cell as a small lock badge at the bottom-right corner.

## Goals

- Provide an escape hatch for users who want auto-layout on overall but pinned in one or more shapes.
- Keep the lock orthogonal to existing auto-layout state — the lock survives `autoLayoutEnabled` toggles and orientation changes.
- Surface lock state visibly on the diagram so a returning user can see at a glance which shapes are locked.
- Make every lock toggle a single undoable history operation.

## Non-Goals (v1)

- **Bulk operations** (lock-all, unlock-all, lock-subtree, unlock-subtree). Deferred to a follow-up issue.
- **Properties-panel checkbox** for the lock toggle. v1 is context-menu only.
- **Animation** on the lock-badge appearance/disappearance.
- **Locking non-eligible shapes** (text-box, edges). The lock applies only to auto-layout-eligible shapes.
- **Programmatic API** for setting locks from outside the DFD component.
- **Server schema changes** — the lock rides on existing `cell.data` round-trip.

## Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| Q1 | Cascade semantics | **Single-node gate.** A locked cell exempts only itself; descendants are not implicitly locked. The cascade up through `cascadeContainerLayout` stops at a locked ancestor. | Matches the issue body's wording ("locking a parent blocks the cascade above it from reading its children"). Least surprising — lock means "lock this one shape," not "freeze a hidden subtree." |
| Q2 | Eligibility | **Auto-layout-eligible shapes only**: actor, process, store, security-boundary. | These are the only shapes the auto-layout system touches. Locking anything else is a no-op or meaningless. |
| Q3 | Visual indicator | **Small lock glyph at the bottom-right corner of the cell, inset 8px from each edge** so it sits inboard of the X6 resize handle. 12×12, neutral color, with a small light background for legibility against any cell fill. | Visible at a glance; consistent across orientations; never overlaps with the architecture icon (which lives in the icon column on the left or icon row on top). The 8px inset keeps it visible behind selection chrome on most cell sizes. |
| Q4 | Interaction with `autoLayoutEnabled` toggle | **Lock honored everywhere, including global toggle paths.** When `autoLayoutEnabled` flips off, locked cells keep their auto-fit size. When it flips on, locked cells are skipped over. The lock survives preference toggles indefinitely. | The lock is the user's explicit per-cell intent and should not be silently erased by a global toggle. Keeps the data model simple — `_layoutLocked` is metadata that just sits on the cell. |
| Q5a | Default lock state on diagram load | **Persist `_layoutLocked` like `_archAutoFit`; treat missing as `false`.** Older diagrams without the field load unlocked. | Standard "missing means default" persistence pattern. |
| Q5b | Bulk lock/unlock command in v1 | **Defer to a follow-up issue** that covers lock-all, unlock-all, and lock/unlock subtree. | YAGNI; per-cell lock is enough for v1. The follow-up issue will explore both global and subtree variants. |

## Data Model

### Cell-level

A new optional tag on cell data:

```ts
cell.data._layoutLocked?: true;
```

Stored as a tag (only present when locked), not a `boolean | undefined` tristate. Reading: `Boolean(cell.getData()?._layoutLocked)`. Writing: `setData({ ...data, _layoutLocked: true })` to lock; `delete data._layoutLocked` (then `setData`) to unlock.

The field rides on the existing cell data persistence path — no new server schema, no API change. Round-trips through API save/load identically to `_archAutoFit`.

### No user-preferences additions

The lock is per-cell, not a global preference. No changes to `UserPreferencesData`.

## Behavior

### Lock checks at integration points

The lock is checked at five sites in `src/app/pages/dfd/presentation/components/dfd.component.ts`:

| Site | Existing behavior | New behavior when cell is locked |
|---|---|---|
| `applyAutoLayout(cell, sortBy)` (line ~3111) | Dispatches to icon-only or container fit. | **Early return `false` if `cell.data._layoutLocked`.** No layout pass runs. |
| `cascadeContainerLayout(startCell)` (line ~3338) | Walks `getParent()` chain, re-laying out container-fit ancestors until one is not container-fit. | **Break the walk if `parent.data._layoutLocked`.** A locked ancestor blocks cascade from reaching anything above it. |
| `_runLayoutCycle(triggerCell, sortBy)` ancestor capture (line ~3375) | Captures pre-state of the trigger cell, its children, and container-fit ancestors for history batching. | **Stop ancestor capture at a locked ancestor** (matches the cascade gate). Locked ancestors are not touched, so their state need not be captured. |
| `applyAutoLayoutToAllEligibleCells()` (line ~3474) | Iterates all eligible nodes after `autoLayoutEnabled` flips on, applying layout. | **Skip locked cells.** |
| `revertAutoFitOnAllAutoFitCells()` (line ~3489) | Iterates all `_archAutoFit` cells after `autoLayoutEnabled` flips off, reverting to default size. | **Skip locked cells.** Their `_archAutoFit` and size are preserved. |

The drag-end re-sort within a locked container is handled implicitly: `applyAutoLayout` returns `false`, so a child dragged inside a locked container stays at the drag-end position, no reflow.

### Lock toggle

The user toggles the lock via context menu. Both transitions are single undoable history operations.

**Lock applied:**

1. Capture cell pre-state via the existing `_captureCellStateForHistory` helper.
2. Set `_layoutLocked = true` on cell data via `setData`.
3. Update the lock-badge attrs (show the badge).
4. Emit one `update-node` history op with the captured pre-state.

No layout pass runs on lock — the cell's current size and child positions are exactly what the user wanted to preserve.

**Lock removed:**

1. Capture cell pre-state plus pre-state of children and cascade ancestors (same set captured by `_runLayoutCycle`).
2. Delete `_layoutLocked` from cell data via `setData`.
3. Update the lock-badge attrs (hide the badge).
4. Run `applyAutoLayout(cell)` and `cascadeContainerLayout(cell)` — the cell now participates in auto-layout normally, and any deferred reflow happens.
5. Emit one batched history op covering all touched cells.

This way, undo of "unlock" restores both the lock flag and any pre-unlock geometry.

### Edge cases

| Scenario | Behavior |
|---|---|
| Locked container loses its last child | The cell stays at its current container-fit size; no transition to icon-only fit (which would be a layout change). The `_archAutoFit.kind: 'container'` flag is retained. On unlock, the next layout cycle will resolve the state (icon-only fit if iconned, default otherwise). |
| Child embedded into a locked container | Embedding is allowed (we don't gate user actions). The locked parent's grid does not reflow. The child sits at whatever absolute position the drop produced. On unlock, the next cascade pass re-flows the grid. |
| Child resized inside a locked container | The locked parent's grid does not reflow. |
| Lock applied to a cell with no `_archAutoFit` (e.g., manually resized to non-default) | Lock persists as metadata-only no-op. If the cell is later returned to a layout-eligible state (size restored to default), the lock continues to suppress auto-layout. |
| `autoLayoutEnabled = false` globally + lock | Lock is metadata-only; auto-layout doesn't run anyway. When `autoLayoutEnabled` is re-enabled, the lock takes effect and the cell is skipped over. |

## Visual Indicator

### Geometry

A small `lock` Material Symbol rendered as an x6 image on every eligible cell, conditionally visible based on `_layoutLocked`:

- **Position:** anchored to the bottom-right of the cell, inset 8px from each edge. In x6 absolute attrs:
  ```ts
  { refX: '100%', refY: '100%', refX2: -20, refY2: -20, width: 12, height: 12 }
  ```
  (The `-20` = `-(8 inset + 12 size)` so the 12×12 image's top-left lands 8px in from each edge.)
- **Size:** 12×12.
- **Glyph:** Material Symbol `lock` (filled). Sourced from the same plumbing the architecture icons use, or inlined as SVG path data — exact mechanism decided during implementation.
- **Color:** medium-contrast neutral (`#666`). Background: small white circle (radius ~8px) behind the glyph for legibility against any cell fill.
- **Visibility:** controlled by `display: 'block' | 'none'` (or `opacity: 1 | 0`) on the badge attrs, set when `_layoutLocked` flips.
- **Z-order:** above the cell body, below selection chrome. It is acceptable that resize handles briefly cover the badge during active selection — discoverability matters when the cell is unselected.

### Markup integration

The four eligible shape types (actor, process, store, security-boundary) gain a fourth markup node alongside the existing body / icon-image / label:

```ts
{
  tagName: 'image',
  selector: 'lockBadge',
  attrs: { /* default hidden */ display: 'none' }
}
```

A new helper `applyLockBadge(cell)` writes the badge attrs based on `_layoutLocked`. Called from:

- The lock-toggle handler (immediate update).
- `applyIconsOnLoad` after diagram load (sync state to persisted data).

If the existing arch-icon plumbing exposes a clean way to add a sibling decorator, reuse it. Otherwise, add a small dedicated helper that writes badge attrs directly via `cell.attr('lockBadge/...')`.

## Context Menu

### Menu item

Inserted in `src/app/pages/dfd/presentation/components/dfd.component.html` between the existing z-order block and the inverse-connection block (around line 495):

```html
@if (selectedCellIsLockEligible) {
  <button mat-menu-item (click)="toggleLayoutLock()" [disabled]="isReadOnlyMode">
    <mat-icon>{{ rightClickedCellIsLocked ? 'lock_open' : 'lock' }}</mat-icon>
    <span>{{ (rightClickedCellIsLocked ? 'contextMenu.unlockLayout' : 'contextMenu.lockLayout') | transloco }}</span>
  </button>
}
```

### Component support

Two new fields on `DfdComponent`:

```ts
selectedCellIsLockEligible = false;
rightClickedCellIsLocked = false;
```

Computed in `updateSelectionState` alongside the existing `selectedCellIsTextBox` / `selectedCellIsSecurityBoundary` flags:

```ts
this.selectedCellIsLockEligible =
  this.hasExactlyOneSelectedCell &&
  ICON_ELIGIBLE_SHAPES.includes(cell.shape);
this.rightClickedCellIsLocked = Boolean(cell.getData?.()?._layoutLocked);
```

`rightClickedCellIsLocked` is also re-read in `openCellContextMenu` so the label reflects the current cell's state.

A new method:

```ts
toggleLayoutLock(): void {
  // captures pre-state, toggles _layoutLocked, runs unlock-side layout pass if removing,
  // emits a single batched history operation
}
```

Implementation reuses the `_runLayoutCycle` capture pattern.

### i18n

Two new keys under the existing `contextMenu` namespace in `src/assets/i18n/en.json`:

```json
{
  "contextMenu": {
    "lockLayout": "Lock layout",
    "unlockLayout": "Unlock layout"
  }
}
```

Synced to all 16 locale files via the existing localization tooling (same pattern used for the auto-layout preference keys in #642).

## Persistence

- `cell.data._layoutLocked` round-trips through API save/load via the existing cell-data persistence path. Same plumbing as `_archAutoFit`.
- On diagram load (`applyIconsOnLoad`):
  - For each cell, after applying icon and any auto-layout, call `applyLockBadge(cell)` to sync the badge's visual state to `_layoutLocked`.
  - The lock check inside `applyAutoLayout` ensures locked cells aren't disturbed during load even if other layout passes run on adjacent cells.

## History / Undo

Each lock toggle is a single undoable operation:

- **Lock applied:** one `update-node` op covering the cell only (cell data changed; size unchanged).
- **Lock removed:** one batched `batch-operation` covering the cell and any cells touched by the post-unlock layout cycle. Reuses the existing `_runLayoutCycle` batching mechanism.

Undo of lock-applied removes the lock; undo of lock-removed restores both the lock and any geometry that was changed by the unlock-triggered layout pass.

## Phase Plan

### Phase 1 — Data and integration

1. Add `_layoutLocked` reads to `applyAutoLayout`, `cascadeContainerLayout`, `_runLayoutCycle` ancestor capture, `applyAutoLayoutToAllEligibleCells`, `revertAutoFitOnAllAutoFitCells`. Each is a small early-return / break / skip.
2. Verify cell data round-trips by inspecting save/load behavior in the integration spec.

### Phase 2 — Visual indicator

3. Extend the markup of actor / process / store / security-boundary shapes to include a `lockBadge` image element (default hidden).
4. Implement `applyLockBadge(cell)`. Call from the lock-toggle handler and from `applyIconsOnLoad`.
5. Decide and wire up the icon source for the lock glyph (reuse arch-icon plumbing or inline SVG).

### Phase 3 — Context menu and toggle handler

6. Add the menu item to `dfd.component.html`.
7. Add `selectedCellIsLockEligible`, `rightClickedCellIsLocked`, `toggleLayoutLock()` to `dfd.component.ts`.
8. Update `updateSelectionState` to compute the new flags.
9. Implement `toggleLayoutLock()` with the two transition paths (lock applied / lock removed) and one history op per toggle.

### Phase 4 — i18n

10. Add `contextMenu.lockLayout` / `contextMenu.unlockLayout` to `src/assets/i18n/en.json`.
11. Sync to all 16 locale files.

### Phase 5 — Tests and verification

12. Unit tests covering the matrix in the Test Plan section.
13. `pnpm run lint:all`, `pnpm run build`, `pnpm test` clean.
14. Manual browser verification of the acceptance criteria.

### Phase 6 — Follow-up

15. File a follow-up backlog issue for bulk lock operations: `feat: bulk layout-lock operations (lock/unlock all + lock/unlock subtree)`.

## Test Plan

### Unit tests

| Test | Setup | Expected |
|---|---|---|
| `applyAutoLayout` no-op when locked | Lock-eligible cell with `_layoutLocked: true` | Returns `false`; cell size unchanged; `_archAutoFit` unchanged |
| Cascade stops at locked ancestor | Grandchild → parent → grandparent (grandparent locked) | Parent re-laid out; grandparent untouched |
| `applyAutoLayoutToAllEligibleCells` skips locked | Mix of locked + unlocked eligible cells | Only unlocked cells get layout applied |
| `revertAutoFitOnAllAutoFitCells` skips locked | Toggle `autoLayoutEnabled` off with locked cells present | Locked cells retain `_archAutoFit` and current size; unlocked cells revert |
| Lock applied → no size change | Cell with `_archAutoFit` (container kind), apply lock | Size stays the same; `_layoutLocked: true` is now on data |
| Unlock triggers re-layout | Locked cell, then unlock | `_layoutLocked` removed; `applyAutoLayout` runs once |
| Lock+unlock undo behavior | Lock then unlock | Two undoable operations recorded; one undo per toggle |
| Drag-end re-sort suppressed when locked | Locked container, drag a child within it | Child stays at drag-end position; parent grid does not reflow |
| Embed child into locked container | Locked container, embed a new leaf | Child added to children list; parent size unchanged |
| Last child removed from locked container | Locked container with one child, remove the child | Container stays at container-fit size; no transition to icon-only fit |

### Manual / integration verification

- Right-click an eligible shape → menu item label is "Lock layout" with `lock` icon.
- Click the item → lock badge appears at bottom-right inset; cell visibly unchanged otherwise.
- Right-click again → menu item label is now "Unlock layout" with `lock_open` icon.
- Drag a child within a locked container → child stays where dropped; no parent grid reflow.
- Toggle `autoLayoutEnabled` off in user prefs → unlocked cells revert; locked cell holds.
- Toggle `autoLayoutEnabled` back on → unlocked cells re-laid out; locked cell still holds.
- Toggle `autoLayoutOrientation` between automatic / horizontal / vertical → unlocked container-fit cells re-flow; locked cell holds.
- Save the diagram, reload → lock state persists; badge re-renders.
- Right-click locked cell → "Unlock layout" → cell re-flows to current grid layout.
- Verify badge is hidden on text-box, edges, and any non-eligible shape.
- Verify menu item is hidden on the same.
- Undo after lock → lock removed; cell unchanged. Undo after unlock → lock restored; pre-unlock geometry restored.

### E2E

No new e2e spec. The lock interaction is local to the DFD component and doesn't cross page/route boundaries. Existing DFD e2e specs that assert specific cell sizes after layout are not affected — default state on a freshly loaded diagram is unlocked.

## Risks / Open Items

- **Icon source for the lock glyph.** The DFD shapes currently use architecture icons sourced via the arch-icon plumbing. Using the same plumbing for a status badge is convenient but may be tightly coupled to the icon picker UX. If reuse is awkward, falling back to inline SVG path data for the lock glyph is acceptable — it's a single static glyph, no picker involved. Decide during Phase 2.
- **Selection chrome occlusion.** When the cell is selected, X6 renders 8 resize handles plus a delete button. Resize handles sit on cell corners and may briefly obscure the lock badge. Acceptable per Q3; users see the lock state clearly when the cell is unselected, which is the common case.
- **Markup changes on existing shapes.** Adding a fourth markup node to the four eligible shape types is a small change but does affect every cell of those types. Mitigation: the badge is `display: 'none'` by default, so the visual is unchanged for cells without `_layoutLocked`. Old saved diagrams render identically.

## Future Work (out of scope)

- Bulk lock/unlock operations (lock-all, unlock-all, lock-subtree, unlock-subtree). Tracked in a follow-up issue filed at the end of this work.
- Properties-panel checkbox for the lock toggle.
- Animation on lock-badge appearance/disappearance.
- Programmatic API to set locks from outside the DFD component (useful for templates / scripted diagram generation).
