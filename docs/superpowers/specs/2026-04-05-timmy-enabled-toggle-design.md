# Design: "Include in Timmy chat" toggle

**Issues:** #554, #555
**Date:** 2026-04-05
**Branch:** dev/1.4.0

## Overview

Add an "Include in Timmy chat" checkbox to all entity edit dialogs (assets, threats, documents, repositories, notes) and to the DFD editor header. The toggle controls the `timmy_enabled` boolean property on each entity, which determines whether the entity is included in Timmy's context when a chat session is created.

## i18n

One shared key used everywhere:

```
"common.includeInTimmyChat": "Include in Timmy chat"
```

Backfill to all 15 locales via localization-backfill process.

## #554 — Entity edit dialogs

### Changes per dialog

Each of the 5 entity editor dialog components (asset, threat, document, repository, note) gets:

1. **Form control** — Add `timmy_enabled` to the `FormGroup`, initialized from `this.data.entity?.timmy_enabled ?? true`.
2. **Template** — Add a `mat-checkbox` immediately after the existing `include_in_report` checkbox:
   ```html
   <div class="checkbox-field">
     <mat-checkbox formControlName="timmy_enabled">
       {{ 'common.includeInTimmyChat' | transloco }}
     </mat-checkbox>
   </div>
   ```
3. **Submit** — The form value already includes `timmy_enabled` via reactive forms, so it flows through `dialogRef.close()` without additional wiring.

### Model updates

Add `timmy_enabled?: boolean` to the local interfaces in `threat-model.model.ts`: Document, Repository, Note, Asset, Threat.

### No new imports

`MatCheckboxModule` is already used in all dialogs via `FORM_MATERIAL_IMPORTS`.

## #555 — DFD editor header

Follow the existing `include_in_report` checkbox pattern:

1. **DiagramData interface** (`app-diagram.service.ts`) — Add `timmy_enabled?: boolean`.
2. **Component property** (`dfd.component.ts`) — Add `timmyEnabled = true`.
3. **Load** — Set `this.timmyEnabled = diagram.timmy_enabled ?? true` during diagram load.
4. **Template** (`dfd.component.html`) — Add checkbox after the `include_in_report` checkbox in the header.
5. **Handler** — `onTimmyEnabledChange(checked: boolean)` calls `patchDiagramProperties()`, updates local state, updates orchestrator metadata.
6. **patchDiagramProperties()** (`threat-model.service.ts`) — Extend the `properties` parameter type to include `timmy_enabled?: boolean` and add the JSON Patch operation.
7. **Orchestrator** (`app-dfd-orchestrator.service.ts`) — Extend `updateDiagramMetadata()` to accept `timmyEnabled`.

## Testing

Unit tests for each modified component:
- Toggle defaults to checked when `timmy_enabled` is undefined or true
- Toggle is unchecked when `timmy_enabled` is false
- Form/handler emits the correct value on change

## Out of scope

- Timmy chat page source panel (removed in client-server integration)
- Server-side handling of `timmy_enabled` during session creation
