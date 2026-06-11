# OAuth2 Step-Up Retry Flow — Design

- **Issue:** [tmi-ux#680](https://github.com/ericfitz/tmi-ux/issues/680)
- **Status:** Design approved 2026-06-11. **Implementation blocked** on one small server change (JSON content negotiation on `/oauth2/step_up` — see [Server asks](#server-asks)); everything else shipped with tmi#397.
- **Server design reference:** `docs/superpowers/specs/2026-05-10-oauth2-step-up-design.md` (tmi repo, `dev/1.4.0`)
- **Related:** tmi-ux#679 (admin audit UI). **Dependency correction:** #680's earlier soft-block on #679 is moot — step-up protects `/admin/*` *writes*, and tmi-ux already ships consumers (`SettingsAdminService.updateSetting` → `PUT /admin/settings/{key}`, admin user/group mutations). The existing admin settings page is the e2e test surface.

## Summary

Net-new client flow: when a step-up-protected admin write returns `401` with a `WWW-Authenticate: insufficient_user_authentication` challenge, the client initiates `/oauth2/step_up` instead of token refresh. Weak providers (github) complete invisibly in-flight and the original request is transparently retried. Strong providers require a full-page IdP round-trip: the user confirms via dialog, re-authenticates, returns to the originating page, and redoes the action.

## Decisions made during design

| Decision | Choice | Rationale |
|---|---|---|
| Strong-path UX | Confirm dialog before redirect | Top-level navigation destroys page state; user consents instead of being yanked to an IdP. Matches the app's session-expiry dialog pattern. |
| Strong-path retry | Return-and-redo (snackbar prompt), **no mutation replay** | Auto-replaying stored mutations after a reload risks double-submit and stale payloads, and the originating component no longer exists to handle the response. |
| Weak-path retry | Transparent in-flight retry | Page never unloads; the observable chain is alive; retry once with a loop-guard context flag. |
| Weak-path messaging | **None** | Not actionable and doesn't affect workflow; the original operation succeeding is the feedback. Operator visibility lives in the server audit log (`strength=weak`), surfaced by the #679 UI. |
| Strength/transport detection | Server content negotiation (`Accept: application/json` → `step_up_redirect` + `redirect_url`) | One deterministic XHR. Avoids the 302-vs-200 polymorphism trap (top-level nav shows raw JSON on weak; XHR can't follow a cross-origin 302) and avoids duplicating the server's strength table client-side. |
| Identity mismatch | Dialog naming the required account, with retry | User must act; the email must be legible. Original session is still valid, so the app remains usable. |

## Flow

### Detection (JwtInterceptor)

New branch **before** the existing refresh logic: on 401, if the `WWW-Authenticate` header contains `insufficient_user_authentication`, this is a step-up challenge — token refresh is irrelevant and must not be attempted. Delegate to `StepUpService` and do not run the refresh/logout path.

CORS caveat: the header is readable cross-origin only if the server sends `Access-Control-Expose-Headers: WWW-Authenticate`. Server ask (b) confirms this; the 401 JSON body error code is the documented fallback detection if not.

The challenge branch applies to any endpoint (header-driven, not path-driven).

### Orchestration (StepUpService — new, `src/app/auth/services/step-up.service.ts`)

1. Generate PKCE verifier/challenge via existing `PkceService` (verifier to sessionStorage, as login does).
2. Build state: `{csrf, returnUrl: router.url, stepUp: true}` — existing state format plus a `stepUp` flag; stored in `localStorage.oauth_state` like the login flow.
3. `GET /oauth2/step_up?client_callback=...&state=...&code_challenge=...&code_challenge_method=S256` via XHR with `Accept: application/json` and credentials.
4. Response handling:
   - **`200 {result: "step_up_weak_complete", ...}`** — cookies already rotated by Set-Cookie. Signal the interceptor to replay the original request once, marked with a new `IS_STEPUP_RETRY` HttpContext flag (mirrors `IS_AUTH_RETRY`); a second challenge on the retried request falls through to normal error handling. No user-facing message.
   - **`200 {result: "step_up_redirect", redirect_url}`** — open the confirm dialog. Confirm → `window.location.href = redirect_url`. Cancel → the original request's 401 propagates to the calling page as a normal failure (no navigation, no retry).
   - Any error → propagate the original 401; log via `LoggerService`.
5. Concurrent challenges (multiple requests 401ing simultaneously) deduplicate through a shared in-flight observable (`shareReplay(1)`), same pattern as `forceRefreshToken()`.

### Confirm dialog

New `StepUpConfirmDialogComponent` (auth module). Copy: title "Re-authentication required"; body "This action requires recent authentication. You'll be redirected to sign in again. Unsaved changes on this page will be lost."; actions [Cancel `mat-button`] [Re-authenticate `mat-flat-button color="primary"`, `cdkFocusInitial`]. All strings localized.

### Callback completion (existing `handleOAuthCallback()` extended)

The existing callback machinery (state-CSRF validation, `POST /oauth2/token` with PKCE verifier, cookie session establishment, `returnUrl` navigation) is reused unchanged. Additions when decoded state has `stepUp: true`:

- After successful token exchange: navigate to `returnUrl` (existing behavior) and show snackbar "Re-authentication complete — please retry your action."
- On `400 identity_mismatch` from `/oauth2/token`: the user authenticated as a different identity at the IdP. The original session cookies were NOT rotated and remain valid. Navigate to `returnUrl`, then show a dialog: "You must re-authenticate as **{email}** to complete this action" — email from the current (still-valid) session profile — with [Try again] re-initiating `StepUpService` and [Cancel].

### What is NOT built

- No mutation replay/persistence across the redirect (return-and-redo).
- No weak-path user messaging.
- No client-side provider strength classification.
- No changes to the existing refresh/logout 401 path for non-challenge 401s.

## Edge cases

- **Dialog idle past state TTL (~10 min):** the Redis `oauth_state` entry expires; the callback fails state validation and lands on the existing auth-error path (login page). Acceptable; not specially handled.
- **User cancels at the IdP:** upstream returns `access_denied` to the callback — existing callback error handling applies; session remains valid.
- **Step-up challenge while a step-up is already in flight:** deduplication returns the in-flight observable.
- **SAML providers:** no client-side difference; the server returns the same `step_up_redirect` contract (`ForceAuthn` is server-side).
- **Client-credentials callers:** server rejects with `400 unsupported_grant_type`; not reachable from this UI (browser sessions are human), no special handling.

## Server asks

Filed as a new tmi issue (tmi#397 is closed):

1. **(a) Content negotiation on `GET /oauth2/step_up`:** when the request carries `Accept: application/json`, the strong path returns `200 {result: "step_up_redirect", redirect_url: "<upstream-idp-url>"}` instead of `302` (state + PKCE storage identical; the browser top-level `302` behavior is unchanged for non-JSON accepts). Weak path already returns JSON.
2. **(b) `Access-Control-Expose-Headers: WWW-Authenticate`** on 401 responses, or confirm/document the 401 JSON body error code as the challenge-detection contract.
3. **(c) Confirm the `identity_mismatch` error body shape** on `POST /oauth2/token` (error code field and any metadata, e.g. expected email) so the client can detect it reliably.

> **Implementing agents:** verify (a)–(c) against the published OpenAPI spec before starting; the contract above is agreed-in-principle but not yet published.

## i18n

New localized strings: confirm-dialog title/body/actions, redo snackbar, identity-mismatch dialog title/body/actions. Master locale + backfill across all locales.

## Testing

- **Interceptor:** challenge header → StepUpService invoked, refresh NOT attempted; non-challenge 401 → existing refresh path untouched; weak-complete → exactly one replay with `IS_STEPUP_RETRY`; replayed request 401s again → normal error, no loop; cancel → original error propagates.
- **StepUpService:** step-up URL construction (params, PKCE challenge present), state payload includes `stepUp: true` and `returnUrl`, dedup of concurrent challenges, error propagation.
- **Callback:** `stepUp` state → returnUrl navigation + redo snackbar; `identity_mismatch` → mismatch dialog with current session email; non-step-up callback behavior unchanged (regression tests).
- All against mocks; e2e (Playwright, against admin settings page) deferred until server ask (a) ships.
