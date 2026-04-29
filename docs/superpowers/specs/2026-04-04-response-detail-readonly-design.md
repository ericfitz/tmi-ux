# Fix: Make Response Detail Page Fully Read-Only

**Issue:** [#550](https://github.com/ericfitz/tmi-ux/issues/550) — viewing a response should not be editable
**Date:** 2026-04-04

## Problem

The `ResponseDetailComponent` at `/intake/response/:responseId` is intended to be a read-only view of submitted survey responses. The SurveyJS model is correctly set to `display` mode, but the project picker (`<app-project-picker>`) renders as an editable dropdown with an "add project" button. Changing the dropdown fires `onProjectChange()`, which PATCHes the server and can null out the project assignment.

## Navigation Context

`ResponseDetailComponent` is only reached from `MyResponsesComponent.viewResponse()` when the response status is `submitted`, `ready_for_review`, or `review_created`. Editable responses (`draft`, `needs_revision`) route to `SurveyFillComponent` instead. Triage has its own detail view. No editing use case exists for this component.

## Design

### Changes to `response-detail.component.ts`

- Remove `ProjectPickerComponent` from imports array
- Inject `ProjectService`
- Add `projectName: string | null` property
- After loading the response, if `project_id` exists, call `ProjectService.get()` to resolve the project name
- Remove `onProjectChange()` method

### Changes to `response-detail.component.html`

- Replace the `<div class="project-picker-section">` block with a static info item displaying the project name, using the same layout pattern as existing info items (label + value)
- Only render the project row when `response.project_id` is set

### Tests

- Confirm the resolved project name (not the UUID) displays as static text
- Confirm no editable controls (dropdowns, buttons) are rendered

## Out of Scope

- Dual read/edit mode for this component (not needed — editing uses `SurveyFillComponent`)
- Localization backfill for non-English locales (add the English key; backfill is a separate task)
