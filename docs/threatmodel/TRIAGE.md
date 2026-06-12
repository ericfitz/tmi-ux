# Triage Report

24 findings in -> 3 duplicates, 20 false positives, 1 confirmed (0 high / 1 medium / 0 low), 0 need manual test.

Context: auto; environment = Angular SPA (tmi-ux) for collaborative threat modeling, untrusted input via backend-persisted markdown / OAuth callbacks / WebSocket frames / postMessage, authoritative authorization enforced by a separate out-of-repo Go backend; scoring = derived HIGH/MEDIUM/LOW; 3-vote verification, precision tie-break.

## Act on these

### [MEDIUM] renderer.link concatenates raw markdown href into <a href> with no scheme check, Angular sanitizer disabled — javascript: URI stored XSS  (f001)
`src/app/shared/markdown-providers.ts:67` | xss | claimed HIGH (alignment -2) | confidence 8.0/10
**Owner:** component: src/app/shared/ (markdown rendering); no CODEOWNERS in repo; git history on markdown-providers.ts shows only 1 recent commit (author 'Pentest Agent'), so no meaningful human committer signal — route to the frontend/shared-components team that owns markdown rendering and the ngx-markdown/DOMPurify config.
**Verdict:** exploitable, votes {true_positive: 3, false_positive: 0, cannot_verify: 0}
**Preconditions (2):**
- Attacker has an authenticated account on the collaborative app that can author/persist markdown into a shared surface (chat message, note, or triage note) rendered by another user; the three live `<markdown [data]>` sinks bind backend-persisted, peer-authored content (chat-messages.component.html:50 binds message.content directly).
- A victim user opens the view that renders the attacker's markdown (normal in a collaborative tool). No click is required for the strongest payload (event-handler attribute breakout via the unescaped quote in href/title, markdown-providers.ts:67-69, fires on hover/focus); the plain `javascript:` href variant additionally requires a victim click.
**Threat-model match:** none
**Why:** renderer.link concatenates raw token.href into `<a href>` with no scheme allowlist (markdown-providers.ts:67); the renderer.html DOMPurify hook only covers raw-HTML tokens, not marked-generated anchors. With SANITIZE=SecurityContext.NONE (line 201), ngx-markdown's sanitizeHtml returns the HTML unmodified (ngx-markdown.mjs:425) and assigns it to innerHTML (ngx-markdown.mjs:528), so a javascript: href in peer-persisted note/triage/chat markdown reaches the DOM live. This is a raw-HTML escape-hatch sink (SecurityContext.NONE + innerHTML), so the XSS-in-auto-escape-framework exclusion does not apply; stored cross-user XSS, the only gate being a victim click which is normal for stored XSS in collaborative content.

RANKING: The sink is genuine and unguarded: custom renderer.link (markdown-providers.ts:67-69) concatenates raw href and title into the anchor with no scheme allowlist and no quote-escaping; ngx-markdown is configured SANITIZE=SecurityContext.NONE (line 201) bypassing Angular's sanitizer, and the DOMPurify hook only wraps renderer.html, never the anchor (confirmed against marked 18.0.5, whose own escaping lives in the default renderer this code replaces). Both a click-gated javascript: variant and a no-click attribute-breakout variant (event handler via unescaped quote) are reachable, and three live consumers bind peer-persisted content. Exploitation requires an authenticated account that can persist cross-user markdown plus a victim viewing it (2 preconditions, authenticated access), landing at MEDIUM — one level below the scanner's HIGH, which under-weighted the authenticated-write precondition inherent to all stored XSS (alignment -2).
**Reachability evidence:** src/app/shared/markdown-providers.ts:67, src/app/pages/chat/components/chat-messages/chat-messages.component.html:50, src/app/pages/tm/components/note-page/note-page.component.html:239


## Dropped

| id | title | file:line | why dropped |
|----|-------|-----------|-------------|
| F-006 | Unvalidated backend authorization_url assigned to window.location.href | `src/app/core/components/user-preferences-dialog/connected-accounts-tab/connected-accounts-tab.component.ts:276` | duplicate of f007 (F-007) |
| F-010 | Unvalidated backend authorization_url assigned to window.location.href | `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.ts:560` | duplicate of f007 (F-007) |
| F-014 | Angular sanitizer disabled (SecurityContext.NONE) leaves markdown-nati | `src/app/shared/markdown-providers.ts:201` | duplicate of f001 (F-001) |
| F-002 | Untrusted remote-cell update keys written via bracket assignment witho | `src/app/pages/dfd/application/executors/node-operation-executor.ts:500` | implausible_trigger, misread_code; rule 13 |
| F-003 | Static/SPA server sets no security response headers (no CSP, HSTS, X-F | `server.js:138` | not_actionable; rule 13 |
| F-004 | MS picker window-message handler validates origin strictly but does no | `src/app/core/services/microsoft-file-picker.service.ts:243` | already_handled, intentional_behavior, not_actionable; rule 13 |
| F-005 | withCredentials scoped to apiUrl via prefix startsWith, not exact-orig | `src/app/core/interceptors/credentials.interceptor.ts:28` | implausible_trigger, not_actionable; rule 13 |
| F-007 | Unvalidated backend authorization_url assigned to window.location.href | `src/app/shared/components/access-diagnostics-panel/remediation-card/remediation-card.component.ts:109` | intentional_behavior; rule 8 |
| F-008 | OAuth state/CSRF validation is skipped entirely when the callback omit | `src/app/auth/services/auth.service.ts:830` | already_handled; rule 13 |
| F-009 | Untrusted OAuth state deserialized via JSON.parse(atob(state)) with no | `src/app/auth/services/auth.service.ts:776` | already_handled; rule 12 |
| F-011 | 'everyone' pseudo-group grants any authenticated user the entry's role | `src/app/pages/tm/services/threat-model-authorization.service.ts:354` | intentional_behavior, not_actionable; rule 9 |
| F-012 | Inbound WS JSON.parse output cast to typed message with open-schema va | `src/app/core/services/websocket.adapter.ts:538` | not_actionable; rule 13 |
| F-013 | Query-param return_to navigated via navigateByUrl with no isValidRetur | `src/app/core/components/content-callback/content-callback.component.ts:64` | intentional_behavior; rule 12 |
| F-015 | DOMPurify in renderer.html uses permissive ALLOWED_URI_REGEXP and allo | `src/app/shared/markdown-providers.ts:159` | intentional_behavior, not_actionable, already_handled; rule 13 |
| F-016 | Email-fallback owner match can grant 'owner' on email collision (same  | `src/app/pages/tm/services/threat-model-authorization.service.ts:255` | intentional_behavior, not_actionable; rule 9 |
| F-017 | Cached is_admin/is_security_reviewer keeps deauthorized users privileg | `src/app/auth/services/auth.service.ts:205` | intentional_behavior, not_actionable; rule 9 |
| F-018 | Legacy URL-fragment flow accepts a raw access_token from an attacker-c | `src/app/auth/components/auth-callback/auth-callback.component.ts:91` | already_handled, intentional_behavior; rule 15 |
| F-019 | /api reverse proxy forwards arbitrary unauthenticated paths to the bac | `server.js:28` | intentional_behavior; rule 5 |
| F-020 | Loose isBase64 heuristic and non-constant-time csrf comparison in deco | `src/app/auth/services/auth.service.ts:755` | already_handled, intentional_behavior; rule 16 |
| F-021 | All edit/manage gates derive from a single client-side permission calc | `src/app/pages/tm/services/threat-model-authorization.service.ts:389` | intentional_behavior; rule 9 |
| F-022 | /config.json reflects only non-secret operator env vars to unauthentic | `server.js:54` | intentional_behavior, not_actionable; rule 13 |
| F-023 | metadataToRecord writes untrusted metadata keys via bracket assignment | `src/app/pages/dfd/domain/value-objects/metadata.ts:23` | already_handled, intentional_behavior; rule 13 |
| F-024 | Role claims documented as JWT-sourced but consumed only via server-val | `src/app/auth/models/auth.models.ts:72` | doesnt_exist, misread_code; no rule |
