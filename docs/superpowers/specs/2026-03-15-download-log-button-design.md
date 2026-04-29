# Download Log Button — Design Spec

## Summary

Move the "Export Application Log" button from the Danger tab to the User Profile tab in the user preferences dialog. Rename the label to "Download Log" and restyle as a filled pill button in a right-column layout.

## Current State

- The "Export Application Log" button lives in the Danger tab alongside "Transfer My Data" and "Delete All My Data"
- It uses `mat-raised-button` with no color, a `download` icon, and transloco key `userPreferences.exportLog.title`
- Hint text below uses `userPreferences.exportLog.hint`
- The Profile tab is a single-column vertical list of profile fields

## Design

### Profile Tab — Two-Column Layout

Convert the Profile tab content area to a two-column flex layout:

- **Left column** (`flex: 1`): Existing profile info (name, email, provider, provider ID, groups, current role) — no changes to content or structure
- **Right column**: Separated by a `mat-divider` with `[vertical]="true"`, vertically centered, containing:
  - A `mat-raised-button` with `color="primary"`, `(click)="onExportLog()"`, and pill styling (`border-radius: 24px`, padding `10px 24px`)
  - Material `download` icon + label bound to `userPreferences.downloadLog.title`
  - Helper text below bound to `userPreferences.downloadLog.hint`

### Danger Tab

Remove:
- The export log button and its container `preference-item` div
- The hint paragraph
- The `mat-divider` that follows the export log section

The Danger tab will start directly with the "Transfer My Data" button.

### Styles

Add:
- `.profile-layout` — flex container for the two-column layout (`display: flex; gap: 24px`)
- `.profile-actions` — right column styling (`display: flex; align-items: center; padding-left: 16px`)
- `.download-log-button` — pill shape override (`border-radius: 24px; padding: 10px 24px`)
- `.download-log-hint` — helper text styling (reuse existing `.danger-hint` sizing: `font-size: 12px; color: var(--theme-text-secondary)`)

Remove:
- `.export-log-button` rule (lines 696–700)
- `.export-log-button mat-icon` rule (lines 702–707)

### Logic

No changes. `onExportLog()` continues to call `this.logger.downloadLog()`.

### Localization

**en-US.json:**
- Add `userPreferences.downloadLog.title`: `"Download Log"`
- Rename `userPreferences.exportLog.hint` → `userPreferences.downloadLog.hint` (same English value)
- Remove `userPreferences.exportLog.title` and `userPreferences.exportLog.hint`

**All other locale files:**
- Delete `userPreferences.exportLog.title` (localization-backfill will re-translate under `downloadLog.title`)
- Rename `userPreferences.exportLog.hint` → `userPreferences.downloadLog.hint` (preserve existing translated value)

### Tests

No `user-preferences-dialog.component.spec.ts` exists. No test changes needed.

### Files Changed

1. `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts` — template and styles
2. `src/assets/i18n/en-US.json` — rename keys, update title value
3. `src/assets/i18n/*.json` (all other locales) — delete `exportLog.title`, rename `exportLog.hint` → `downloadLog.hint`
