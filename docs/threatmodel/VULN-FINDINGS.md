# Vulnerability Findings — tmi-ux

- **Target:** `/Users/efitz/Projects/tmi-ux`
- **Scanned:** 2026-06-11 (static source review, no execution)
- **Findings:** 24 total — 3 HIGH, 9 MEDIUM, 12 LOW (11 below 0.4 confidence)
- **Method:** 7 parallel review subagents seeded from `THREAT_MODEL.md` threat clusters (T1–T17), plus a per-finding independent confidence pass. Sorted by confidence desc.

> These are **static candidates**, not verified exploits. Many are explicitly **backend-contingent** (the authoritative Go backend is out of this repo). Next: `> /triage /Users/efitz/Projects/tmi-ux/VULN-FINDINGS.json --repo /Users/efitz/Projects/tmi-ux`. For execution-verified crashes use the `vuln-pipeline` (not applicable to this TS/Angular target).

## Summary table

| id | sev | conf | category | file:line | title |
|---|---|---|---|---|---|
| F-001 | HIGH | 0.90 | xss | shared/markdown-providers.ts:67 | renderer.link raw href, sanitizer disabled — javascript: stored XSS |
| F-002 | MEDIUM | 0.80 | prototype-pollution | dfd/application/executors/node-operation-executor.ts:500 | Untrusted remote-cell keys written via bracket assign, no proto guard |
| F-003 | MEDIUM | 0.80 | missing-security-headers | server.js:138 | No CSP/HSTS/X-Frame-Options/nosniff headers — no XSS/clickjacking backstop |
| F-004 | LOW | 0.80 | origin-validation | core/services/microsoft-file-picker.service.ts:243 | MS picker postMessage handler does not verify evt.source |
| F-005 | LOW | 0.80 | csrf | core/interceptors/credentials.interceptor.ts:28 | withCredentials gated by startsWith(apiUrl), not exact origin |
| F-006 | MEDIUM | 0.70 | open-redirect | .../connected-accounts-tab.component.ts:276 | Unvalidated backend authorization_url -> window.location.href |
| F-007 | MEDIUM | 0.70 | open-redirect | .../remediation-card.component.ts:109 | Unvalidated backend authorization_url -> window.location.href |
| F-008 | HIGH | 0.70 | csrf | auth/services/auth.service.ts:830 | OAuth CSRF state validation skipped when callback omits state |
| F-009 | LOW | 0.70 | deserialization | auth/services/auth.service.ts:776 | JSON.parse(atob(state)) no shape check; non-string returnUrl throws |
| F-010 | MEDIUM | 0.60 | open-redirect | .../document-editor-dialog.component.ts:560 | Unvalidated backend authorization_url -> window.location.href |
| F-011 | MEDIUM | 0.60 | privilege-escalation | tm/services/threat-model-authorization.service.ts:354 | 'everyone' group grants uncapped role (incl writer/owner) client-side |
| F-012 | LOW | 0.50 | deserialization | core/services/websocket.adapter.ts:538 | Open-schema WS message validation; extra attacker keys pass through |
| F-013 | MEDIUM | 0.50 | open-redirect | core/components/content-callback/content-callback.component.ts:64 | return_to query param -> navigateByUrl with no isValidReturnUrl |
| F-014 | HIGH | 0.40 | xss | shared/markdown-providers.ts:201 | Angular sanitizer disabled — no framework backstop (root cause of F-001) |
| F-015 | MEDIUM | 0.40 | xss | shared/markdown-providers.ts:159 | DOMPurify renderer.html permissive (data:, style, svg) |
| F-016 | LOW | 0.40 | privilege-escalation | tm/services/threat-model-authorization.service.ts:255 | Email-fallback owner match on collision (same provider) |
| F-017 | LOW | 0.40 | privilege-escalation | auth/services/auth.service.ts:205 | Cached is_admin stale window for deauthorized admin |
| F-018 | MEDIUM | 0.40 | auth-bypass | auth/components/auth-callback/auth-callback.component.ts:91 | Legacy fragment access_token accepted (impact neutered by cookie design) |
| F-019 | LOW | 0.30 | ssrf | server.js:28 | /api proxy forwards arbitrary unauth paths when enabled (no SSRF) |
| F-020 | MEDIUM | 0.30 | csrf | auth/services/auth.service.ts:755 | Loose isBase64 + non-constant-time csrf compare (claimed bypass unreachable) |
| F-021 | LOW | 0.20 | auth-bypass | tm/services/threat-model-authorization.service.ts:389 | Client-side edit gates DevTools-flippable (by-design thin client) |
| F-022 | LOW | 0.20 | info-disclosure | server.js:54 | /config.json reflects non-secret operator env only |
| F-023 | LOW | 0.20 | prototype-pollution | dfd/domain/value-objects/metadata.ts:23 | metadataToRecord no proto guard (non-exploitable, string-coerced) |
| F-024 | LOW | 0.20 | auth-bypass | auth/models/auth.models.ts:72 | Roles from server-validated GET /me, not client JWT (non-issue) |

---

## Findings

### F-001 — renderer.link concatenates raw markdown href into `<a href>` with no scheme check, Angular sanitizer disabled — javascript: URI stored XSS
**HIGH · confidence 0.90 · xss · src/app/shared/markdown-providers.ts:67**

`provideMarkdownConfig` sets the Angular sanitizer to `SecurityContext.NONE` (~line 201), so ngx-markdown does not run `DomSanitizer` over rendered output — the only sanitization is what the custom `MarkedRenderer` methods do, and DOMPurify is applied **only** inside `renderer.html`. The overridden `renderer.link` (~58–77) builds the anchor by raw concatenation `'<a href="' + href + '"'` (line 67) where `href = token.href` comes straight from attacker markdown, with no DOMPurify and no scheme validation; `title` (~69) and the heading `id` (~54) are interpolated unescaped (attribute breakout). marked 18 has no built-in `javascript:` filter. Untrusted source: persisted note/triage/chat content from the backend (e.g. `getNoteById` in note-page.component.ts:178) bound into `<markdown [data]=...>` across note-page, triage-note-editor-dialog, note-editor-dialog, chat-messages.

**Exploit:** an authenticated author stores `[click me](javascript:fetch('/api/me')…)`; `renderer.link` emits the unsanitized anchor; with the sanitizer at NONE the `javascript:` href reaches the DOM; a victim viewing the note in their authenticated (HttpOnly-cookie) session clicks it and the script runs in-origin. A `title`-attribute breakout variant fires on `onmouseover` without a click.

**Fix:** scheme-allowlist + attribute-escape href/title/id in `renderer.link` (reject `javascript:`/`data:`/`vbscript:`), or route the anchor through DOMPurify; restore `SecurityContext.HTML` or DOMPurify the entire output.

### F-002 — Untrusted remote-cell update keys written via bracket assignment without `__proto__`/constructor guard
**MEDIUM · confidence 0.80 · prototype-pollution · src/app/pages/dfd/application/executors/node-operation-executor.ts:500**

A remote `diagram_operation_event` WS frame (untrusted peer/server) is `JSON.parse`d at websocket.adapter.ts:501; `_validateTMIMessage` checks only that `operation.type` is a string and `operation.cells` is an array — no key stripping. The cell becomes `properties: normalizedCell` (app-remote-operation-handler.service.ts:330–348), then `_applyNodeUpdates` does `merged[k] = v` (~line 504) with attacker key `k` on `merged = {...currentData}`. No `__proto__`/`constructor`/`prototype` filter exists anywhere in the `dfd` tree; `normalizeCellFormat` (`{...cell}`) preserves a `__proto__` own-key from `JSON.parse`. `merged['__proto__'] = {…}` invokes the setter and reassigns the prototype of `merged`. **Bounded:** local object-shape corruption, not global `Object.prototype` pollution.

**Fix:** skip `{__proto__, constructor, prototype}` in the merge loop (reuse `PROTOTYPE_POLLUTION_KEYS`) or build with `Object.create(null)`; sanitize cells in the remote-operation handler before conversion.

### F-003 — Static/SPA server sets no security response headers — no server-side backstop for stored XSS or clickjacking
**MEDIUM · confidence 0.80 · missing-security-headers · server.js:138**

`server.js` emits no security headers on any response (only `Cache-Control` on `/config.json`, line 120). The SPA fallback (`res.sendFile`, 138–140), static middleware (126–135), and API proxy (28–35) carry no CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy. The two in-app mechanisms are inert: `security-headers.interceptor.ts:14-16` early-returns in production and otherwise only logs; `SecurityConfigService.injectDynamicCSP()` injects a CSP meta tag but deliberately drops `frame-ancestors` (security-config.service.ts:303), and `index.html:8` has only a comment. Net: no clickjacking protection and no server-set CSP backstop for F-001.

**Exploit:** frame the app under decoy UI (no X-Frame-Options / frame-ancestors) for UI-redress against confidential threat models; and an injected `<script>` from markdown (F-001) has no server-tier CSP to stop it.

**Fix:** add `helmet`/explicit middleware emitting CSP (`frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS. *Caveat: a fronting CDN/proxy may add these in production — open question in the threat model.*

### F-004 — MS picker window-message handler validates origin strictly but does not verify `evt.source`
**LOW · confidence 0.80 · origin-validation · src/app/core/services/microsoft-file-picker.service.ts:243**

`_onWindowMessage` (~243–258) gates strictly on `evt.origin !== this.pickerOrigin` (exact match against server-minted `picker_origin`) plus `type==='initialize'` and `id===channelId`, but never checks `evt.source === this.iframe?.contentWindow`. Any frame at the exact trusted `pickerOrigin` that knows the random `channelId` could deliver `initialize` and capture the MessageChannel port carrying the access token. Preconditions (control content at a Microsoft origin **and** guess a random channelId) make it near-theoretical. **Fix:** add the `evt.source` check.

### F-005 — withCredentials scoped to apiUrl via prefix `startsWith`, not exact-origin match
**LOW · confidence 0.80 · csrf · src/app/core/interceptors/credentials.interceptor.ts:28**

`isApiRequest` gates on `url.startsWith(environment.apiUrl)`. When `apiUrl` has a path (`https://api.example.com/v1`), a prefix-colliding host could match and receive the HttpOnly cookie — but all HttpClient URLs are built by `ApiService.buildUrl` as `apiUrl + '/' + fixed-fragment`, so no request host is attacker-influenced today. Robustness nuance, not currently reachable. **Fix:** compare `new URL(url).origin === new URL(apiUrl).origin`.

### F-006 / F-007 / F-010 — Unvalidated backend `authorization_url` assigned to `window.location.href` (3 sites)
**MEDIUM · confidence 0.70 / 0.70 / 0.60 · open-redirect**
- F-006 — src/app/core/components/user-preferences-dialog/connected-accounts-tab/connected-accounts-tab.component.ts:276
- F-007 — src/app/shared/components/access-diagnostics-panel/remediation-card/remediation-card.component.ts:109
- F-010 — src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.ts:560

All three assign a raw backend `authorization_url` string (from `POST /me/content_tokens/{provider}/authorize`) directly to `window.location.href` with no scheme/origin allowlist and **no `javascript:`/`data:` block** — so a hostile value is in-origin XSS, not just a redirect (T9). Exploitability is backend-contingent: it requires the authorize endpoint to be induced into returning an attacker-controlled URL. **Fix:** a shared `navigateToProviderAuthUrl(url)` helper enforcing `https:` + a per-provider host allowlist before navigating.

### F-008 — OAuth state/CSRF validation skipped when the callback omits the state parameter
**HIGH · confidence 0.70 · csrf · src/app/auth/services/auth.service.ts:830**

`handleOAuthCallback` validates CSRF state only inside `if (response.state)` (~830); when state is absent, the `else` branch (~868–875) proceeds with no check, and the pipeline never requires a stored `oauth_state`. The callback accepts a `code`-only (or fragment-token) callback, so an attacker controls whether the defense runs. **Mitigating fact (from scoring):** the primary `code` path requires a PKCE verifier in `exchangeAuthorizationCode` (throws if absent) and PKCE binds the code server-side, so auth-code injection is independently blocked there. The truly unguarded spot is the legacy fragment `access_token` path (F-018). Severity is the missing-CSRF-control flaw; headline login-CSRF impact is partly mitigated by PKCE. **Fix:** make state validation mandatory for any code/token callback; remove the unguarded `else`.

### F-009 — Untrusted state deserialized via `JSON.parse(atob(state))` with no shape validation
**LOW · confidence 0.70 · deserialization · src/app/auth/services/auth.service.ts:776**

`decodeState` casts the parsed object to `{csrf, returnUrl}` with no runtime check; `isValidReturnUrl` calls `url.startsWith('/')`, so a non-string `returnUrl` (e.g. `{"returnUrl":123}`) throws a `TypeError` in an async `switchMap` that the synchronous try/catch does not catch. Open redirect itself is mitigated (returnUrl re-validated at the sink). Impact is a self-inflicted exception in the attacker's own login. **Fix:** validate shape (`typeof csrf === 'string'`, returnUrl string-or-undefined) and guard `isValidReturnUrl` entry.

### F-011 — `'everyone'` pseudo-group grants any authenticated user the entry's role client-side, including writer/owner
**MEDIUM · confidence 0.60 · privilege-escalation · src/app/pages/tm/services/threat-model-authorization.service.ts:354**

In `_matchAuthorizationEntry` (~354–362), a group entry whose `provider_id` lowercases to `'everyone'` returns `auth.role` for any authenticated user with no membership check and **no cap to reader** — writer/owner can be granted, feeding `canEdit$`/`canManagePermissions$` (~71 gates). Backend-contingent on whether the Go backend enforces the same broad semantics. The most actionable real-code item in the authz cluster. **Fix:** cap `'everyone'` to `reader` client-side; disallow writer/owner for it in the permissions dialog; confirm the backend caps it too.

### F-012 — Open-schema inbound WS message validation; extra attacker keys pass through
**LOW · confidence 0.50 · deserialization · src/app/core/services/websocket.adapter.ts:538**

`_validateTMIMessage`/`_validateWebSocketMessage` check required-field types but not a closed schema, so attacker-chosen extra properties survive to subscribers and shape-trusting consumers (the entry point for F-002). Largely a defense-in-depth restatement. **Fix:** closed-schema/allowlist validation before handing cells to remote-operation handlers.

### F-013 — `return_to` query param navigated via `navigateByUrl` with no `isValidReturnUrl` check
**MEDIUM · confidence 0.50 · open-redirect · src/app/core/components/content-callback/content-callback.component.ts:64**

`return_to` from the query string is passed straight to `router.navigateByUrl` (line 64), unlike the auth.service.ts paths which gate on `isValidReturnUrl`. Angular's router parses the arg as an in-app route, so `//evil.com` / `https://evil` do **not** produce a true off-origin redirect — the defect is the validation inconsistency and arbitrary in-app navigation, not external redirect. **Fix:** route through the shared `isValidReturnUrl`.

### F-014 — Angular sanitizer disabled (`SecurityContext.NONE`) leaves markdown-native renderer paths without a framework backstop
**HIGH · confidence 0.40 · xss · src/app/shared/markdown-providers.ts:201**

Root cause of F-001: with the sanitizer off and DOMPurify applied only in `renderer.html`, other renderer paths (image/autolink/link/heading) have no fallback. Scoring found marked 18's default image/autolink renderers `encodeURI` the src and escape alt/title, so the one concrete unsanitized sink today is `renderer.link` (= F-001); this entry is the systemic "no backstop" observation. **Fix:** re-enable Angular sanitization or DOMPurify the full output; override/sanitize `renderer.image`.

### F-015 — DOMPurify in `renderer.html` uses permissive ALLOWED_URI_REGEXP and allows style/svg
**MEDIUM · confidence 0.40 · xss · src/app/shared/markdown-providers.ts:159**

The sole sanitized path permits `data:` URIs and allows `style`/`svg`/`path`/`g`. Scoring: the SVG subset is presentational (no `use`/`foreignObject`/`animate`/`script`), DOMPurify strips event handlers and applies mXSS defenses, so no demonstrated script-execution path — low-severity hardening. **Fix:** drop `data:`, tighten the URI allowlist, remove `style`, minimize the SVG set.

### F-016 — Email-fallback owner match can grant `owner` on email collision (same provider)
**LOW · confidence 0.40 · privilege-escalation · src/app/pages/tm/services/threat-model-authorization.service.ts:255**

`_checkOwnerMatch` (~252–294) treats the user as owner when `owner.provider_id === currentUserEmail` even without a provider_id match (a documented backend-bug workaround); `providerMatches` is still required, so it is same-provider only. Narrow precondition + backend-contingent. **Fix:** drop the email fallback or gate on a server-verified-email flag.

### F-017 — Cached `is_admin`/`is_security_reviewer` keeps deauthorized users privileged until a guard re-fetch
**LOW · confidence 0.40 · privilege-escalation · src/app/auth/services/auth.service.ts:205**

Getters read the in-memory profile refreshed per navigation; an admin deauthorized server-side keeps `is_admin` in an already-open page until the next `GET /me`. Backend-contingent and bounded by refresh cadence. **Fix:** re-validate sensitive in-page admin actions against a fresh `/me` or rely on server 401/403.

### F-018 — Legacy URL-fragment flow accepts a raw access_token from an attacker-controlled callback URL
**MEDIUM · confidence 0.40 · auth-bypass · src/app/auth/components/auth-callback/auth-callback.component.ts:91**

The fragment handler accepts `access_token` from the (fully attacker-controlled) URL fragment with optional state (skipping CSRF, F-008). Scoring confirmed the body token is **structurally dead** under the HttpOnly-cookie design: it is a branch-selector then discarded, `/me` uses cookies, only `expires_in` is stored. So no credential injection — only login-CSRF / client-state confusion, overlapping F-008. **Fix:** remove the legacy fragment token branch.

### F-019 — `/api` reverse proxy forwards arbitrary unauthenticated paths to the backend when enabled
**LOW · confidence 0.30 · ssrf · server.js:28**

The proxy (opt-in, fixed operator-env `TMI_PROXY_TARGET`) has no user-controlled target — **not** classic SSRF. Residual: when enabled it path-rewrites and forwards any `/api/*` (incl WS upgrades) from unauthenticated clients with `changeOrigin`, so the backend sees same-origin-looking traffic; a reachability bridge only if the backend trusts network position. Off by default. **Fix:** confirm backend per-route auth; restrict the proxied prefix.

### F-020 — Loose `isBase64` heuristic and non-constant-time csrf compare in `decodeState`
**MEDIUM · confidence 0.30 · csrf · src/app/auth/services/auth.service.ts:755**

The comparison `decodedStored.csrf !== decodedReceived.csrf` lacks type/length guards and constant-time compare. The originally-posited `undefined===undefined` bypass is **not reachable**: the stored state is always generated with a real crypto csrf and is never attacker-controlled. Genuine code smell, no exploitable bypass. **Fix:** require `typeof csrf === 'string' && length >= 32` on both sides, constant-time compare, explicit version marker.

### F-021 — All edit/manage gates derive from a single client-side permission calc (DevTools-flippable)
**LOW · confidence 0.20 · auth-bypass · src/app/pages/tm/services/threat-model-authorization.service.ts:389**

`canEdit`/`canManagePermissions` are pure client-side derivations gating ~71 call sites with no client re-check at mutation time. Textbook thin-client UX gating; by-design with an authoritative out-of-repo backend. Backend-contract observation, not a frontend bug. **Fix (contract):** verify the Go backend re-authorizes every mutation.

### F-022 — `/config.json` reflects only non-secret operator env vars to unauthenticated callers
**LOW · confidence 0.20 · info-disclosure · server.js:54**

Body built solely from `process.env.TMI_*`; `req` never accessed, no reflection. Risk-accepted (T12) recon-only disclosure; leaks only if an operator misuses a `TMI_*` var for a secret. **Fix:** document world-readability; optionally allowlist emitted keys.

### F-023 — `metadataToRecord` writes untrusted metadata keys via bracket assignment without proto guard
**LOW · confidence 0.20 · prototype-pollution · src/app/pages/dfd/domain/value-objects/metadata.ts:23**

`record[entry.key] = entry.value` over untrusted metadata with no proto filter, but values are string-coerced so `record['__proto__'] = '<string>'` is ignored by the setter — non-exploitable today. Latent gap if non-string values are ever passed. **Fix:** skip proto keys / use `Object.create(null)`.

### F-024 — Role claims documented as JWT-sourced but consumed only via server-validated `GET /me`
**LOW · confidence 0.20 · auth-bypass · src/app/auth/models/auth.models.ts:72**

The comment implies client JWT-claim trust, but a full grep found **no** client-side JWT role decode: roles come solely from the `GET /me` body (auth.service.ts:408–409, 1124–1125). The threat model's "JWT decoded without verification" hypothesis does not hold here — a clarifying non-issue. **Fix:** none required; optionally correct the misleading comment.
