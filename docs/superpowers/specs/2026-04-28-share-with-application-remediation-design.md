# `share_with_application` Remediation UI

**Issue:** [#644](https://github.com/ericfitz/tmi/issues/644)
**Date:** 2026-04-28
**Branch:** `dev/1.4.0`
**Status:** Approved — proceeding to implementation plan

## Problem

When a user adds a Microsoft (OneDrive / SharePoint) document to a threat model by pasting a URL, the TMI server attempts to read the file via Microsoft Graph. If the file owner hasn't yet granted the TMI Entra app per-file read access, Graph returns 403 and the server stores the document with `access_status: pending_access` and `access_diagnostics.reason_code: microsoft_not_shared`. The diagnostic includes a `share_with_application` remediation containing a Microsoft Graph call (`drive_id`, `item_id`, `app_object_id`, `graph_call`, `graph_body`) that the file owner can run to grant access.

`AccessDiagnosticsPanelComponent` already renders pending-access banners and dispatches per-action remediation buttons for seven existing actions (`link_account`, `relink_account`, `repick_file`, `repick_after_share`, `share_with_service_account`, `retry`, `contact_owner`). It does **not** yet handle `share_with_application`. There is also no UI today for re-validating a pending-access document — no Google Drive precedent, no polling, no WebSocket subscription.

## Goal

Render the `share_with_application` remediation as a card with copy-pasteable Microsoft Graph snippets in three formats (raw, PowerShell, curl), add a "Check now" button that re-validates the document server-side, and refresh document state when the document editor dialog opens for a pending-access document.

## Non-goals

- Refactoring `AccessDiagnosticsPanelComponent` into a generic `RemediationCardComponent` — tracked separately in [#655](https://github.com/ericfitz/tmi-ux/issues/655).
- Background polling or WebSocket subscription for access-status flips — manual recheck only.
- Localization beyond en-US — the existing localization-backfill workflow handles other languages later.
- A "Check now" button on remediations other than `share_with_application`.
- Multi-file picker, OAuth linking, or any other Microsoft work — separate issues.

## Existing infrastructure (verified)

| Concern | Location | Status |
|---|---|---|
| `Document` model with `access_status`, `access_diagnostics` | `src/app/pages/tm/models/threat-model.model.ts:39-54` | ✅ exists |
| `AccessRemediation` / `DocumentAccessDiagnostics` types | `src/app/core/models/content-provider.types.ts` (re-exported from `src/app/generated/api-types.d.ts:10157-10190`) | ✅ exists; `share_with_application` and `microsoft_not_shared` are valid enum members |
| `AccessDiagnosticsPanelComponent` | `src/app/shared/components/access-diagnostics-panel/access-diagnostics-panel.component.ts` | ✅ renders pending banner, loops remediations, dispatches 7 actions; missing `share_with_application` arm |
| `DocumentEditorDialogComponent` | `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.ts` | ✅ already embeds the panel (template line 21) |
| `request_access` endpoint | OpenAPI: `POST /threat_models/{tmid}/documents/{docid}/request_access` | ✅ defined in spec; **not currently called from UI** |
| Copy-to-clipboard | `src/app/shared/utils/clipboard.util.ts` + Angular CDK `Clipboard` | ✅ both available; the panel already uses CDK `Clipboard` |
| i18n keys for documentAccess remediations | `src/assets/i18n/en-US.json` | ✅ existing keys for the 7 current actions; `shareWithApplication` keys to be added |

## Architecture

### New component

**`ShareWithApplicationRemediationComponent`**
- Path: `src/app/shared/components/access-diagnostics-panel/share-with-application-remediation/share-with-application-remediation.component.ts`
- Standalone, OnPush.
- `@Input() remediation: AccessRemediation` — the remediation as received from the server. Component narrows `params` internally to the Microsoft shape.
- Renders an explanation paragraph (i18n) followed by three code blocks, each with a copy button:
  - **Raw**: `{graph_call}` on one line; `{graph_body}` (pretty-printed JSON when valid) below.
  - **PowerShell**: `Invoke-MgGraphRequest -Method POST -Uri "<call>" -Body '<body>'` with backtick line continuations.
  - **curl**: `curl -X POST "<call>" -H "Authorization: Bearer <YOUR-TOKEN>" -H "Content-Type: application/json" -d '<body>'` with backslash line continuations.
- Uses CDK `Clipboard` (matching the parent panel's pattern) and emits user-visible feedback via the same snackbar mechanism the panel uses today.
- Snippet-formatting helpers (`buildPowerShellSnippet`, `buildCurlSnippet`, `prettyJsonOrVerbatim`) live as pure functions in a sibling file `share-with-application-remediation.util.ts` so they're unit-testable without TestBed.

### Modified components

**`AccessDiagnosticsPanelComponent`**
- Add a template branch that, when a remediation has `action === 'share_with_application'`, renders `<app-share-with-application-remediation>` instead of the standard action-button row.
- Add a `handleRemediation()` arm for `share_with_application` (no-op; the child handles its own dispatching). Or, equivalently, gate the action-button row in the template so it doesn't render for actions handled by their own card.
- Add a "Check now" button visible only when `document.access_status === 'pending_access'` AND `document.access_diagnostics?.remediations` is non-empty. Emits a new `@Output() recheck = new EventEmitter<void>()`.

**`DocumentEditorDialogComponent`**
- On dialog open: if the editing document is `pending_access`, GET the latest document state via the document service. Don't block dialog open — show whatever's cached, then patch when the GET resolves. Silently log on failure; the cached view remains.
- Bind `(recheck)` from the panel: call `requestDocumentAccess(threatModelId, documentId)`, then GET the document on success. Surface success/failure via snackbar.

**Document service** (likely `ThreatModelService` — confirm during implementation)
- Add `requestDocumentAccess(threatModelId, documentId): Observable<Document>` — POSTs to `/threat_models/{tmid}/documents/{docid}/request_access` and returns the updated document.
- Add `getDocument(threatModelId, documentId): Observable<Document>` if not already present.

## Data flow

```
User opens document editor dialog
  └─ if document.access_status === 'pending_access'
       └─ GET /threat_models/{tmid}/documents/{docid}    # silent refresh
            └─ patch dialog state with response

User clicks "Check now"
  └─ POST /threat_models/{tmid}/documents/{docid}/request_access
       ├─ on success → snackbar "Status checked" + GET /threat_models/{tmid}/documents/{docid}
       └─ on failure → snackbar "Couldn't check status — try again later"

If GET shows access_status === 'accessible'
  └─ AccessDiagnosticsPanelComponent hides itself (already conditional)

User clicks any "Copy" button on a snippet
  └─ Clipboard.copy(snippet)
       ├─ on success → snackbar "Copied"
       └─ on failure → snackbar "Copy failed"
```

## i18n additions (`src/assets/i18n/en-US.json`, under `documentAccess`)

```
remediation.shareWithApplication.title         — card heading
remediation.shareWithApplication.explanation   — paragraph copy
remediation.shareWithApplication.rawLabel      — "Microsoft Graph call"
remediation.shareWithApplication.powershellLabel
remediation.shareWithApplication.curlLabel
remediation.shareWithApplication.copyButton
remediation.shareWithApplication.copied        — snackbar
remediation.shareWithApplication.copyFailed
remediation.shareWithApplication.unavailable   — fallback when params are missing
action.checkNow                                — button label
action.checkNow.success                        — snackbar after recheck
action.checkNow.stillPending                   — snackbar when recheck succeeds but status unchanged
action.checkNow.failed                         — snackbar on POST failure
```

en-US only. Other languages picked up by the existing `/localization-backfill` workflow later.

## Edge cases

| Case | Behavior |
|---|---|
| Any of `drive_id`, `item_id`, `app_object_id`, `graph_call`, `graph_body` is missing or empty | Render fallback text ("Microsoft remediation details unavailable — contact support"). Log a `LoggerService.warn` since this indicates a server contract violation. |
| `graph_body` is not valid JSON | Display verbatim in the raw block. PowerShell and curl variants embed it as a single-quoted string verbatim. Do not throw. |
| Clipboard API unavailable | `clipboard.util.ts` already handles fallback; surface `copyFailed` snackbar if both paths fail. |
| `request_access` POST fails (network, 4xx, 5xx) | `action.checkNow.failed` snackbar. Document state unchanged. |
| `request_access` succeeds but document is still `pending_access` | `action.checkNow.stillPending` snackbar. UI updates with whatever new diagnostic info the server returned. |
| `request_access` succeeds and document is now `accessible` | `action.checkNow.success` snackbar. Panel hides itself (already conditional on `access_status !== 'accessible'`). |
| Initial GET on dialog open fails | Silently log via `LoggerService`. Show cached state. Don't block the dialog. |
| Document was opened with status other than `pending_access` (e.g., `accessible`) | No GET on open. No "Check now" button. |

## Testing

### Unit tests (Vitest)

- **`share-with-application-remediation.component.spec.ts`** (new)
  - Renders all three snippets when params are complete.
  - Renders fallback when any required param is missing.
  - Copy buttons invoke `Clipboard.copy` with the correct content for each variant.
- **`share-with-application-remediation.util.spec.ts`** (new) — pure-function tests, no TestBed:
  - `buildPowerShellSnippet`: escapes single quotes, uses backtick line continuations, embeds call + body correctly.
  - `buildCurlSnippet`: escapes single quotes, uses backslash line continuations, embeds bearer placeholder.
  - `prettyJsonOrVerbatim`: pretty-prints valid JSON; returns input verbatim for invalid JSON without throwing.
- **`access-diagnostics-panel.component.spec.ts`** (extend existing)
  - Renders `<app-share-with-application-remediation>` when a remediation has `action: share_with_application`.
  - Emits `recheck` when "Check now" is clicked.
  - Hides "Check now" when `access_status === 'accessible'` or remediations are empty.
- **`document-editor-dialog.component.spec.ts`** (extend existing)
  - Calls the document GET on open when document is `pending_access`.
  - Does NOT call the GET on open when document is `accessible`.
  - On `(recheck)`, calls `requestDocumentAccess` then re-GETs.
- **Document service test** — HTTP shape for `requestDocumentAccess` (POST, correct URL, returns parsed document).

### E2E

None for this issue. The flow is gated by server-side Microsoft integration that's still in flight (tmi#286). E2E coverage will land alongside the picker work in #643 or in a follow-up.

## Out of scope

- Generic remediation refactor — [#655](https://github.com/ericfitz/tmi-ux/issues/655).
- Background polling / WebSocket subscription for status flips.
- Other languages in i18n.
- "Check now" for other remediation actions.
- Microsoft picker, OAuth linking — [#643](https://github.com/ericfitz/tmi/issues/643).
