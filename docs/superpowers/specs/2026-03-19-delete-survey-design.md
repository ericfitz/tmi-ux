# Design: Add "Delete Survey" Option

**Issue:** [#521](https://github.com/ericfitz/tmi-ux/issues/521)
**Date:** 2026-03-19
**Branch:** release/1.3.0

## Overview

Add a delete action for surveys in two places:
1. The admin surveys list page (`/admin/surveys`) — in the existing `mat-menu` per row
2. The survey edit page (`/admin/surveys/{surveyId}`) — as an action button in the header

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Confirmation style | Native `confirm()` | Used by other admin list pages (webhooks, users, groups); using localized message via Transloco is an improvement over some that hardcode English |
| Error display | MatSnackBar | Matches existing admin snackbar usage in admin-users component |
| List placement | Inside existing `mat-menu` (last item) | Groups with other secondary/destructive actions; reduces accidental clicks |
| Edit page placement | `mat-icon-button` in header action group | Consistent with action button pattern |
| Color styling | No explicit color on delete action button | Per project decision; other header buttons use color but delete intentionally does not |
| Active survey deletion | Allowed for any status | API is responsible for rejecting if inappropriate; no client-side status guard |

## Design

### 1. Admin Surveys List (`admin-surveys.component`)

Add a "Delete" menu item as the last entry in the existing `mat-menu` for each survey row.

**Menu item:**
- Icon: `delete`
- Label: `common.delete` (localized via Transloco)
- Position: last item in the menu (after clone, archive, unarchive)

**Behavior:**
1. User clicks "Delete" in the menu
2. Native `confirm()` with localized message: call `this.transloco.translate('common.confirmDelete', { item: this.transloco.translate('common.objectTypes.survey'), name: survey.name })` and pass the result to `confirm()`
3. If confirmed, call `SurveyService.deleteSurvey(surveyId)`, piped through `takeUntilDestroyed(this.destroyRef)` (matches existing pattern in this component)
4. On success:
   - Call `loadTemplates()` to reload the survey list (note: `SurveyService.deleteSurvey()` also triggers an internal list refresh — this double fetch is consistent with how clone/archive work in this component)
   - Call `this.cdr.markForCheck()` (component uses OnPush change detection)
5. On error:
   - Show `MatSnackBar` with `adminSurveys.deleteError` message and `common.dismiss` button
   - Duration: 5000ms (matches existing admin snackbar pattern in admin-users)
   - Call `this.cdr.markForCheck()`

**New dependencies:** `MatSnackBar` must be injected into the component.

**Note:** This component does not use server-side pagination — it loads all surveys and filters client-side. No pagination adjustment is needed.

### 2. Template Builder / Survey Edit (`template-builder.component`)

Add a delete action button to the header button group.

**Button:**
- `mat-icon-button` with `delete` icon
- `matTooltip` with `adminSurveys.deleteTooltip` (localized)
- No `color` attribute (per project decision — existing Save uses `color="primary"` and Close uses `color="warn"`, but delete intentionally omits color)
- Positioned before Save button (leftmost in the action group, separated from the primary Save/Close actions the user reaches for most often)
- Hidden when creating a new survey (`/admin/surveys/new`)
- Disabled while `isSaving` is true (prevents race condition with in-flight save)

**Behavior:**
1. User clicks the delete action button
2. Native `confirm()` with localized message (same pattern as list — `this.translocoService.translate('common.confirmDelete', ...)`)
3. If confirmed, call `SurveyService.deleteSurvey(surveyId)`, piped through `takeUntil(this.destroy$)` (matches existing subscription pattern in this component)
4. On success: navigate to `/admin/surveys`
5. On error: show `MatSnackBar` with `adminSurveys.deleteError` and `common.dismiss`

**New dependencies:** `MatSnackBar` must be injected into the template-builder component.

**Note:** This component uses `ChangeDetectionStrategy.Default`, so `markForCheck()` is not needed. The existing `TranslocoService` injection (`translocoService`) is used for translation.

**Unsaved changes:** If the user has unsaved changes when clicking delete, the delete confirmation is sufficient on its own — no additional "unsaved changes" warning is needed since deletion supersedes saving.

### 3. Localization

**Reuse existing keys:**
- `common.delete` ("Delete") — for menu item label text
- `common.confirmDelete` ("Are you sure you want to delete the {{item}} "{{name}}"? This action cannot be undone.") — for confirmation message
- `common.objectTypes.survey` ("Survey") — for the `item` param in confirmDelete
- `common.dismiss` ("Dismiss") — for snackbar dismiss button

**New keys (under `adminSurveys`):**
- `adminSurveys.deleteError` — "Failed to delete survey: {{error}}"
- `adminSurveys.deleteTooltip` — "Delete survey"

New keys must be added to all language files.

### 4. Testing

**admin-surveys.component.spec.ts:**
- Delete via menu: confirm → calls `deleteSurvey()` → reloads list
- Delete via menu: confirm → API error → shows snackbar with error
- Delete via menu: cancel confirm → does not call `deleteSurvey()`

**template-builder.component.spec.ts:**
- Delete button visible when editing existing survey
- Delete button hidden when creating new survey
- Delete button disabled while `isSaving` is true
- Delete: confirm → calls `deleteSurvey()` → navigates to `/admin/surveys`
- Delete: confirm → API error → shows snackbar with error
- Delete: cancel confirm → does not call `deleteSurvey()`

No changes needed to `SurveyService` tests — `deleteSurvey()` already exists and is tested.
