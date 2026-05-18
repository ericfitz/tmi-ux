# Extract testable controller logic from dfd.component (#694)

**Date:** 2026-05-18
**Branch:** dev/1.4.0
**GitHub issue:** [#694](https://github.com/ericfitz/tmi-ux/issues/694)
**Status:** Approved

## Problem

`src/app/pages/dfd/presentation/components/dfd.component.ts` is 4,082 lines with
no unit spec. It is one of the two most complex screens in the application.

Unlike the sibling extraction #695 (tm-edit, which was dialog/CRUD-heavy), this
component is **X6-graph-manipulation-heavy**. The pure geometry math is *already*
extracted into `dfd/utils/auto-layout.util.ts` (`gridDimensions`,
`layoutContainer`, `iconOnlyFitGeometry`, etc.) and is well-tested. What remains
in the component is graph-coupled glue: read X6 cells → call a util → write
cells back, interleaved with history-operation dispatch and change detection.

The component's logic falls into four categories:

1. **Pure mappers / predicates (A)** — `mapStringToNodeType`, data-asset
   predicates and getters. No DI, no live graph. ~150 lines.
2. **Auto-layout / icon / styling glue (B)** — the largest block (~1,800
   lines). Reads X6 cells, calls `auto-layout.util` / styling constants, writes
   cells back. Graph-coupled but logic-dense and currently untested.
3. **Dialog / command orchestration (C)** — `MatDialog.open` plus post-dialog
   result handling for history, graph-data, help, clipboard, cell-properties,
   metadata, threat-editor, threats, and delete-confirmation. ~900 lines.
4. **X6 event wiring / lifecycle (D)** — lifecycle hooks, `setup*Subscriptions`,
   `handle*` event handlers, keyboard/context-menu/resize handlers, panel
   toggles, `@ViewChild` wiring. ~1,200 lines. Irreducible view glue.

## Goal

Move controller logic out of the component into layered services with unit
specs, leaving the component as X6 event wiring + lifecycle. Residual component
behavior stays covered by the existing Playwright DFD `workflows` E2E. No
backward-compatibility concerns — this is an internal refactor.

## The cell/graph seam

The core enabler of the extraction. The extracted services must not depend on
X6's concrete `Cell` / `Graph` types — that would make unit tests require a
live X6 graph.

New file: `src/app/pages/dfd/types/layout-cell.types.ts`. It defines narrow
TypeScript interfaces:

- **`LayoutCell`** — the cell surface the extracted services touch:
  `getData` / `setData` / `getSize` / `resize` / `getChildren` / `getParent` /
  `getAttrs` / `getAttrByPath` / `setAttrByPath` / `isNode` / `isEdge` /
  `getPosition` / `getZIndex` / `isVisible` / `getPorts` / `id` / `shape`.
- **`LayoutGraph`** — `getNodes` / `getCellById` / `getEdges`.

X6's real `Cell` and `Graph` already structurally satisfy these interfaces, so
the component passes live cells/graph unchanged — no adapter, no wrapping. Unit
tests pass plain object fakes that implement only the methods a given test
exercises.

This replaces the pervasive `any` on cell parameters with a real compile-time
contract. Any method touching a cell field not yet on `LayoutCell` will fail to
compile until the interface is extended — which is the desired safety net for
`_captureCellStateForHistory` in particular (see Risks).

## Service decomposition

Six new services under `src/app/pages/dfd/presentation/services/` (joining the
existing `ui-presenter-*` services). Each is `@Injectable({ providedIn:
'root' })` — they are stateless (hold no per-diagram state), unlike the
component-scoped `App*` services. Each gets a Vitest `*.spec.ts` alongside it.

| Service | Category | What moves |
|---|---|---|
| `DfdNodeTypeService` | A | `mapStringToNodeType`; data-asset predicates/getters: `isDataAssetChecked`, `isDataAssetIndeterminate`, `_getCellDataAssets`, `_setCellDataAssets`. Pure. |
| `DfdLayoutService` | B | `applyAutoLayout`, `applyContainerFit`, `applyIconOnlyFit`, `cascadeContainerLayout`, `_runLayoutCycle`, `revertAutoFit`, `applyAutoLayoutToAllEligibleCells`, `revertAutoFitOnAllAutoFitCells`, `_buildChildBox`, `_resolveLayoutOrientation`, `_clearVerticesOfConnectedEdges`, the `_setAbsoluteIconAttrs` / `_setAbsoluteLabelAttrs` helpers. |
| `DfdIconService` | B | `applyIconToCell`, `restoreLabelDefaults`, `restoreBorder`, `applyBorderPreference`, `applyIconsOnLoad`, `applyLockBadge`, `reapplyBorderPreferenceToAllIconnedCells`, `_captureCellStateForHistory`. |
| `DfdStylingService` | B | `applyNodeStyleChange`, `applyEdgeStyleChange`, the per-cell logic of `onClearCustomFormatting`, and the cell-info computation halves of `updateStylePanelCells` / `updateIconPickerCells`. |
| `DfdDialogService` | C | The single `MatDialog` seam — `open*` methods for the history, graph-data, help, clipboard, cell-properties, metadata, threat-editor, threats, and delete-confirmation dialogs. Mirrors `TmDialogService` from #695. |
| `DfdCommandService` | C | Post-dialog orchestration: result handling for `openThreatEditor` / `manageThreats` / `onEditMetadata`; `_createThreat`; `closeDiagram` / `_navigateAway` / `_fallbackSaveAndNavigate`; `_captureDiagramSvgThumbnail`. |

### Division of responsibility

The governing pattern: **services compute and mutate cells; the component
dispatches history operations and triggers change detection.**

A method like `onIconSelected` stays in the component but shrinks: the component
still loops over cell IDs, builds the `update-node` operation, calls
`appDfdOrchestrator.executeOperation(...).subscribe()`, and calls
`cdr.detectChanges()`. The cell-mutating steps it currently inlines
(`applyIconToCell`, `applyBorderPreference`, `applyAutoLayout`,
`_captureCellStateForHistory`) become delegated calls into `DfdIconService` /
`DfdLayoutService`.

## What stays in the component (Category D — always)

Lifecycle hooks (`ngOnInit`, `ngAfterViewInit`, `ngOnDestroy`); all
`setup*Subscriptions` and X6 event wiring (`setupEdgeObservableSubscriptions`,
`subscribeToAutoLayoutTriggers`, `setupContextMenuHandlers`,
`setupPortClickHandlers`, `setupOrchestratorSubscriptions`,
`subscribeToAutoLayoutPreferences`); the `handle*` event handlers (they dispatch
orchestrator operations); `onKeyDown` / `onContextMenu` / `onWindowResize`;
panel-toggle booleans and the `@ViewChild` wiring; every
`executeOperation(...).subscribe()` dispatch; and all `cdr.detectChanges()`
calls. This is irreducible view glue.

## Phasing

Phased extraction with one commit per phase, no review gate (the design is
approved up front). Each phase: extract → write spec → `pnpm run lint:all` +
`pnpm run build` + related tests green → `refactor:` commit.

1. **Phase 1** — `layout-cell.types.ts` + `DfdNodeTypeService` (Category A).
   Smallest phase; proves the cell/graph seam end to end.
2. **Phase 2** — `DfdDialogService` + `DfdCommandService` (Category C).
3. **Phase 3** — `DfdLayoutService` (Category B). Largest single phase.
4. **Phase 4** — `DfdIconService` (Category B).
5. **Phase 5** — `DfdStylingService` (Category B).

## Testing

Vitest specs alongside each new service (`*.spec.ts`), following the existing
`ui-presenter-coordinator.service.spec.ts` and the `tm-*-crud.service.spec.ts`
patterns from #695. Fakes are plain objects implementing `LayoutCell` /
`LayoutGraph`. No new E2E — the existing DFD `workflows` Playwright suite covers
residual component behavior.

## Risks

- **Snapshot completeness.** `_captureCellStateForHistory` does
  `JSON.parse(JSON.stringify(...))` over a live X6 cell, reading `id`, `shape`,
  `position`, `size`, `attrs`, `ports`, `data`, `visible`, `zIndex`, and
  `parent`. If the `LayoutCell` interface omits any getter the snapshot reads,
  the snapshot silently loses a field. The interface must expose every getter
  the method touches, and the `DfdIconService` spec must assert the full
  snapshot shape.
- **Preference and constant coupling.** Layout/icon methods read
  `UserPreferencesService` and the `DFD_STYLING` constant tables. Services
  inject `UserPreferencesService`; the constants stay imported directly (they
  are static). Specs stub `UserPreferencesService.getPreferences()`.
- **Layout recursion guard.** The component's `_inLayoutCycle` flag suppresses
  re-entrant auto-layout triggers. It is set/cleared around layout dispatch in
  Category D code and must remain in the component — `DfdLayoutService` methods
  are called *within* the guarded region and must not own the flag.

## Out of scope

- The sibling `tm-edit.component` extraction was completed separately as #695.
- No unrelated refactoring of the component's template or styles.
- No change to the `App*` orchestrator/facade architecture — the extraction
  sits between the component and the existing orchestrator, not inside it.
