# Design: tm-edit page field organization

**Issue:** [#488](https://github.com/ericfitz/tmi-ux/issues/488) — Improve formatting of static text fields on tm-edit page
**Date:** 2026-03-15

## Problem

The tm-edit page's "Threat Model Details" card mixes editable form fields with readonly system-managed metadata in a two-column grid. The static fields (creator, created_at, modified_at, status_updated, ID) lack visual distinction from editable fields, making the card feel unstructured.

## Solution

Reorganize the card's 12 fields into three semantic groups — Identity, Review Process, and Audit — rendered as a primary card plus two collapsible expansion panels.

## Field Grouping

| Group | Fields | Rationale |
|-------|--------|-----------|
| **Identity** | Name, Description, Project | What this threat model is |
| **Review Process** | Status, Status Last Updated, Security Reviewer, Issue URI, Framework | How the review is conducted and tracked |
| **Audit** | ID (+ copy), Created By, Created, Last Modified | System-managed tracking information |

## Layout

### Identity Card (`<mat-card>`)

Retains the "Threat Model Details" title, all action buttons (metadata, kebab menu, close), and the existing Name and Description form fields. Project picker moves up from the old left column into this card, below Description, as a full-width field.

The current two-column grid layout (`details-columns`) is removed entirely.

### Review Process Panel (`<mat-expansion-panel>`)

**Default state:** Collapsed.

**Collapsed view:** Below the "Review Process" header, a summary line showing three inline key-value pairs:
- **Status:** value in primary text color
- **Updated:** date in secondary text color
- **Reviewer:** name in primary text color
- Unset values display "—"
- Font size: 12px

**Expanded view:** Two-column grid with `grid-template-columns: 2fr 1fr`:

| Left (2fr) | Right (1fr) |
|------------|-------------|
| Status dropdown | Status Last Updated (readonly text) |
| Security Reviewer (dropdown or picker per `securityReviewerMode`) | *(empty)* |
| Issue URI (input + open-in-new-tab button) | Framework dropdown |

- All dropdowns use `appearance="outline"`
- `canEdit` logic unchanged — non-editors see readonly label-value pairs
- Status Last Updated is always readonly
- Framework hint about locking when threats exist is preserved
- **Note:** This deliberately reorders the fields from the current layout. Currently Framework appears before Issue URI in a `2fr 3fr` grid. The new layout swaps their positions (Issue URI left, Framework right) and uses `2fr 1fr` proportions. Framework dropdown names are short enough for the narrower column.
- Responsive: single column on mobile (`< 768px`)

### Audit Panel (`<mat-expansion-panel>`)

**Default state:** Collapsed.

**Collapsed view:** Panel header "Audit" on the left, "Modified [date]" right-aligned in secondary text color.

**Expanded view:** Two-column grid with `grid-template-columns: 2fr 1fr`, font-size 12px, secondary text color:

| Left (2fr) | Right (1fr) |
|------------|-------------|
| **ID:** truncated value + copy button | **Last Modified:** date |
| **Created by:** `<app-user-display>` | **Created:** date |

- ID uses existing `metadata-id` truncation and `copy-id-button` styles
- Panel has a subtle background tint (`var(--theme-surface)`) to visually de-emphasize
- Dates use `date: 'short'` pipe with locale
- On mobile, grid stays 2x2 (content is compact enough)

### Accordion

Both panels sit inside a `<mat-accordion>` below the Identity card. Panels expand and collapse independently (not mutually exclusive). Default Angular Material expand/collapse animation is used.

### New Threat Model State

When `isNewThreatModel` is true, both panels are shown collapsed. Their collapsed summaries display "—" for all values (same as today's behavior for empty fields). This keeps the page structure consistent and avoids layout shift when the model is first saved.

## Components Affected

- `tm-edit.component.html` — restructure template
- `tm-edit.component.scss` — remove two-column grid styles, add panel and summary styles
- No new components needed
- i18n files (all locales) — add new keys for panel headers (e.g., `threatModels.sections.reviewProcess`, `threatModels.sections.audit`). Existing field label keys are reused.
- No changes to data model or services

## What This Does NOT Change

- The Identity card header (title, action buttons, kebab menu)
- Field behavior, validation, or save logic
- `canEdit` permission gating
- The sections below the details card (assets, documents, diagrams, etc.)
