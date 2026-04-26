# Google Drive Picker Integration — tmi-ux Design

**Issue:** [#626](https://github.com/ericfitz/tmi-ux/issues/626) — feat: Google Drive picker integration for delegated document attachments
**Date:** 2026-04-26
**Status:** Draft (pending user review)
**Builds on:** TMI server [#249](https://github.com/ericfitz/tmi/issues/249) sub-project 4 — Google Workspace delegated picker access (merged on `dev/1.4.0`, commit `906119e7`).

## Overview

This spec covers the tmi-ux client-side work to integrate Google Drive document attachments via Google's per-file authorization model (`drive.file` scope + Google Picker JS). The TMI server-side work shipped in sub-project 4 of [#249](https://github.com/ericfitz/tmi/issues/249); this spec consumes those endpoints and renders the user-facing UX.

The implementation is structured to extend cleanly to additional delegated content sources (Confluence per #249 sub-project 2; OneDrive per #249 sub-project 3) without re-architecting the consumer components.

## Background

The TMI server provides:

- `POST /me/content_tokens/{provider_id}/authorize` — initiates OAuth account-linking; returns `authorization_url` for the client to redirect to.
- `GET /me/content_tokens` — lists currently linked content tokens (per-user).
- `DELETE /me/content_tokens/{provider_id}` — unlinks; cascades by clearing picker metadata on affected documents.
- `POST /me/picker_tokens/{provider_id}` — mints a short-lived OAuth access token + Picker app credentials for browser-side Picker JS.
- Document-attach endpoints accept an optional `picker_registration: {provider_id, file_id, mime_type}` field on create.
- Document GET responses include `access_status` and (when applicable) an `access_diagnostics` object with `reason_code`, `reason_detail`, and `remediations[]`.

The TMI server design rationale for the Picker-based approach is in [`/Users/efitz/Projects/tmi/docs/superpowers/specs/2026-04-18-google-workspace-delegated-picker-design.md`](/Users/efitz/Projects/tmi/docs/superpowers/specs/2026-04-18-google-workspace-delegated-picker-design.md).

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Account-linking surface | Both: a "Document sources" tab in the user-preferences dialog (canonical) AND a just-in-time link prompt in the document-editor-dialog (in-flow) | Canonical home for management; in-flow for first-time discovery |
| Document-source selection in the editor | Radio-group source selector (`URL`, `Google Drive`, future `Confluence`/`OneDrive`) | Clear mental model; extensible to multiple providers landing in #249 |
| Multi-file picking | Single-file in v1; multi-select tracked separately in [#645](https://github.com/ericfitz/tmi-ux/issues/645) | Scope discipline; per-doc fields (description, flags) are meaningful |
| Diagnostics rendering | Status-aware icon in the documents table; full diagnostics + remediation buttons inside the document-editor-dialog | Single detail surface; minimal table-mechanics complexity |
| OAuth flow style | Same-tab redirect with `return_to` query parameter; snackbar on return | One code path is simpler than popup-with-fallback; state-restoration is straightforward |
| Architecture pattern | Generic plumbing + per-provider picker service (Option B) | Provider-agnostic core; thin per-provider seam |
| User-facing terminology | "Document source" (avoids "provider", which is overloaded with sign-in OIDC providers) | Disambiguates from the sign-in OAuth/OIDC provider shown on the Profile tab |
| i18n placeholder pattern | Dynamic data placed at sentence boundaries (`Label: {{ value }}` suffix) where rendered standalone; dropped where surrounding UI provides context | Avoids grammatical-agreement, declension, and brand-name-inflection problems across languages |
| E2E coverage for picker flow | Skipped in v1; tracked separately in [#646](https://github.com/ericfitz/tmi-ux/issues/646) | Picker E2E requires Google test account orchestration; deferred to a focused effort |

## Architecture

### File layout

```
src/app/
├── core/
│   ├── models/
│   │   └── content-provider.types.ts                        # NEW
│   │       # Wraps OpenAPI-generated ContentTokenInfo,
│   │       # DocumentAccessDiagnostics, AccessRemediation,
│   │       # PickerRegistration types with TS-side ergonomics
│   │       # (ContentProviderId union, ContentProviderMetadata,
│   │       # PickedFile, error classes).
│   ├── services/
│   │   ├── content-token.service.ts                         # NEW (generic)
│   │   ├── picker-token.service.ts                          # NEW (generic)
│   │   ├── google-drive-picker.service.ts                   # NEW (provider-specific)
│   │   └── content-provider-registry.ts                     # NEW (typed metadata lookup)
│   └── components/
│       ├── content-callback/
│       │   └── content-callback.component.ts                # NEW (route handler)
│       └── user-preferences-dialog/
│           └── connected-accounts-tab/                      # NEW (Document sources tab)
│               ├── connected-accounts-tab.component.ts
│               └── connected-accounts-tab.component.spec.ts
├── shared/
│   └── components/
│       └── access-diagnostics-panel/                        # NEW
│           ├── access-diagnostics-panel.component.ts
│           └── access-diagnostics-panel.component.spec.ts
└── pages/tm/
    └── components/
        └── document-editor-dialog/
            ├── document-editor-dialog.component.ts          # MODIFIED
            └── document-editor-dialog.component.html        # MODIFIED

src/app/app.routes.ts                                         # MODIFIED (+ /oauth2/content-callback)
src/app/pages/tm/tm-edit.component.ts                         # MODIFIED (status-aware icon)
src/app/pages/tm/tm-edit.component.html                       # MODIFIED
src/app/pages/tm/services/threat-model.service.ts             # MODIFIED (picker_registration passthrough)
src/app/core/components/user-preferences-dialog/
  user-preferences-dialog.component.ts                        # MODIFIED (+ Document sources tab)

src/assets/i18n/en-US.json                                    # MODIFIED (translation keys)
src/assets/i18n/i18n-allowlist.json                           # MODIFIED
# Other 16 locales: backfilled via the localization-backfill skill after en-US lands.
```

### Component decomposition

**`ContentTokenService`** — provider-agnostic HTTP wrapper for `/me/content_tokens/*`.

```typescript
export class ContentTokenService {
  readonly contentTokens$: Observable<ContentTokenInfo[]>;
  list(): Observable<ContentTokenInfo[]>;
  refresh(): void;
  authorize(providerId: ContentProviderId, returnTo: string):
    Observable<{ authorization_url: string }>;
  unlink(providerId: ContentProviderId): Observable<void>;
}
```

The `authorize` method calls the server with `client_callback` set to `<origin>/oauth2/content-callback?return_to=<encoded returnTo>`. Cache on `contentTokens$` is invalidated by mutations and by explicit `refresh()` calls.

**`PickerTokenService`** — provider-agnostic wrapper for `POST /me/picker_tokens/{provider_id}`. Returns `{access_token, expires_at, developer_key, app_id}`. Tokens are not cached — the server may refresh underlying credentials per request and the response is non-cacheable per the OpenAPI spec.

**`GoogleDrivePickerService`** — the only provider-specific service.

```typescript
export class GoogleDrivePickerService {
  pick(): Observable<PickedFile | null>;
}

export interface PickedFile {
  fileId: string;
  name: string;
  mimeType: string;
  url: string;
}
```

Internal flow:
1. Lazy-load `https://apis.google.com/js/api.js` (singleton script tag, deduplicates concurrent calls). Subsequent calls reuse the loaded scripts.
2. Call `PickerTokenService.mint('google_workspace')` for a fresh access token.
3. Construct a Picker configured with `setMultiSelect(false)` and a MIME-type allow-list mirroring the server's content-extractor support (Google Docs, Sheets, Slides, PDF; precise list aligned with TMI extractors at implementation time).
4. Resolve with `PickedFile` on selection or `null` on cancel.

A second `pick()` call while a Picker is open rejects with `PickerAlreadyOpenError`. If the user has no linked token, the underlying `PickerTokenService` returns 404 and the service surfaces a typed `ContentTokenNotLinkedError`.

**`ContentProviderRegistry`** — a static const map (not the heavyweight registry pattern). Typed lookup table:

```typescript
export const CONTENT_PROVIDERS: Record<ContentProviderId, ContentProviderMetadata> = {
  google_workspace: {
    id: 'google_workspace',
    displayNameKey: 'documentSources.googleDrive.name',
    icon: '/static/provider-logos/google-drive.svg',
    supportsPicker: true,
    pickerService: GoogleDrivePickerService, // injection token
  },
  // Confluence / OneDrive added when their server sub-projects ship.
};
```

Picker-service resolution at the call site uses `Injector.get(metadata.pickerService)` — components depend on the registry, not on a concrete provider class. Adding a new provider == one new picker-service file + one map entry; no changes to the dialog or diagnostics panel.

**`ConnectedAccountsTabComponent`** — renders as the "Document sources" tab inside the user-preferences dialog. Layout follows the existing `Credentials` tab pattern:

- **Empty state:** icon + localized "No document sources connected" + description + "Connect a source" CTA.
- **Populated state:** Material table with columns `Source | Account | Status | Actions`. Status chip surfaces `Active` or `Refresh failed` (the only two values defined in the OpenAPI `ContentTokenInfo.status` enum). The Account column shows `provider_account_label` (typically the user's email). Actions: `Unlink` always; `Relink` when `failed_refresh`.
- **Add affordance:** "Connect a source". When only one provider is enabled (current state), it's a direct CTA; when multiple are enabled, it's a `mat-menu` listing available sources.

Reads/writes go through `ContentTokenService`. The unlink confirmation includes a warning that documents attached from this source will need to be re-picked after re-linking.

The tab is always rendered. The server has no explicit "list-enabled-providers" endpoint, so server-side provider enablement is inferred lazily: if a user clicks "Connect a source" and the server returns 422 (provider not enabled), the snackbar surfaces a clear "This source isn't available right now" message and the link flow is aborted. For most deployments the tab presence is harmless even when no provider is enabled — the user simply sees the empty-state copy and an Add affordance that returns 422 if invoked. If a future deployment needs to suppress the tab entirely, that's a separate refinement (a feature-flag check on bootstrap).

**`AccessDiagnosticsPanelComponent`** — shared component, takes a `Document` input.

Renders nothing if `access_status ∈ {accessible, unknown}` and no `access_diagnostics` is present. Otherwise:

- Status banner (warning/error variant by `access_status`) with localized message keyed by `reason_code`. For `reason_code === 'other'`, displays `reason_detail` verbatim under a generic "Unable to access this document" header.
- Remediation section: one button per `remediations[]` element. Each button:
  - Localized label keyed by `remediation.action`.
  - Click handler dispatches via:
    - `link_account` / `relink_account` → `ContentTokenService.authorize(...)`.
    - `repick_file` / `repick_after_share` → resolve picker via registry; on success, call document-update with new `picker_registration`.
    - `share_with_service_account` → render the email from `remediation.params.service_account_email` with a copy-to-clipboard icon button + snackbar confirmation.
    - `retry` → re-fetch document; on success, banner clears.
    - `contact_owner` → informational only (no click handler beyond visual feedback).
  - Unknown `remediation.action` (forward-compat) → button rendered with a generic label and disabled.

Used inside the document-editor-dialog when the document being edited has diagnostics. Future surfaces (e.g. a row-expanded inline view) can mount the same component without changes.

**`ContentCallbackComponent`** — route handler at `/oauth2/content-callback`.

Reads `?status=success|error&return_to=<path>` query params. Briefly renders a "Linking your account..." spinner so the route doesn't flash blank. On `success`: calls `ContentTokenService.refresh()`, navigates to `return_to` (default `/dashboard`), shows a success snackbar. On `error`: navigates to `return_to`, shows an error snackbar with the server-supplied error code (mapped to a localized message). Pattern modeled on the existing [auth-callback.component](src/app/auth/components/auth-callback/).

### Modifications to existing components

**`DocumentEditorDialogComponent`**

1. **Source selector:** new `mat-radio-group` rendered above the existing form. Options are derived from `CONTENT_PROVIDERS` filtered to `supportsPicker === true`, plus a fixed `URL` option. Default selection: `URL` (preserves current behavior).
2. **Picker path:** when a non-URL source is selected, the URI text input is hidden and replaced with:
   - When user has a linked token: a "Pick a file" button. After successful pick, name and URI auto-fill; the URI is shown read-only beneath as `"Selected: {{ filename }}"`. The user can still edit description, `include_in_report`, and `timmy_enabled` checkboxes. Picker registration is held in component state until submit.
   - When user has no linked token: an inline message and "Link source" button. Clicking the button triggers `ContentTokenService.authorize(providerId, returnTo)` where `returnTo = "/tm/<id>"`. The user re-opens the dialog after returning.
3. **Submit path:** when a file was picked, the create payload includes `picker_registration: { provider_id, file_id, mime_type }`. Otherwise behavior matches today.
4. **Diagnostics panel:** when opened to edit a document with `access_diagnostics`, the `AccessDiagnosticsPanelComponent` is rendered above the form fields.

**`UserPreferencesDialogComponent`** — adds the new `<mat-tab>` for Document sources, following the conditional-tab pattern of the existing Credentials tab.

**`tm-edit.component.html`** — the documents table's icon column renders a status-aware icon:

| `access_status` | Icon | Color |
|---|---|---|
| `accessible` | `description` | default |
| `unknown` | `description` | default |
| `pending_access` | `warning` | amber |
| `auth_required` | `error` | red |

Tooltip on the icon uses the localized status text. No other column changes.

**`threat-model.service.ts`** — the `addDocument` method (and document-update equivalents) accepts an optional `picker_registration` field on the request body and passes it through unchanged.

**`app.routes.ts`** — adds `{ path: 'oauth2/content-callback', component: ContentCallbackComponent }`.

## Data flows

### Flow 1 — Linking a source from the Document sources tab

```
1. User opens user-prefs dialog → Document sources tab.
2. Click "Connect a source" → for v1 (single provider), directly opens Google flow.
3. Component captures location: returnTo = "/dashboard?openPrefs=document-sources"
4. ContentTokenService.authorize('google_workspace', returnTo)
     → POST /me/content_tokens/google_workspace/authorize
       body: { client_callback: "<origin>/oauth2/content-callback?return_to=<encoded>" }
     ← { authorization_url: "https://accounts.google.com/o/oauth2/v2/auth?..." }
5. Component navigates: window.location.href = authorization_url
6. User consents at Google.
7. Google redirects to TMI's content_callback URL.
8. TMI redirects to: <origin>/oauth2/content-callback?status=success&return_to=<encoded>
9. ContentCallbackComponent:
     - On success: ContentTokenService.refresh(); navigate to return_to; success snackbar.
     - On error:   navigate to return_to; error snackbar with server-supplied reason.
10. App lands on /dashboard?openPrefs=document-sources
11. Dashboard observes the openPrefs query param, auto-opens prefs on the
    Document sources tab. Param is removed after open.
```

### Flow 2 — Attaching a Google Drive document

```
1. User clicks "+ Add document" in tm-edit.
2. document-editor-dialog opens with source-selector defaulted to "URL".
3. User selects "Google Drive" radio.
4a. No linked token: dialog shows inline link prompt. User clicks "Link source"
    → flow identical to Flow 1, returnTo = "/tm/<id>". On return, user re-opens
    the document dialog and re-selects Google Drive.
4b. Linked: dialog shows "Pick a file" button.
5. Click "Pick a file":
   a. const svc = injector.get(metadata.pickerService);
      svc.pick()
   b. GoogleDrivePickerService lazy-loads gapi/picker scripts (cached).
   c. PickerTokenService.mint('google_workspace')
        → POST /me/picker_tokens/google_workspace
        ← { access_token, expires_at, developer_key, app_id }
   d. Picker opens. User selects a file.
   e. Service resolves with PickedFile { fileId, name, mimeType, url }.
6. Dialog auto-fills: name = file.name; uri = file.url.
7. Dialog stores picker_registration in component state:
     { provider_id: 'google_workspace', file_id, mime_type }
8. User edits description / checkboxes (optional), clicks Save.
9. threat-model.service.addDocument(tmId, {
     name, uri, description, ..., picker_registration
   })
   → POST /threat_models/{id}/documents with picker_registration in body.
10. New row appears in documents table with picker metadata persisted server-side.
```

### Flow 3 — Viewing a document with access diagnostics

```
1. tm-edit loads the threat model; documents resolver fetches docs.
2. Each document includes (when applicable):
     access_status: 'pending_access' | 'auth_required' | 'accessible' | 'unknown'
     access_diagnostics: { reason_code, reason_detail?, remediations[] }
3. Documents table renders status-aware icon column with localized tooltip.
4. User clicks a row → document-editor-dialog opens.
5. Dialog mounts AccessDiagnosticsPanel (input: document).
6. Panel renders status banner + remediation buttons.
7. Remediation actions:
     link_account / relink_account     → ContentTokenService.authorize(...)
     repick_file / repick_after_share  → injector-resolved picker.pick(),
                                          then document-update with new
                                          picker_registration
     share_with_service_account        → render email + copy-to-clipboard
     retry                              → re-fetch document
     contact_owner                      → informational only
8. After mutating actions (link, repick), refresh the document and re-render the panel.
```

### Flow 4 — Unlinking a source

```
1. User opens Document sources tab → click Unlink on a row.
2. Confirm dialog warns: documents from this source will need to be re-picked
   after re-linking (Google revokes prior picker scopes on token revocation).
3. ContentTokenService.unlink('google_workspace')
   → DELETE /me/content_tokens/google_workspace
4. Server-side unlink cascade nulls picker metadata for that user's docs;
   docs transition to 'unknown' status.
5. Tab refreshes; row disappears.
```

The status-aware icon and the diagnostics panel together cover the unlinked-document UX in tm-edit; no separate "View affected documents" affordance is needed.

## Concurrency and edge cases

- **Picker singleton:** Google Picker JS allows only one Picker open at a time. `GoogleDrivePickerService.pick()` rejects a concurrent call with `PickerAlreadyOpenError`. UI prevents this from happening normally (the trigger button disables while a Picker is open).
- **Multiple tabs linking simultaneously:** Google's OAuth invalidates the prior grant when a second link succeeds. Server-side handling is correct per the TMI design spec; client-side, the worst case is a stale `failed_refresh` row that resolves on the next `ContentTokenService.refresh()`.
- **Browser blocks redirect/popup edge cases:** the same-tab redirect is initiated synchronously from a user gesture, so popup-blocker interference does not apply.
- **Picker token expiry mid-pick:** the picker token is short-lived. If the user opens the picker but takes minutes before selecting, the token may expire. Google Picker will surface an authorization error; the service catches it, re-mints the token, and retries once. Beyond one retry, surfaces as a `PickerSessionExpiredError`.
- **Forward compatibility of `reason_code` and `remediation.action` enums:** unknown values fall back to a generic message and (for actions) a disabled button. A build-time contract test asserts every known enum value has a translation key, so new server values cannot ship to production without explicit i18n work.

## i18n

### Translation key inventory (en-US)

```
documentSources.tabTitle                            → "Document sources"
documentSources.tabConfirmUnlink.title              → "Unlink source. Source: {{ source }}"
documentSources.tabConfirmUnlink.body               → "Unlinking will remove access to documents attached from this source. You may need to re-pick those files after re-linking."
documentSources.empty.title                         → "No document sources connected"
documentSources.empty.description                   → "Link a cloud storage account to attach documents from Google Drive, and other services as they become available."
documentSources.add                                  → "Connect a source"
documentSources.unlink                               → "Unlink"
documentSources.relink                               → "Relink"
documentSources.columns.source                       → "Source"
documentSources.columns.account                      → "Account"
documentSources.columns.status                       → "Status"
documentSources.columns.actions                      → "Actions"
documentSources.linkedAt                             → "Linked {{ relativeTime }}"
documentSources.googleDrive.name                     → "Google Drive"
documentSources.status.active                        → "Active"
documentSources.status.refreshFailed                 → "Refresh failed"
documentSources.callback.linking                     → "Linking your account..."
documentSources.callback.success                     → "Source connected. Source: {{ source }}"
documentSources.callback.error                       → "Couldn't connect source. Source: {{ source }}. Reason: {{ reason }}"

documentEditor.source.label                          → "How would you like to attach this document?"
documentEditor.source.url                            → "Paste a URL"
documentEditor.source.googleDrive                    → "Pick from Google Drive"
documentEditor.source.linkPrompt                     → "Link your account to pick files from this source."
documentEditor.source.linkAction                     → "Link source"
documentEditor.source.pickAction                     → "Pick a file"
documentEditor.source.repickAction                   → "Choose a different file"
documentEditor.source.pickedFile                     → "File selected: {{ fileName }}"

documentStatus.accessible                            → "Document accessible"
documentStatus.pendingAccess                         → "Pending access"
documentStatus.authRequired                          → "Authorization required"
documentStatus.unknown                               → "Status unknown"

documentAccess.reason.tokenNotLinked                 → "You haven't linked the account that owns this document. Source: {{ source }}"
documentAccess.reason.tokenRefreshFailed             → "Source link is no longer valid. Source: {{ source }}"
documentAccess.reason.tokenTransientFailure          → "Couldn't reach source. This is usually temporary. Source: {{ source }}"
documentAccess.reason.pickerRegistrationInvalid      → "This document's picker authorization is no longer valid."
documentAccess.reason.noAccessibleSource             → "TMI cannot read this document with current access."
documentAccess.reason.sourceNotFound                 → "TMI doesn't know how to read this document's URL."
documentAccess.reason.fetchError                     → "An error occurred while reading this document."
documentAccess.reason.other                          → "Unable to access this document."
documentAccess.reason.fallback                       → "Unable to access this document."

documentAccess.remediation.linkAccount               → "Link source"
documentAccess.remediation.relinkAccount             → "Relink source"
documentAccess.remediation.repickFile                → "Pick this file again"
documentAccess.remediation.shareWithServiceAccount   → "Share with TMI service account"
documentAccess.remediation.repickAfterShare          → "Pick again after sharing"
documentAccess.remediation.retry                     → "Try again"
documentAccess.remediation.contactOwner              → "Contact the document owner"

documentAccess.serviceAccountEmail                   → "Share with this email:"
documentAccess.copyEmail                             → "Copy email"
documentAccess.copiedEmail                           → "Email copied"
```

### Placeholder pattern

Dynamic data is placed at sentence boundaries with a `Label: {{ value }}` suffix when the message is consumed standalone (snackbars, diagnostic banners, callback messages). Where surrounding UI already shows the source (confirm dialog anchored on a row, prompt inline with a source radio), the suffix is dropped and the message is phrased generically. This sidesteps grammatical-agreement, declension, and brand-name-inflection problems across the 17 supported locales.

### Backfill

1. All keys land in `src/assets/i18n/en-US.json` as part of the implementation.
2. New keys added to `src/assets/i18n/i18n-allowlist.json`.
3. Other 16 locales are populated via the `localization-backfill` skill after en-US lands.

### Reason-code → message contract

A build-time TypeScript contract test imports the OpenAPI-generated enum types and asserts every `reason_code` and `remediation.action` value maps to a translation key. New server enum values fail the build until tmi-ux explicitly handles them.

## Testing

### Unit tests (Vitest)

| Test file | Coverage |
|---|---|
| `content-token.service.spec.ts` | `list`, `refresh`, `authorize` (return URL, includes `return_to` in `client_callback`), `unlink`. Cache invalidation. Error mapping. |
| `picker-token.service.spec.ts` | Mints token; passes 401/404/422/503 as typed errors; no caching. |
| `google-drive-picker.service.spec.ts` | Lazy-load idempotency (concurrent calls share one promise). `pick()` resolves with `PickedFile` from a mocked Picker; resolves `null` on cancel; rejects with `PickerAlreadyOpenError` on concurrent invocation; surfaces `ContentTokenNotLinkedError` from `PickerTokenService` 404. Token-expiry-mid-pick retry path. |
| `content-callback.component.spec.ts` | `?status=success` → calls refresh, navigates to `return_to`, success snackbar. `?status=error` → error snackbar with reason. Missing/invalid params → safe default to `/dashboard`. |
| `connected-accounts-tab.component.spec.ts` | Empty state when no tokens; populated state renders source + email + status; unlink confirm flow; relink action when `failed_refresh`; add-source flow. |
| `access-diagnostics-panel.component.spec.ts` | Each `reason_code` enum value renders the matching translation. Unknown `reason_code` → fallback message, no remediations. Each `remediation.action` enum value → button rendered with matching label and dispatches the right handler. `share_with_service_account` copy-to-clipboard works and shows snackbar. `reason_detail` rendered verbatim only when `reason_code === 'other'`. |
| `document-editor-dialog.component.spec.ts` | Source selector defaults to URL; switching to Google Drive hides URI field; pick flow auto-fills name/uri and stores `picker_registration`; submit includes `picker_registration` in API payload; access-diagnostics panel rendered when document has diagnostics. |

### Contract test

A TypeScript spec that imports the OpenAPI-generated `DocumentAccessDiagnostics.reason_code` and `AccessRemediation.action` enums and asserts a translation-key map exists for each. Compilation fails when the server enum gains a new value without tmi-ux i18n support.

### Integration tests (Vitest)

- `content-token-integration.spec.ts` — full link flow with mocked HTTP: authorize → callback → refresh → unlink.
- `document-attach-with-picker.spec.ts` — open dialog → switch to Drive → mock pick → submit → assert API payload shape includes `picker_registration`.

### E2E tests (Playwright)

One smoke test verifying the source selector renders and the URL-paste path still works (regression guard for the existing flow). Full picker E2E is tracked separately in [#646](https://github.com/ericfitz/tmi-ux/issues/646) and uses the existing Google test service account + dedicated Cloud project.

### Test data

Add fixture documents to existing TM seed data with `access_status` set to each problem state (`pending_access`, `auth_required`, `unknown`) so the documents-table status icons are visually verifiable in dev without orchestrating real failure conditions.

## Implementation phases

Phases land as independent commits / PRs. Phases 1–4 are strictly sequential; 5–6 can run in parallel after phase 4 lands; phase 7 runs last.

1. **Phase 1 — Generic plumbing.** New types, `CONTENT_PROVIDERS` registry, `ContentTokenService`, `PickerTokenService`, `ContentCallbackComponent` + route. Contract test scaffolded with TODO placeholders.
2. **Phase 2 — Google Drive picker service.** `GoogleDrivePickerService` with lazy-loaded gapi/picker scripts, `pick()` flow, full unit coverage including concurrent-load and already-open paths.
3. **Phase 3 — Document sources tab + linking flow.** `ConnectedAccountsTabComponent` integrated into `UserPreferencesDialogComponent`. End-to-end manual test in dev: link → row appears → unlink → row gone.
4. **Phase 4 — i18n keys.** Add all keys to `en-US.json`, update `i18n-allowlist.json`, resolve contract-test placeholders. Run the `localization-backfill` skill to populate the other 16 locales.
5. **Phase 5 — Document editor source selector.** Modify `DocumentEditorDialogComponent` (source selector + picker invocation + diagnostics panel). Modify `threat-model.service.ts` to accept and forward `picker_registration`.
6. **Phase 6 — Documents table status indicators.** Modify `tm-edit.component.html` documents-table icon column. Add fixture documents to TM seed data.
7. **Phase 7 — Acceptance verification + close-out.** Manual run-through of every acceptance criterion; update issue with status; reference merged commits; confirm follow-up issues (#645, #646) accurately scoped.

### Estimated size

| Phase | Rough size |
|---|---|
| 1 | M (services + types + callback route) |
| 2 | M (lazy-loader is fiddly) |
| 3 | M (Material table + dialog integration) |
| 4 | S (mostly mechanical; `localization-backfill` does the heavy lifting) |
| 5 | M-L (largest single component change) |
| 6 | S (icon swap + tooltip) |
| 7 | S |

Total: ~3 M+L equivalents, with i18n backfill handled by skill.

## Acceptance criteria

Mirrored from issue [#626](https://github.com/ericfitz/tmi-ux/issues/626):

- User can link and unlink a Google Workspace account from the user-preferences dialog (Document sources tab).
- User can attach a Google Drive file via the picker; the attachment reaches the server with a `picker_registration` payload.
- `access_diagnostics` states render with localized strings keyed by `reason_code` in the document-editor-dialog.
- All `remediation.action` values render appropriate UI (buttons; copy-to-clipboard for service account email; re-link handlers; re-pick handlers).
- Unknown `reason_code` values fall back to a generic "Unable to access" message.
- Just-in-time link prompt in the document-editor-dialog when user selects Google Drive without a linked token.
- Status-aware icon variant in the tm-edit documents table for documents in problem states.
- Build-time contract test enforces enum coverage in i18n.
- All 17 locales have keys populated (en-US authoritative; other 16 via `localization-backfill`).

## Out of scope

- Confluence and OneDrive picker integration — handled when their respective TMI sub-projects (#249 sub-projects 2 and 3) land.
- Multi-select picker — tracked in [#645](https://github.com/ericfitz/tmi-ux/issues/645).
- Full E2E test coverage of the picker flow — tracked in [#646](https://github.com/ericfitz/tmi-ux/issues/646).
- "View affected documents" snackbar action after unlink.
- Admin UI for managing other users' content tokens.
- URL-paste-as-Google-Drive auto-detection (heuristic upgrade of pasted Drive URLs into picker registrations).
- Background warming of picker tokens.
- Drive "Open with" entry from Drive UI into TMI.

## Follow-up issues

- [#645](https://github.com/ericfitz/tmi-ux/issues/645) — Multi-select picker for batch document attachment.
- [#646](https://github.com/ericfitz/tmi-ux/issues/646) — E2E coverage for Google Drive picker flow.

## Tracking

This spec scopes the tmi-ux portion of [#626](https://github.com/ericfitz/tmi-ux/issues/626). The TMI server-side work shipped in [#249](https://github.com/ericfitz/tmi/issues/249) sub-project 4 (commit `906119e7`).
