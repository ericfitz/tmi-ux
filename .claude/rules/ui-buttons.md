---
paths:
  - 'src/**/*.html'
  - 'src/**/*.scss'
---

# UI Terminology

The application uses exactly three button variants. Every button must use one of them; `mat-raised-button`, `mat-stroked-button`, `mat-fab`, and `mat-mini-fab` are banned.

## Filled button

`mat-flat-button color="primary"` for the primary affirmative action (Save, Confirm, Create, Apply). At most one per dialog or page action bar.

`mat-flat-button color="warn"` for the primary action when it is destructive or irreversible (Delete, Remove, Revoke, Rollback). Replaces the affirmative filled button — never both in the same action group.

Filled buttons render pill-shaped (Material 3 default) and may contain `<mat-icon>` plus label text.

## Text button

`mat-button` (no `color` attribute) for dismissive actions (Cancel, Close, Dismiss) and tertiary actions. Sits to the left of the filled button in `mat-dialog-actions align="end"`.

May contain `<mat-icon>` plus label text.

## Action button

A `mat-icon-button` that displays only an icon (no text label) and uses `matTooltip` (and matching `[attr.aria-label]`) to show the button's localized label. Used for single-action invocations against an object (edit, delete, add, more-menu trigger).

Action buttons must not implement any button styling locally — centering and icon sizing are handled globally by the `.mat-mdc-icon-button` override in `src/styles/component-overrides.scss`.

## Color rules

- `color="primary"` only on `mat-flat-button` and on `mat-icon-button` when the icon should be tinted primary.
- `color="warn"` only on the destructive variant (filled or icon).
- `color="accent"` / `color="tertiary"` are not used.
- No `color` attribute on `mat-button`.
- All colors must route through Material's themed palettes (`primary`, `warn`) or `var(--theme-*)` / `var(--color-*)` CSS variables. Never hard-code hex on buttons. The four palette combinations (light-normal, dark-normal, light-colorblind, dark-colorblind) must all render correctly.

## Dialog action ordering

In every `mat-dialog-actions align="end"` block, DOM order is `[Cancel (mat-button)] [Primary (mat-flat-button)]`. `cdkFocusInitial` goes on the primary affirmative button so Enter commits the user's intent.

**Exception:** if the primary is destructive (`mat-flat-button color="warn"`), `cdkFocusInitial` moves to Cancel so an accidental Enter does not destroy data.

## Documented exception

The **Timmy launcher button** at `src/app/pages/tm/tm-edit.component.html` (`class="timmy-header-button"`) is an oversized `mat-icon-button` with an `<img>` child that opens the Timmy AI chat. The larger size and image content are intentional. Do not refactor it as part of button-style audits.
