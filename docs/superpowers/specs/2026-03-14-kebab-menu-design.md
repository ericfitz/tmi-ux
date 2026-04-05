# Kebab Menu for Action Buttons

**Issue:** [#481 — refactor: hide action buttons behind a kebab menu](https://github.com/ericfitz/tmi-ux/issues/481)
**Date:** 2026-03-14

## Overview

Reduce UI clutter by moving less-frequently used action buttons into a kebab menu (vertical ellipsis / `more_vert`). The kebab button is itself a `mat-icon-button` placed among the remaining visible buttons. Clicking it opens a `mat-menu` containing the moved actions as `mat-menu-item` entries.

## Rules

### Exclusion list (stay visible, never go in kebab)

- Close
- Manage Metadata
- Add / Create
- Edit
- Save
- View (includes any view-type action: View Members, View Response, etc.)
- Cancel

### Always in kebab

- **Delete** — always the last item in the menu. When other items exist above it, a `mat-divider` separates them from Delete. No color change — Delete uses the same styling as other menu items.

### Move to kebab (everything not in the exclusion list)

All other `mat-icon-button` action buttons move into the kebab menu. This includes but is not limited to: Addons, Download, Audit Trail, Export, Report, Permissions, Transfer Ownership.

Note: Only `mat-icon-button` elements **within action button areas** (`.action-buttons` divs or table action columns) are in scope. Text buttons (`mat-stroked-button`, `mat-raised-button`, `mat-flat-button`) are not action buttons and are not affected. Utility buttons outside action areas (e.g., clear-filter buttons, URL link buttons, copy-to-clipboard buttons in data displays) are also not in scope.

### Buttons with existing sub-menus

Buttons that currently trigger their own `mat-menu` become menu items that open a **nested submenu** inside the kebab. Currently this applies to:
- **Addons** (`extension` icon) — all locations where it appears
- **Download** (`download` icon) — only in the **Diagrams table rows** where it has a sub-menu (JSON/YAML/GraphML options)

The Download button in **Notes table rows** is a simple action (no sub-menu) and becomes a plain menu item.

### Scope exclusions (not modified by this change)

- Nav bar toolbar
- DFD editor toolbar
- Markdown editor toolbar

## Kebab button spec

- **Icon:** `more_vert`
- **Tooltip:** `{{ 'common.actions' | transloco }}` (key already exists)
- **Element:** `mat-icon-button` (styled by existing global `.mat-mdc-icon-button` override in `src/styles/component-overrides.scss`)

## Positioning

- **Table rows:** kebab is the last (rightmost) button
- **Page/card headers with Close button:** Close remains last, kebab is second-to-last
- **Page/card headers without Close button:** kebab is last
- **Card content / inline items** (e.g., TM cards, survey draft items): kebab replaces the existing action button(s) in the same position

## Menu item ordering

Non-Delete items are ordered by frequency/importance (use judgment). Delete is always last, preceded by a `mat-divider` when other items are present. When Delete is the only item, no divider.

## Per-location changes

### tm.component.html

| Location | Stays Visible | Kebab Contains |
|----------|--------------|----------------|
| Page header | Create | Import |
| TM card | *(none)* | Delete |

### tm-edit.component.html — Details card header

The Details card header has: Export, Addons, Report, Audit Trail, Manage Metadata, Permissions, Close.

| Stays Visible | Kebab Contains | Position |
|--------------|----------------|----------|
| Manage Metadata | Export, Addons (submenu), Report, Audit Trail, Permissions | kebab, then Close (last) |

Note: No Delete on the Details card header, so no divider in the menu. Close stays last per positioning rules.

### tm-edit.component.html — Other card headers

| Card | Stays Visible | Kebab Contains |
|------|--------------|----------------|
| Assets | Add | Addons (submenu) |
| Documents | Add | Addons (submenu) |
| Repositories | Add | Addons (submenu) |
| Notes | Add | Addons (submenu) |
| Diagrams | Add | Addons (submenu) |
| Threats | Add | Addons (submenu) |

### tm-edit.component.html — Table row actions

| Table | Stays Visible | Kebab Contains |
|-------|--------------|----------------|
| Assets | Manage Metadata | Addons (submenu), Audit Trail, ── Delete |
| Documents | Manage Metadata | Addons (submenu), Audit Trail, ── Delete |
| Repositories | Manage Metadata | Addons (submenu), Audit Trail, ── Delete |
| Notes | Manage Metadata | Download, Addons (submenu), Audit Trail, ── Delete |
| Diagrams | Manage Metadata | Addons (submenu), Audit Trail, Download (submenu), ── Delete |
| Threats | Manage Metadata | Addons (submenu), Audit Trail, ── Delete |

### threat-page.component.html — Header

| Stays Visible | Kebab Contains | Position |
|--------------|----------------|----------|
| Manage Metadata, Save | Addons (submenu), ── Delete | kebab, then Close (last) |

### note-page.component.html — Header

| Stays Visible | Kebab Contains | Position |
|--------------|----------------|----------|
| Manage Metadata, Save | Addons (submenu), ── Delete | kebab, then Close (last) |

### admin-groups.component.html — Row actions

| Stays Visible | Kebab Contains |
|--------------|----------------|
| View Members | Delete |

### admin-users.component.html — Row actions

| Stays Visible | Kebab Contains |
|--------------|----------------|
| *(none)* | Transfer Ownership, ── Delete |

### admin-webhooks.component.html — Item actions

The Link button is in the URL display column, not in the actions area. The only action button is Delete.

| Stays Visible | Kebab Contains |
|--------------|----------------|
| *(none)* | Delete |

### admin-settings.component.html — Row actions

The settings table has two mutually exclusive states per row:

| State | Stays Visible | Kebab Contains |
|-------|--------------|----------------|
| Non-editing | Edit | Delete |
| Editing | Save, Cancel | *(no kebab — Delete not shown during editing)* |

### admin-quotas.component.html — Row actions

Both the User API Quotas and Webhook Quotas tables have the same two mutually exclusive states per row:

| State | Stays Visible | Kebab Contains |
|-------|--------------|----------------|
| Non-editing | Edit | Delete |
| Editing | Save, Cancel | *(no kebab — Delete not shown during editing)* |

### admin-addons.component.html — Row actions

| Stays Visible | Kebab Contains |
|--------------|----------------|
| *(none)* | Delete |

### my-responses.component.html — Draft row actions

| Stays Visible | Kebab Contains |
|--------------|----------------|
| Edit | Delete |

### survey-list.component.html — Draft item

| Stays Visible | Kebab Contains |
|--------------|----------------|
| *(none)* | Delete |

## Locations NOT getting kebab menus

| Location | Reason |
|----------|--------|
| triage-list rows | All primary workflow actions |
| triage-detail header | Header only has Close; other buttons are in card body |
| admin-surveys rows | Already has a kebab menu (`more_vert` with Clone/Archive/Unarchive) |
| my-responses non-draft rows | Only has View (excluded), no secondary actions |

## Implementation approach

Inline `mat-menu` + kebab trigger button added directly in each template. No shared component or directive — each location defines its own menu items. This keeps templates self-describing and follows existing patterns.

## i18n

No new keys needed. The kebab tooltip uses the existing `common.actions` key ("Actions").

## Testing

Each modified component's existing unit tests should be updated to verify:
- Kebab button is rendered
- Menu opens on click
- Expected menu items are present
- Excluded buttons remain visible outside the kebab
- Delete is last in menu with divider when applicable
- Submenu triggers work for Addons/Download
