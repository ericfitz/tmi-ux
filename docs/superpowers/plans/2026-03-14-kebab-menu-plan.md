# Kebab Menu for Action Buttons — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move less-frequently used action buttons into kebab menus (`more_vert`) across the app to reduce UI clutter.

**Architecture:** Each location gets an inline `mat-menu` with a `more_vert` trigger button. No shared components — each template defines its own menu items. Existing Addons/Download sub-menus become nested submenus within the kebab. Delete is always last in the menu, separated by `mat-divider` when other items precede it.

**Tech Stack:** Angular Material (`mat-menu`, `mat-menu-item`, `mat-divider`, `mat-icon-button`), Transloco i18n

**Spec:** `docs/superpowers/specs/2026-03-14-kebab-menu-design.md`

---

## Prerequisites

All components already import `CORE_MATERIAL_IMPORTS` from `src/app/shared/imports.ts`, which includes `MatMenuModule` and `MatDividerModule`. No import changes are needed.

The i18n key `common.actions` already exists in `src/assets/i18n/en-US.json` (line 528) with value `"Actions"`. No new i18n keys are needed.

The kebab button styling is handled by the existing global `.mat-mdc-icon-button` override in `src/styles/component-overrides.scss`. No CSS changes are needed.

## Pattern Reference

Every kebab menu follows this template pattern. Adapt per location by changing the menu items:

```html
<!-- Kebab trigger button -->
<button
  mat-icon-button
  [matMenuTriggerFor]="kebabMenu"
  [matTooltip]="'common.actions' | transloco"
  [attr.aria-label]="'common.actions' | transloco"
  (click)="$event.stopPropagation()"
>
  <mat-icon>more_vert</mat-icon>
</button>

<!-- Kebab menu -->
<mat-menu #kebabMenu="matMenu">
  <!-- Non-delete items first -->
  <button mat-menu-item (click)="someAction()">
    <mat-icon>icon_name</mat-icon>
    <span>{{ 'i18n.key' | transloco }}</span>
  </button>
  <!-- Divider before Delete (only if other items exist above) -->
  <mat-divider></mat-divider>
  <!-- Delete is always last -->
  <button mat-menu-item (click)="deleteAction()">
    <mat-icon>delete</mat-icon>
    <span>{{ 'common.delete' | transloco }}</span>
  </button>
</mat-menu>
```

For **submenu triggers** (Addons, Download on Diagrams), the existing `mat-menu` definition stays as-is. The trigger button changes from `mat-icon-button` to `mat-menu-item` with `[matMenuTriggerFor]`:

```html
<!-- Inside the kebab menu -->
<button mat-menu-item [matMenuTriggerFor]="existingSubmenu">
  <mat-icon>extension</mat-icon>
  <span>{{ 'common.addons' | transloco }}</span>
</button>
```

## Chunk 1: tm-edit — Card Headers and Table Row Actions

This is the largest change. The `tm-edit.component.html` file has 6 card headers and 6 table row action groups to convert.

### Task 1: tm-edit — Details Card Header

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html:28-94` (Details card header action buttons)

The Details card header currently has: Export, Addons, Report, Audit Trail, Manage Metadata, Permissions, Close.

**After:** Manage Metadata stays visible. Kebab contains: Export, Addons (submenu), Report, Audit Trail, Permissions. Close stays last. No Delete, so no divider.

- [ ] **Step 1: Restructure the Details card header actions**

In `tm-edit.component.html`, locate the `<div class="action-buttons">` inside the Details card header (around line 28). Replace the action buttons with:

1. Keep Manage Metadata button as-is
2. Add kebab trigger button with `[matMenuTriggerFor]="detailsKebabMenu"`
3. Keep Close button last
4. Add `<mat-menu #detailsKebabMenu="matMenu">` containing:
   - Export button as `mat-menu-item` (icon: `file_download`, click: `downloadToDesktop()`, label: `'threatModels.export'`)
   - Addons as `mat-menu-item` with `[matMenuTriggerFor]="detailsAddonsMenu"` (icon: `extension`, label: `'common.addons'`) — only shown when `canEdit`
   - Report as `mat-menu-item` (icon: `assignment` with `fontSet="material-symbols-outlined"`, click: `openReport()`, label: `'common.objectTypes.report'`)
   - Audit Trail as `mat-menu-item` (icon: `contract` with `fontSet="material-symbols-outlined"`, click: `openAuditTrail()`, label: `'auditTrail.title'`)
   - Permissions as `mat-menu-item` (icon: `lock`, click: `openPermissionsDialog()`, label: `'common.permissions'`)

The existing `<mat-menu #detailsAddonsMenu>` definition stays unchanged.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Visual check**

Run: `pnpm run dev`, navigate to a threat model edit page, verify:
- Manage Metadata button is visible
- Kebab button (⋮) appears between Manage Metadata and Close
- Clicking kebab shows Export, Addons, Report, Audit Trail, Permissions
- Addons opens a submenu
- Close button is last (rightmost)

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "refactor: move Details card header actions into kebab menu (#481)"
```

### Task 2: tm-edit — Assets, Documents, Repositories Card Headers

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html` (Assets, Documents, Repositories card headers)

All three follow the same pattern: currently have Addons + Add. After: Add stays visible, Addons (submenu) goes in kebab.

- [ ] **Step 1: Convert Assets card header**

Locate the Assets card header `<div class="action-buttons">` (around line 426). Replace:
1. Add kebab trigger with `[matMenuTriggerFor]="assetsHeaderKebabMenu"`
2. Keep Add button
3. Add `<mat-menu #assetsHeaderKebabMenu="matMenu">` with Addons submenu trigger pointing to existing `assetsAddonsMenu`

- [ ] **Step 2: Convert Documents card header**

Same pattern. Locate Documents card header. Replace with kebab containing Addons submenu trigger pointing to existing `documentsAddonsMenu`. Keep Add button.

- [ ] **Step 3: Convert Repositories card header**

Same pattern. Locate Repositories card header (around line 836). Replace with kebab containing Addons submenu trigger pointing to existing `repositoriesAddonsMenu`. Keep Add button.

- [ ] **Step 4: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "refactor: move Assets/Documents/Repositories card header actions into kebab (#481)"
```

### Task 3: tm-edit — Notes, Diagrams, Threats Card Headers

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html` (Notes, Diagrams, Threats card headers)

Same pattern as Task 2: Add stays visible, Addons goes in kebab.

- [ ] **Step 1: Convert Notes card header**

Locate Notes card header (around line 1056). Replace with kebab containing Addons submenu trigger. Keep Add button.

- [ ] **Step 2: Convert Diagrams card header**

Locate Diagrams card header (around line 1229). Replace with kebab containing Addons submenu trigger. Keep Add button.

- [ ] **Step 3: Convert Threats card header**

Locate Threats card header (around line 1461). Replace with kebab containing Addons submenu trigger. Keep Add button.

- [ ] **Step 4: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "refactor: move Notes/Diagrams/Threats card header actions into kebab (#481)"
```

### Task 4: tm-edit — Assets Table Row Actions

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html` (Assets table row actions, around lines 548-599)

Currently: Addons, Audit Trail, Manage Metadata, Delete. After: Manage Metadata stays visible. Kebab contains: Addons (submenu), Audit Trail, divider, Delete.

- [ ] **Step 1: Restructure Assets row actions**

In the Assets table `actions` column `<td>`:
1. Keep Manage Metadata button
2. Add kebab trigger (last in row) with `[matMenuTriggerFor]="assetRowKebabMenu"`
3. Remove the individual Addons, Audit Trail, Delete buttons
4. Add `<mat-menu #assetRowKebabMenu="matMenu">` containing:
   - Addons as submenu trigger → existing row addons menu (note: the row addon menu uses dynamic context via `setAddonRowContext()` — this click handler must move to the kebab trigger or submenu trigger, preserving `$event.stopPropagation()`)
   - Audit Trail as `mat-menu-item` (icon: `contract`, `fontSet="material-symbols-outlined"`, click handler calling `openEntityAuditTrail(...)`)
   - `<mat-divider>`
   - Delete as `mat-menu-item` (icon: `delete`, click handler calling `deleteAsset(...)`) — keep the `@if (canEdit)` guard

**Important:** Each row needs its own menu reference. Since the menu is inside an `*matCellDef` loop, Angular creates separate instances per row. Use a single template reference name (e.g., `#assetRowKebabMenu`) — Angular's structural directive handles scoping.

However, the Addons submenu trigger in rows is more complex because the row-level addons menu uses `setAddonRowContext()` to set which entity the addon operates on. The existing pattern calls `setAddonRowContext()` on the Addons button `(click)` handler. When moving into the kebab menu, this context-setting must happen on the kebab menu item click, before the submenu opens. Keep the `(click)="$event.stopPropagation(); setAddonRowContext('asset', asset.id, asset.name, asset.metadata)"` on the Addons menu item.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "refactor: move Assets row actions into kebab menu (#481)"
```

### Task 5: tm-edit — Documents Table Row Actions

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html` (Documents table row actions)

Same pattern as Assets: Manage Metadata stays, Addons (submenu) + Audit Trail + divider + Delete go in kebab.

- [ ] **Step 1: Restructure Documents row actions**

Follow the same pattern as Task 4. Key differences:
- Entity type is `'document'`
- Click handlers reference document-specific methods
- Addons submenu points to the document row addons menu

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "refactor: move Documents row actions into kebab menu (#481)"
```

### Task 6: tm-edit — Repositories Table Row Actions

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html` (Repositories table row actions, around lines 917-985)

Same pattern: Manage Metadata stays, Addons (submenu) + Audit Trail + divider + Delete go in kebab.

- [ ] **Step 1: Restructure Repositories row actions**

Follow the same pattern as Task 4. Entity type is `'repository'`.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "refactor: move Repositories row actions into kebab menu (#481)"
```

### Task 7: tm-edit — Notes Table Row Actions

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html` (Notes table row actions, around lines 1123-1182)

Currently: Download, Addons, Audit Trail, Manage Metadata, Delete. After: Manage Metadata stays. Kebab contains: Download (plain item, not submenu), Addons (submenu), Audit Trail, divider, Delete.

- [ ] **Step 1: Restructure Notes row actions**

Follow the same pattern as Task 4, but also include the Download button as a plain `mat-menu-item` (icon: `download`, click handler calling the download method). Download in Notes is a simple action, not a submenu.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "refactor: move Notes row actions into kebab menu (#481)"
```

### Task 8: tm-edit — Diagrams Table Row Actions

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html` (Diagrams table row actions, around lines 1336-1414)

Currently: Addons, Audit Trail, Manage Metadata, Download (submenu), Delete. After: Manage Metadata stays. Kebab contains: Addons (submenu), Audit Trail, Download (submenu), divider, Delete.

- [ ] **Step 1: Restructure Diagrams row actions**

Follow the same pattern as Task 4, but also include Download as a submenu trigger. The existing `<mat-menu #downloadModelMenu>` stays unchanged. The Download trigger becomes a `mat-menu-item` with `[matMenuTriggerFor]="downloadModelMenu"`.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "refactor: move Diagrams row actions into kebab menu (#481)"
```

### Task 9: tm-edit — Threats Table Row Actions

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html` (Threats table row actions, around lines 1746-1797)

Currently: Addons, Audit Trail, Manage Metadata, Delete. After: Manage Metadata stays. Kebab contains: Addons (submenu), Audit Trail, divider, Delete.

- [ ] **Step 1: Restructure Threats row actions**

Follow the same pattern as Task 4. Entity type is `'threat'`.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "refactor: move Threats row actions into kebab menu (#481)"
```

## Chunk 2: Threat Page, Note Page, and TM List

### Task 10: threat-page — Header Actions

**Files:**
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.html:19-73`

Currently: Addons, Manage Metadata, Delete, Save, Close. After: Manage Metadata and Save stay visible. Kebab contains: Addons (submenu), divider, Delete. Close stays last.

- [ ] **Step 1: Restructure threat-page header**

Reorder the action buttons:
1. Manage Metadata button (stays)
2. Save button (stays)
3. Kebab trigger with `[matMenuTriggerFor]="threatPageKebabMenu"`
4. Close button (stays last)

Add `<mat-menu #threatPageKebabMenu="matMenu">`:
- Addons as submenu trigger → existing addons menu
- `<mat-divider>`
- Delete as `mat-menu-item`

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/components/threat-page/threat-page.component.html
git commit -m "refactor: move threat-page header actions into kebab menu (#481)"
```

### Task 11: note-page — Header Actions

**Files:**
- Modify: `src/app/pages/tm/components/note-page/note-page.component.html:19-73`

Same layout as threat-page.

- [ ] **Step 1: Restructure note-page header**

Same pattern as Task 10: Manage Metadata, Save stay visible. Kebab with Addons (submenu), divider, Delete. Close last.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/components/note-page/note-page.component.html
git commit -m "refactor: move note-page header actions into kebab menu (#481)"
```

### Task 12: tm.component — Page Header and TM Cards

**Files:**
- Modify: `src/app/pages/tm/tm.component.html`

**Page header:** Currently Import + Create. After: Create stays, Import goes in kebab.

**TM cards:** Currently Delete only. After: Delete goes in kebab (single item, no divider).

- [ ] **Step 1: Add kebab to TM list page header**

In the page header action buttons, keep Create button. Add kebab with Import as the only menu item.

- [ ] **Step 2: Add kebab to TM cards**

In each TM card, replace the Delete `mat-icon-button` with a kebab trigger in the same position (per the "card content / inline items" positioning rule). The kebab menu contains only Delete (no divider since it's the only item). Include `(click)="$event.stopPropagation()"` on the kebab trigger since TM cards are clickable.

- [ ] **Step 3: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/tm/tm.component.html
git commit -m "refactor: move TM list page header and card actions into kebab menu (#481)"
```

## Chunk 3: Admin Pages

### Task 13: admin-groups — Row Actions

**Files:**
- Modify: `src/app/pages/admin/groups/admin-groups.component.html`

Currently: View Members + Delete. After: View Members stays. Kebab contains: Delete (single item, no divider).

- [ ] **Step 1: Add kebab to admin-groups rows**

Keep View Members button. Add kebab trigger (last) with Delete as the only menu item.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/groups/admin-groups.component.html
git commit -m "refactor: move admin-groups row Delete into kebab menu (#481)"
```

### Task 14: admin-users — Row Actions

**Files:**
- Modify: `src/app/pages/admin/users/admin-users.component.html`

Currently: Transfer Ownership + Delete. After: Both go in kebab. Transfer Ownership, divider, Delete.

- [ ] **Step 1: Add kebab to admin-users rows**

Replace both buttons with a kebab trigger. Menu contains: Transfer Ownership, divider, Delete.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/users/admin-users.component.html
git commit -m "refactor: move admin-users row actions into kebab menu (#481)"
```

### Task 15: admin-webhooks — Item Actions

**Files:**
- Modify: `src/app/pages/admin/webhooks/admin-webhooks.component.html`

Currently: Delete only (in `webhook-actions` div). After: Delete goes in kebab (single item, no divider).

- [ ] **Step 1: Add kebab to admin-webhooks items**

Replace the Delete button with a kebab trigger. Menu contains only Delete.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/webhooks/admin-webhooks.component.html
git commit -m "refactor: move admin-webhooks Delete into kebab menu (#481)"
```

### Task 16: admin-settings — Row Actions (Non-editing State)

**Files:**
- Modify: `src/app/pages/admin/settings/admin-settings.component.html`

The editing state (Save + Cancel) is unchanged. In the non-editing state: Edit stays visible, Delete goes in kebab (single item, no divider).

- [ ] **Step 1: Add kebab to admin-settings non-editing rows**

In the `@else` branch (non-editing, around line 183), keep Edit button. Replace Delete button with kebab trigger. Menu contains only Delete.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/settings/admin-settings.component.html
git commit -m "refactor: move admin-settings row Delete into kebab menu (#481)"
```

### Task 17: admin-quotas — Row Actions (Non-editing State)

**Files:**
- Modify: `src/app/pages/admin/quotas/admin-quotas.component.html`

Same pattern as admin-settings. Both User API Quotas and Webhook Quotas tables need the change. In the non-editing state: Edit stays, Delete goes in kebab.

- [ ] **Step 1: Add kebab to User API Quotas non-editing rows**

In the User API Quotas table `@else` branch (around line 160), keep Edit button. Replace Delete with kebab trigger. Menu contains only Delete.

- [ ] **Step 2: Add kebab to Webhook Quotas non-editing rows**

Same change in the Webhook Quotas table `@else` branch (around line 406).

- [ ] **Step 3: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/admin/quotas/admin-quotas.component.html
git commit -m "refactor: move admin-quotas row Delete into kebab menu (#481)"
```

### Task 18: admin-addons — Row Actions

**Files:**
- Modify: `src/app/pages/admin/addons/admin-addons.component.html`

Currently: Delete only. After: Delete goes in kebab (single item, no divider).

- [ ] **Step 1: Add kebab to admin-addons rows**

Replace Delete button with kebab trigger. Menu contains only Delete.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/addons/admin-addons.component.html
git commit -m "refactor: move admin-addons Delete into kebab menu (#481)"
```

## Chunk 4: Survey Pages and Final Verification

### Task 19: my-responses — Draft Row Actions

**Files:**
- Modify: `src/app/pages/surveys/components/my-responses/my-responses.component.html`

Currently: Edit + Delete (draft rows only). After: Edit stays, Delete goes in kebab (single item, no divider).

- [ ] **Step 1: Add kebab to draft row actions**

In the draft-status row actions, keep Edit button. Replace Delete with kebab trigger. Menu contains only Delete.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/surveys/components/my-responses/my-responses.component.html
git commit -m "refactor: move my-responses draft row Delete into kebab menu (#481)"
```

### Task 20: survey-list — Draft Item Delete

**Files:**
- Modify: `src/app/pages/surveys/components/survey-list/survey-list.component.html`

Currently: Delete only on draft items. After: Delete goes in kebab.

- [ ] **Step 1: Add kebab to survey-list draft items**

Replace the Delete button with a kebab trigger in the same position (per the "card content / inline items" positioning rule). Menu contains only Delete. Include `(click)="$event.stopPropagation()"` on the kebab trigger if the draft item is clickable.

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/surveys/components/survey-list/survey-list.component.html
git commit -m "refactor: move survey-list draft Delete into kebab menu (#481)"
```

### Task 21: Full Build, Lint, and Test

**Files:**
- All modified files

- [ ] **Step 1: Format**

Run: `pnpm run format`

- [ ] **Step 2: Lint**

Run: `pnpm run lint:all`
Fix any issues.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Verify clean build.

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Fix any failures. Existing tests should pass because this refactor only changes templates (HTML), not component methods or logic. The project's unit tests are method-call-based and don't test DOM/template interactions, so the kebab menu changes are transparent to them.

- [ ] **Step 5: Commit any lint/format fixes**

Stage only the specific files that were reformatted (check `git status` for the list), then commit:

```bash
git commit -m "chore: format and lint fixes for kebab menu refactor (#481)"
```

### Task 22: Code Review

- [ ] **Step 1: Run code review**

Invoke `superpowers:requesting-code-review` to review all changes made across Tasks 1-21. Address any findings before proceeding.

### Task 23: Close Issue

- [ ] **Step 1: Add comment to issue #481 referencing the commits**

- [ ] **Step 2: Close issue #481 as done**
