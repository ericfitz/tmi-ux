# Microsoft account linking + File Picker integration — design

**Issue:** ericfitz/tmi-ux#643
**Server side:** ericfitz/tmi#286 (closed) + ericfitz/tmi#307 (blocker — see below)
**Date:** 2026-04-28
**Branch:** dev/1.4.0

## Summary

Add a Microsoft content provider to tmi-ux for OneDrive-for-Business and SharePoint Online documents, exercising the **Experience 2 (picker)** flow. Users link a Microsoft account in the existing Connected Accounts UI, click a "Browse OneDrive/SharePoint" button in the document editor, pick a file via Microsoft File Picker v8 in an iframe, and the selected file is attached to a TMI threat model with `access_status: 'accessible'` thanks to a server-mediated per-file permission grant.

This work is largely about plugging Microsoft into the **provider-agnostic foundation that is already shipped** (`ContentTokenService`, `PickerTokenService`, `IContentPickerService`, `CONTENT_PROVIDERS` registry, Connected Accounts tab, document-editor source selector, OAuth content-callback). The new provider-specific surface is one picker service, one HTTP wrapper for the picker-grant endpoint, and CSP plumbing for the iframe.

## Server prerequisites (BLOCKING)

Implementation cannot complete until tmi#307 ships. The server has already merged most of the Microsoft picker infrastructure on `dev/1.4.0` (provider config, picker-grant endpoint, Microsoft Graph delegated source, encode/decode helpers), but two gaps remain:

1. `PickerRegistration.provider_id` enum in `api-schema/tmi-openapi.json` is still `["google_workspace"]` only. Must include `"microsoft"`.
2. `validatePickerRegistration` in `api/document_sub_resource_handlers.go` (~lines 103-110) hardcodes `extractGoogleDriveFileID(uri)` — needs per-provider URI/file-ID validation branches.

When tmi#307 lands and the OpenAPI is regenerated client-side (per the existing `chore: regenerate api-types from latest spec` flow), our `api-types.d.ts` will reflect the widened enum and `PickerRegistration` becomes Microsoft-compatible without any client-side type override.

## Design decisions

### Picker-service contract — single-method outcome stream

`IContentPickerService.pick()` changes from `Observable<PickedFile | null>` to `Observable<PickerEvent>`:

```ts
type PickerEvent =
  | { kind: 'finalizing'; messageKey?: string }
  | { kind: 'picked'; file: PickedFile }
  | { kind: 'cancelled' };
```

Pre-pick failures (PickerAlreadyOpenError, ContentTokenNotLinkedError, picker SDK load timeout) are thrown on the Observable as before. Post-pick failures (Microsoft picker-grant 422/503/timeout) are also thrown — the Observable terminates with a typed error class, not a `{kind: 'error'}` event. (The single stream still expresses all states; errors take Observable's natural error channel.)

**Rationale:** more providers are imminent (Confluence, etc.); shared code over per-provider special cases. Several providers will have post-pick steps that need a "finalizing" UI state. A single observable contract avoids per-provider dialog branches.

`GoogleDrivePickerService` is updated to emit `{kind: 'picked', file}` and `{kind: 'cancelled'}` instead of `file | null`. Existing tests at `google-drive-picker.service.spec.ts` are updated.

### Iframe loading — hidden-form + named-iframe target (Microsoft's canonical pattern)

`MicrosoftFilePickerService` constructs a `<form method="POST" target="picker-iframe-{channelId}" action="{picker_origin}/_layouts/15/FilePicker.aspx?filePicker=...&locale=...">` with hidden fields for the access token and picker config, attaches it to a transient overlay `<div>` containing the named iframe, and submits the form. The picker page hosts itself in the iframe; we communicate via MessageChannel.

**Why not** `iframe.contentDocument.write()`: archaic, tricky CSP. **Why not** static-asset launcher with token-in-URL: token leaks via referrer/history.

**Iframe DOM ownership:** the picker service appends and removes a fullscreen overlay containing the iframe to `document.body`. The dialog stays unaware of iframe markup. Single responsibility, matches Google's pattern.

### CSP — runtime-config-driven, per-provider

CSP is currently injected at runtime by `SecurityConfigService.injectDynamicCSP()` (reads from the `environment` object, which is mutated at startup by `main.ts:80-96` from `/config.json` before bootstrap). We extend this:

- Add `enabledContentProviders: ContentProviderId[]` to the `Environment` interface (default `[]`).
- `server.js` reads `TMI_ENABLED_CONTENT_PROVIDERS` (comma-separated env var) and reflects it into `/config.json`.
- `ContentProviderMetadata` gains an optional `cspDirectives?: { frameSrc?: string[]; formAction?: string[] }` field.
- `injectDynamicCSP()` iterates `environment.enabledContentProviders`, looks up each provider in the `CONTENT_PROVIDERS` registry, and merges `cspDirectives` into the policy's `frame-src` and `form-action` entries.

For Microsoft:

```ts
cspDirectives: {
  frameSrc: ['https://*.sharepoint.com', 'https://login.microsoftonline.com'],
  formAction: ['https://*.sharepoint.com'],
}
```

Strict-by-default: deployments not setting `TMI_ENABLED_CONTENT_PROVIDERS=microsoft` get no SharePoint allowances in CSP. Local dev can opt in via `environment.ts` defaults.

**Sequencing verified:** `main.ts` `await fetch('/config.json')` resolves and `Object.assign(environment, runtimeConfig)` runs *before* `bootstrapApplication()`. `SecurityConfigService` is first injected via the `APP_INITIALIZER` at `app.config.ts:202-207`, after DI starts. So `injectDynamicCSP()` reads the runtime-overridden `environment.enabledContentProviders`.

### Picker-grant call — dedicated `MicrosoftPickerGrantService`

`MicrosoftFilePickerService` injects a `MicrosoftPickerGrantService` (which wraps `ApiService` + the `POST /me/microsoft/picker_grants` endpoint). The grant call is encapsulated inside `pick()`: emit `{kind: 'finalizing'}`, call grant, emit `{kind: 'picked'}` on success or throw a typed error on failure. Caller (the dialog) is unchanged from a contract perspective.

`MicrosoftPickerGrantService` maps HTTP responses to typed errors:

| Status | Error class |
|---|---|
| 200 | (success) |
| 400 | `MicrosoftPickerGrantBadRequestError` |
| 401 | (handled by JwtInterceptor's auth-redirect) |
| 404 | `MicrosoftAccountNotLinkedError` |
| 422 | `MicrosoftGraphPermissionRejectedError` |
| 500 | `MicrosoftPickerGrantServerError` |
| 503 | `MicrosoftGraphUnavailableError` |
| timeout (10s) | `MicrosoftGrantTimeoutError` |
| network | generic `Error` (with `status` preserved if available) |

### Composite picker_file_id encoding — service-internal only

Microsoft picker_file_id is `"{driveId}:{itemId}"`. Encoding lives inside `MicrosoftFilePickerService` (no exported helper). The grant call uses raw `driveId` and `itemId` (from the picker postMessage); the encoded string is built only for the final `PickedFile.fileId`.

### Document editor dialog — inline finalizing state, disabled cancel, inline errors

- New component state `_finalizing: boolean`. While `true`: source-selector area shows a localized spinner ("Granting access…" by default; provider can override via `finalizing.messageKey`); Submit and Cancel buttons disabled.
- Cancel disabled during finalize, full timeout: 10s on the grant call. If timeout fires, Cancel re-enables, inline error renders, picked file is cleared.
- On grant error, inline error message renders below the source selector (not a snackbar). Each typed error class maps to a localization key. `MicrosoftAccountNotLinkedError` (404) renders an additional "Link account" link that deep-links to the Connected Accounts tab.

### Picker UI localization

Microsoft's File Picker v8 supports localization via the `locale` query string parameter on the form URL. We pass the user's current language (lowercased BCP-47 form, e.g., `en-us`) from `LanguageService`. SharePoint's locale list does not cover all 15 of our locales; for unsupported locales the picker falls back to English — acceptable.

Picker-side errors (auth, network, file-issues) render inside Microsoft's iframe in the user's locale; they don't bubble to us via postMessage. Only host-app-originated error envelopes (e.g., our `getToken` failure) carry strings we control. We translate our own grant-call errors via Transloco.

### postMessage protocol details

- Use `MessageChannel` (Microsoft's required pattern), not `window.addEventListener('message')`.
- Origin validation on every incoming message: `event.origin` must equal `provider_config.picker_origin`. Drop and log a warning otherwise.
- Sequence: form POST → picker iframe loads → `initialize` message on `window` (with the channel port) → `addEventListener` on the port → `activate` message back → `authenticate` command → respond with token → user picks → `pick` command → respond with `success` → grant call → `close` command (or service `cancel()`) → teardown.
- Single-pick guard: `_pickerOpen` flag (mirrors Google's pattern at `google-drive-picker.service.ts:69-72`). Second concurrent `pick()` call throws `PickerAlreadyOpenError`.
- Iframe load timeout: 30s. If no first message from the iframe within 30s, throw `PickerLoadFailedError`, full teardown.
- Teardown on every terminal path: close MessageChannel, remove iframe from DOM, remove overlay from DOM, clear references in service state.
- Cancellation paths: picker `command: "close"` → `{kind: 'cancelled'}`; service-level `cancel()` (called when dialog closes / navigates away) → tear down iframe immediately, emit `{kind: 'cancelled'}` if not already terminal.

## Architecture

### New files

- `src/app/core/services/microsoft-file-picker.service.ts` (+ `.spec.ts`)
- `src/app/core/services/microsoft-picker-grant.service.ts` (+ `.spec.ts`)

### Modified files

- `src/app/core/models/content-provider.types.ts` — extend `ContentProviderId` union to `'google_workspace' | 'microsoft'`; extend `PickerEvent` type; extend `IContentPickerService.pick()` return type to `Observable<PickerEvent>`; add Microsoft typed error classes; add `cspDirectives` field on `ContentProviderMetadata`.
- `src/app/core/services/content-provider-registry.ts` — add `microsoft` entry.
- `src/app/core/services/google-drive-picker.service.ts` — adapt to new `Observable<PickerEvent>` return type.
- `src/app/core/services/google-drive-picker.service.spec.ts` — assert on event kinds rather than nullable file objects.
- `src/app/core/services/security-config.service.ts` — `injectDynamicCSP` consumes `environment.enabledContentProviders`; iterates registry to merge per-provider CSP directives.
- `src/app/core/services/security-config.service.spec.ts` — add tests for conditional CSP merging.
- `src/environments/environment.interface.ts` — add `enabledContentProviders?: ContentProviderId[]`.
- `src/environments/environment.ts` and friends — defaults (`enabledContentProviders: []` for prod compiled-in; consider `['microsoft']` for dev defaults).
- `server.js` — read `TMI_ENABLED_CONTENT_PROVIDERS` env var, reflect into `/config.json`.
- `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.ts` — adapt `onPickFile()` to consume `Observable<PickerEvent>`, render finalizing state, render inline errors with typed-error-to-localization-key mapping; gate Cancel on `_finalizing`.
- `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.html` — finalizing spinner, inline error markup, conditional "Link account" CTA.
- `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.spec.ts` — extend with Microsoft-specific cases.
- `src/assets/i18n/en-US.json` — new keys (see Localization).
- All non-English locale files — backfilled translations.

### Provider entry shape

```ts
microsoft: {
  id: 'microsoft',
  displayNameKey: 'documentSources.microsoft.name',  // → "OneDrive/SharePoint"
  icon: '/static/provider-logos/onedrive.svg',
  supportsPicker: true,
  pickerService: MicrosoftFilePickerService,
  cspDirectives: {
    frameSrc: ['https://*.sharepoint.com', 'https://login.microsoftonline.com'],
    formAction: ['https://*.sharepoint.com'],
  },
}
```

(The `onedrive.svg` icon may need to be added if not already present.)

## Localization

New English keys (under `documentSources.microsoft.*`):

- `name` — "OneDrive/SharePoint"
- `pickerButton` — "Browse OneDrive/SharePoint"
- `linkAccountPrompt` — "Link a Microsoft account to browse OneDrive/SharePoint files"
- `finalizing` — "Granting access…"
- `grantError.notLinked` — "Your Microsoft account isn't linked." (renders alongside a "Link account" CTA)
- `grantError.permissionDenied` — "Microsoft rejected the request to grant access. The file may not be shareable. Try a different file or contact your administrator."
- `grantError.unavailable` — "Microsoft is temporarily unavailable. Please try again in a few moments."
- `grantError.timeout` — "The request took too long. Please try again."
- `grantError.generic` — "Couldn't grant access to your file. Please try again."
- `grantError.linkAccountCta` — "Link account"
- `pickerLoadFailed` — "Couldn't open the file picker. Check your network and try again."

Non-English locales: 14 files (`ar-SA`, `bn-BD`, `de-DE`, `es-ES`, `fr-FR`, `he-IL`, `hi-IN`, `id-ID`, `ja-JP`, `ko-KR`, `pt-BR`, `ru-RU`, `th-TH`, `ur-PK`, `zh-CN`) backfilled via the `localization-backfill` flow. Brand names ("Microsoft", "OneDrive", "SharePoint") left as-is per Google Drive precedent.

Picker UI itself: pass `LanguageService.currentLanguage` (lowercased) as `locale` query parameter on the form URL.

Validation: `pnpm run check-i18n` must pass before merge.

## Testing

### Unit (Vitest)

`MicrosoftFilePickerService`:
- Happy path (token → form submit → handshake → pick → grant → `{kind: 'picked'}` with composite `fileId`)
- Cancellation (`command: "close"` → `{kind: 'cancelled'}`, full teardown)
- `_pickerOpen` guard (concurrent `pick()` → `PickerAlreadyOpenError`)
- Token mint 404 → `ContentTokenNotLinkedError` propagates
- Iframe load timeout (30s, mock timers) → `PickerLoadFailedError`, full teardown
- Picker-grant errors mapped per status to typed error classes
- Picker-grant timeout (10s, mock timers) → `MicrosoftGrantTimeoutError`
- Origin validation: postMessage from non-`picker_origin` is dropped (logger warn spy)
- MessageChannel teardown on every terminal path
- Iframe + overlay removed from DOM on every terminal path

`MicrosoftPickerGrantService`:
- Happy path → returns response
- Each HTTP error status → corresponding typed error
- Network/timeout cases

`SecurityConfigService` (extended):
- No `enabledContentProviders` → no SharePoint/login.microsoftonline.com directives
- `enabledContentProviders: ['microsoft']` → directives included in `frame-src` and `form-action`
- `enabledContentProviders: ['microsoft', 'google_workspace']` → both providers' directives merged

Locale mapping helper for `locale` query string.

### Component (Vitest)

`DocumentEditorDialogComponent` (extended):
- Microsoft option appears in source selector when registry includes it
- Microsoft option hidden when no Microsoft `ContentTokenInfo` is linked
- "Link Microsoft account" CTA shown when no token (parameterized over the existing pattern)
- Submission constructs Microsoft `picker_registration` payload (composite `file_id`, `provider_id: 'microsoft'`)
- Inline finalizing spinner renders on `{kind: 'finalizing'}`
- Submit + Cancel disabled while finalizing
- Inline error renders for each typed error class with the right localization key
- "Link account" CTA renders inline only for `MicrosoftAccountNotLinkedError`

`GoogleDrivePickerService.spec.ts` updated to assert on event kinds.

### E2E (Playwright)

Following the precedent set when Google Workspace shipped (no Google-picker iframe E2E coverage in the existing suite):

- **Skip iframe E2E.** Picker iframe is Microsoft-controlled; covering it would test Microsoft's code more than ours.
- **Add E2E for non-iframe paths only:**
  - Connected Accounts tab: link/unlink Microsoft account (with stubbed OAuth callback)
  - Inline error rendering: Playwright route-intercepts `POST /me/microsoft/picker_grants` to return 422 / 503; assert dialog inline error UI and CTA visibility

## Risks and mitigations

- **Microsoft picker SDK URL pattern shifts.** Microsoft has moved File Picker URLs in the past. The `picker_origin` is server-side config (`provider_config`) — operator can override in their TMI server config without a tmi-ux release. CSP `frame-src 'https://*.sharepoint.com'` is broad enough to absorb subdomain shifts.
- **CSP changes blocking picker.** Conditional, registry-driven CSP keeps directive surface tight; deployments without Microsoft enabled don't loosen at all. CSP violations log via the existing `getCspViolationHandler` for diagnostic visibility.
- **Picker iframe times out / fails to load.** 30s iframe-load timeout + 10s grant timeout; user sees specific localized errors rather than the dialog hanging.
- **Orphan grant on user cancel during finalizing.** Mitigated by disabling Cancel while finalizing. Server-side picker-grants are idempotent (Microsoft Graph permission-create returns the existing permission on re-grant), so even orphans don't break re-pick.
- **OpenAPI sequencing with tmi#307.** Implementation work that touches services and CSP is unblocked and can proceed in parallel. The dialog's `picker_registration` patch and the document-creation E2E test are blocked on tmi#307. We sequence those last.

## Acceptance criteria (from #643, status mapping)

- [ ] User can link a Microsoft account from the Connected Accounts UI ← already provider-agnostic; just requires registry entry
- [ ] User can unlink a Microsoft account ← already provider-agnostic
- [ ] OAuth callback errors surfaced clearly ← already implemented in `ContentCallbackComponent`
- [ ] "Browse OneDrive/SharePoint" button on document creation when linked ← `pickerSourceOptions` already iterates registry; gating already provider-agnostic
- [ ] Picker opens in iframe ← `MicrosoftFilePickerService` (new)
- [ ] Picker renders user's OneDrive + SharePoint sites ← native picker behavior
- [ ] Permission grant performed; document created with `access_status: accessible` ← `MicrosoftPickerGrantService` + tmi#307
- [ ] Failed grants surface clear, actionable errors ← typed error classes + inline rendering
- [ ] Picker iframe properly torn down (no leaks, CSP-compliant) ← teardown contract on every terminal path; conditional CSP
- [ ] Works in Chrome, Firefox, Safari, Edge ← postMessage and MessageChannel are universally supported; verified via Playwright matrix later
- [ ] Existing TMI auth unchanged ← Microsoft tokens stay server-side; tmi-ux only sees transient picker tokens

## Out of scope

- Multi-file picking (single-pick only)
- Personal Microsoft accounts (consumer OneDrive at `1drv.ms` / `onedrive.live.com`) — separate sibling work
- Experience 1 (paste URL + share-with-application remediation) — already shipped in #644
- Generalizing the linked-accounts UI to also cover Google Workspace + Confluence picker buttons — already shipped via existing provider-agnostic foundation; no work needed
