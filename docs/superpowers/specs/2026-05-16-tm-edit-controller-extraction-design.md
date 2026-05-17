# Extract testable controller logic from tm-edit.component (#695)

**Date:** 2026-05-16
**Branch:** dev/1.4.0
**GitHub issue:** [#695](https://github.com/ericfitz/tmi-ux/issues/695)
**Status:** Approved

## Problem

`src/app/pages/tm/tm-edit.component.ts` is 3,884 lines with no unit spec. It is
one of the two most complex screens in the application. Unit-testing it directly
is high-effort and low-yield because of heavy `FormGroup`, `MatDialog`, and
`MatSort`/`MatPaginator` coupling.

The component's logic falls into four categories:

1. **Pure formatters / migration helpers** (~10 methods) — no DI, no component
   state. Trivially testable once extracted.
2. **Form coordination / dirty-tracking / auto-save** (~8 methods) — depends on
   `FormGroup` and `ThreatModelService`, no DOM.
3. **Entity CRUD orchestration** (~35 methods) — dialog-open → service-call →
   mutate-`threatModel`-array chains for threats, diagrams, documents,
   repositories, notes, assets, plus paginated `load*` / `*PageChange` loaders.
4. **Thin view glue** (~15 methods) — lifecycle hooks, `@ViewChild` wiring,
   hover-preview timers, section toggles, SVG cache `Map`s.

Categories 1 and 2 extract cleanly. Category 3 is the bulk of the line count but
every method is coupled to `MatDialog` and to mutating `this.threatModel`.

## Goal

Move controller logic out of the component into layered services with unit
specs, leaving the component as thin view glue. Residual component behavior
stays covered by Playwright `workflows` E2E. No backward-compatibility concerns
— this is an internal refactor.

## Approach

A **phased extraction with two checkpoints**. The Phase 2/Phase 4 boundary and
the dialog-seam mechanism are decided *after* prototyping, not committed up
front. Phases 1 and 2 are each committed independently.

### Phase 1 — Pure helpers → `TmEditFormattingService`

New file: `src/app/pages/tm/services/tm-edit-formatting.service.ts`
(`@Injectable({ providedIn: 'root' })`).

Extract the no-DI, no-state methods:

- `getThreatSeverityClass`
- `getMimeTypeForFormat`, `getExtensionForFormat`, `generateDiagramModelFilename`
- `getTruncatedUrl`, `getDiagramIcon`, `getAssetTypeIcon`
- `extractViewBoxFromSvg`, `isValidBase64Svg` (DOM-parser based but
  self-contained — pure input → output)
- `migrateThreatFieldValues` plus the `severityMap` / `statusMap` /
  `priorityMap` tables and the `severityKeys` / `threatStatusKeys` constants

All become pure functions/methods. Full unit spec. The component injects the
service and delegates.

**Checkpoint 1:** `pnpm run lint:all` + `pnpm run build` + related tests green.
~400–500 lines moved. One commit (`refactor:`).

### Phase 2 — Form coordination + auto-save → `TmEditAutoSaveService`

New file: `src/app/pages/tm/services/tm-edit-auto-save.service.ts`.

Extract the dirty-tracking and auto-save diff logic:

- `hasFormChanged`, `updateOriginalFormValues`, `applyFormChangesToThreatModel`
- The **field-diff builder** currently inline in `performAutoSave`
  (tm-edit.component.ts:3013–3050: changed-field detection plus the defensive
  `authorization` / `owner` strip) — extracted as a pure
  `buildUpdates(formValues, originalValues)` method. This is the most valuable
  unit to test.
- `setupFormChangeMonitoring` stays partly in the component (it wires RxJS to
  the live `FormGroup`), but delegates the debounced decision logic to the
  service.

The service takes plain form-value objects and `ThreatModelService`; no
`FormGroup` or DOM dependency in the testable surface. Full unit spec on
`buildUpdates` and `hasFormChanged`.

**Checkpoint 2:** lint + build + related tests green. One commit (`refactor:`).

### Phase 3 — Seam prototype + decision (no commitment yet)

Prototype the entity-CRUD extraction against **one entity (documents)** two
ways:

- **(a) Dialog-result-handler split** — `MatDialog.open()` stays in the
  component; the result handlers (the success / array-mutate / service-call
  logic that runs after `afterClosed()` emits) move to the service, which
  receives the dialog result as a plain object.
- **(b) Injectable `DialogService` wrapper** — a thin service wrapping
  `MatDialog.open` per dialog type, returning a typed `Observable` of the
  result; the CRUD service depends on the wrapper and tests mock it.

Then **stop and present** to the user: which seam reads cleaner, and whether
extracting all six entity groups into a `TmEntityCrudService` is worth the
~2,000 lines moved. **Phase 4 does not start without explicit approval at this
gate.**

### Phase 4 — Conditional: full entity-CRUD extraction

Only if Checkpoint 3 approves. New file:
`src/app/pages/tm/services/tm-entity-crud.service.ts`.

Extract the six entity CRUD groups (threats, diagrams, documents, repositories,
notes, assets) plus the paginated `load*` / `*PageChange` loaders, using the
seam chosen in Phase 3. The component retains dialog-launch glue only. Full unit
spec.

## What stays in the component (always)

Lifecycle hooks (`ngOnInit`, `ngAfterViewInit`, `ngOnDestroy`), `MatSort` /
`MatPaginator` `@ViewChild` wiring, hover-preview timers (`onThumbnailHover` /
`onThumbnailLeave` / `hoverTimeout`), section-toggle booleans
(`toggleInputsSection` / `toggleOutputsSection`), SVG cache `Map`s
(`computeDiagramSvgData`, `clearSvgCaches`), and `ChangeDetectorRef` calls. This
is irreducible view glue.

## Testing

Vitest specs alongside each new service (`*.spec.ts`), following the existing
`threat-filter-state.service.spec.ts` and `providers/authorization-prepare.service.spec.ts`
patterns. No new E2E — the existing `workflows` suite covers residual component
behavior.

## Risks

- `extractViewBoxFromSvg` / `isValidBase64Svg` use `DOMParser`. Vitest's jsdom
  provides it, but specs must assert against jsdom behavior, not browser
  behavior.
- The Phase 2 `setupFormChangeMonitoring` split must not change auto-save
  debounce timing. E2E auto-save coverage is the safety net; verify timing is
  unchanged before committing Phase 2.

## Out of scope

- The sibling `dfd.component` extraction is filed separately as #694.
- No unrelated refactoring of the component's template or styles.
