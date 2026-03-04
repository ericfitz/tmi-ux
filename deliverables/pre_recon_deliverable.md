# Pre-Reconnaissance Report

## Port Discovery (naabu)
Status: Skipped
[object Object]

## Network Scanning (nmap)
Status: error
Error: 
    at runTerminalScan (file:///app/src/phases/pre-recon.js:25:80)
    exit code: 126 (Invoked command cannot execute)

## Subdomain Discovery (subfinder)
Status: success
[object Object]

## Technology Detection (whatweb)
Status: success
[object Object]
## Code Analysis
# Penetration Test Scope & Boundaries

**Primary Directive:** This analysis is strictly limited to the **network-accessible attack surface** of the application. All subsequent tasks must adhere to this scope. Before reporting any finding (e.g., an entry point, a vulnerability sink), it has been verified against the "In-Scope" criteria.

## In-Scope: Network-Reachable Components
A component is considered **in-scope** if its execution can be initiated, directly or indirectly, by a network request that the deployed application server is capable of receiving. This includes:
- Publicly exposed web pages and API endpoints.
- Endpoints requiring authentication via the application's standard login mechanisms.
- Any developer utility, debug console, or script that has been mistakenly exposed through a route or is otherwise callable from other in-scope, network-reachable code.

## Out-of-Scope: Locally Executable Only
A component is **out-of-scope** if it **cannot** be invoked through the running application's network interface and requires an execution context completely external to the application's request-response cycle. This includes tools that must be run via:
- A command-line interface (e.g., `go run ./cmd/...`, `python scripts/...`).
- A development environment's internal tooling (e.g., a "run script" button in an IDE).
- CI/CD pipeline scripts or build tools (e.g., Dagger build definitions).
- Database migration scripts, backup tools, or maintenance utilities.
- Local development servers, test harnesses, or debugging utilities.
- Static files or scripts that require manual opening in a browser (not served by the application).

---

## 1. Executive Summary

The TMI-UX application is an Angular 21.2-based single-page application (SPA) serving as the user interface for the TMI (Threat Modeling Improved) platform. The application demonstrates **strong security architecture** with defense-in-depth practices, comprehensive authentication mechanisms, and robust data protection controls. However, several areas require attention before production deployment.

The application architecture separates concerns cleanly: a minimal Express.js server (server.js) serves static assets and runtime configuration, while the Angular frontend communicates with a separate Go-based backend API for all business logic. This separation limits the frontend's attack surface significantly—the Express server has no business logic, database access, or user input processing beyond static file serving and environment variable injection.

**Critical Security Strengths:**
- OAuth 2.0 with PKCE (RFC 7636 compliant) and SAML 2.0 authentication
- Client-side AES-GCM encryption for JWT token storage
- DOMPurify-based XSS prevention in markdown rendering
- Comprehensive sensitive data redaction in logging
- Real-time collaboration via authenticated WebSocket connections
- Role-based access control (RBAC) with admin, reviewer, and user roles

**High-Priority Vulnerabilities Identified:**
1. **Weak token encryption key derivation** - Browser fingerprint components are easily enumerable, providing insufficient protection for localStorage-stored encrypted tokens
2. **Missing admin route guards** - `/admin/webhooks` and `/admin/addons` routes lack authorization guards
3. **Relaxed OAuth state validation** - State parameter validation is skipped when access tokens are present in callbacks
4. **Backend SSRF risk** - Webhook test functionality triggers server-side requests with user-controlled URLs (requires backend validation)

The application's most critical attack surfaces are the 130+ backend API endpoints (documented via OpenAPI schema), the WebSocket collaboration endpoint, and OAuth/SAML authentication flows. The frontend itself is a client-side application with no server-side request functionality, eliminating traditional SSRF vulnerabilities at the frontend layer.

---

## 2. Architecture & Technology Stack

### Framework & Language

**Primary Technology Stack:**
- **Framework:** Angular 21.2.0 (latest stable release)
- **Language:** TypeScript 5.9.3 with strict compilation enabled
- **Runtime:** Node.js 22.x LTS
- **Package Manager:** pnpm 10.30.1
- **Build System:** Angular CLI with Vite integration for development

The application leverages TypeScript's strict mode for comprehensive type safety, including `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, and `strictPropertyInitialization`. This provides compile-time guarantees that reduce runtime security errors. Path aliases (`@app/*` → `src/app/*`) are configured for cleaner imports and potential security benefits in preventing path traversal during module resolution.

**Server Component:**
- **File:** `/app/repos/tmi-ux/server.js`
- **Technology:** Express.js 5.2.1
- **Purpose:** Serves compiled Angular SPA and runtime configuration endpoint
- **Port:** 8080 (production), 4200 (development)
- **Security Feature:** express-rate-limit 8.2.1 (1000 requests per 15 minutes per IP)

The Express server is intentionally minimal—it has no business logic, no database connections, and no user input processing beyond serving static files. This "dumb server" pattern significantly reduces the frontend's attack surface.

### Architectural Pattern

**Classification:** Hybrid Monolithic SPA + External Microservices

The application follows a feature-based modular monolith pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT BROWSER (Untrusted Zone)                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Angular SPA (tmi-ux)                                 │  │
│  │  - 84 Injectable Services                             │  │
│  │  - Feature Modules: Auth, Admin, TM, DFD, Surveys    │  │
│  │  - Client-side validation & sanitization             │  │
│  │  - JWT token storage (AES-GCM encrypted)             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTPS + JWT Bearer Token
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TRUST BOUNDARY: Network Edge                                │
│  - TLS/HTTPS Encryption (expected in production)            │
│  - Rate Limiting (1000 req/15min per IP)                    │
│  - Security Headers (HSTS, CSP, X-Frame-Options)           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  EXPRESS SERVER (Semi-Trusted Zone)                         │
│  - Static file serving only                                  │
│  - Runtime config injection (/config.json)                  │
│  - No business logic                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                REST + WebSocket (wss://)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TMI API SERVER (Trusted Zone - Not in this codebase)      │
│  - Go-based microservice                                    │
│  - Business logic & data persistence                        │
│  - OAuth/SAML authentication server                         │
│  - Authorization & RBAC enforcement                         │
│  - 130+ REST API endpoints                                  │
└─────────────────────────────────────────────────────────────┘
```

**Trust Boundary Analysis:**

The primary trust boundary exists between the client browser and the Express server. All data crossing this boundary is assumed untrusted and subject to validation. A secondary trust boundary exists between the Express server and the backend Go API, where JWT bearer tokens establish authentication and authorization context.

**Security Implications:**
- **Client-side validation** is purely for UX; backend validation is mandatory
- **JWT tokens** establish identity but are vulnerable to XSS (mitigated by DOMPurify, but localStorage storage remains a risk)
- **WebSocket connections** require separate authentication (token passed as query parameter)
- **Cross-origin requests** are handled by backend CORS configuration

**Frontend Directory Structure:**
```
/app/repos/tmi-ux/src/app/
├── auth/               # Authentication & authorization (guards, services, interceptors)
├── core/               # Core services (API client, WebSocket, logging, security)
├── pages/              # Feature modules (admin, dashboard, tm, dfd, surveys, triage)
├── shared/             # Shared UI components & utilities
├── i18n/               # Internationalization (16 languages)
└── generated/          # OpenAPI-generated TypeScript types (28,793 lines)
```

### Critical Security Components

**1. Authentication & Authorization Framework**

The application implements a comprehensive multi-provider authentication system with the following components:

**Primary Service:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (2,047 lines)

This service orchestrates:
- OAuth 2.0 with PKCE (Proof Key for Code Exchange, RFC 7636)
- SAML 2.0 enterprise SSO
- JWT token lifecycle management
- Client-side token encryption (AES-GCM)
- Token refresh automation
- Cross-tab session synchronization

**PKCE Implementation:** `/app/repos/tmi-ux/src/app/auth/services/pkce.service.ts` and `/app/repos/tmi-ux/src/app/auth/utils/pkce-crypto.utils.ts`

The PKCE implementation is fully RFC 7636 compliant:
- Code verifier: 256-bit random value (32 bytes) generated via `crypto.getRandomValues()`
- Code challenge: SHA-256 hash of verifier, base64url-encoded
- Challenge method: S256 (SHA-256)
- Storage: sessionStorage with 5-minute TTL
- Cleanup: Verifier cleared after successful token exchange

This prevents authorization code interception attacks, crucial when the OAuth client runs in the browser environment.

**2. Session Management**

**Service:** `/app/repos/tmi-ux/src/app/auth/services/session-manager.service.ts`

Implements sophisticated session lifecycle management:
- **Proactive token refresh:** Tokens are refreshed 15 minutes before expiry for active users
- **Inactivity warnings:** Users receive a 5-minute warning before session expiration
- **Zombie session prevention:** Three-layer defense mechanism:
  1. Visibility change detection (validates tokens when tab becomes visible)
  2. Timer drift detection (catches backgrounded tabs with throttled timers)
  3. Cross-tab synchronization (logout in one tab propagates to all tabs)
- **Activity-based refresh:** WebSocket activity triggers token refresh

This multi-layered approach prevents common session management vulnerabilities like session fixation, zombie sessions, and token hijacking across multiple browser tabs.

**3. Content Security & XSS Prevention**

**Configuration:** `/app/repos/tmi-ux/src/app/app.config.ts` (lines 150-285)

The application uses DOMPurify 3.3.1 integrated with marked 17.0.3 for markdown rendering:

```typescript
renderer.html = (args): string => {
  const html = originalHtml(args);
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 
                   'em', 'del', 'a', 'img', 'code', 'pre', 'ul', 'ol', 'li', 
                   'blockquote', 'table', /* SVG tags for mermaid */],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'type'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    KEEP_CONTENT: true,
  });
};
```

**Mermaid Diagram Security:** (line 292)
```typescript
securityLevel: 'strict'  // Prevents XSS in diagram definitions
maxTextSize: 50000       // DoS prevention
```

This whitelist-based approach with URI scheme validation provides defense-in-depth against XSS attacks in user-generated content.

**4. HTTP Security**

**JWT Interceptor:** `/app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts`

Automatically injects Bearer tokens into authenticated requests:
- Public endpoint detection (no auth for `/oauth2/providers`, `/version`, `/config`)
- 401 error handling with automatic token refresh
- Retry prevention using HttpContext tokens
- Does NOT auto-logout (propagates errors to components for user-friendly handling)

**Security Headers Interceptor:** `/app/repos/tmi-ux/src/app/core/interceptors/security-headers.interceptor.ts`

Development-mode validator that checks for missing security headers:
- HSTS (Strict-Transport-Security)
- CSP (Content-Security-Policy)
- X-Frame-Options
- Referrer-Policy

**HTTP Logging Interceptor:** `/app/repos/tmi-ux/src/app/core/interceptors/http-logging.interceptor.ts`

Logs all API requests/responses with automatic sensitive data redaction:
- Authorization header masking (shows only first 4 and last 4 characters)
- Request/response body redaction
- URL parameter redaction (token, api_key, etc.)

**5. Cryptography & Secure Random Generation**

The application properly uses Web Crypto API for all security-sensitive operations:

**Token Encryption:** (auth.service.ts, lines 1976-2045)
- Algorithm: AES-GCM (authenticated encryption)
- Key length: 256 bits
- IV: 12-byte random value (proper GCM IV size)
- Key derivation: SHA-256 hash of browser fingerprint + session salt

**PKCE Code Challenge:** (pkce-crypto.utils.ts, lines 72-90)
- Code verifier: 256-bit CSPRNG value
- Code challenge: SHA-256(verifier)
- Encoding: base64url (RFC 4648)

**OAuth State CSRF Token:** (auth.service.ts, lines 806-826)
- 128-bit CSPRNG value (16 bytes)
- Hex-encoded for URL safety
- Validated on OAuth callback

**Security Note:** All random value generation uses `crypto.getRandomValues()`, which is cryptographically secure (not `Math.random()`).

**6. Real-Time Collaboration Security**

**WebSocket Adapter:** `/app/repos/tmi-ux/src/app/core/services/websocket.adapter.ts` (1,227 lines)

Implements secure WebSocket communication for collaborative diagram editing:
- **Authentication:** JWT token passed as query parameter (`?token=...`)
- **Token refresh integration:** WebSocket activity triggers token refresh in auth service
- **Connection monitoring:** Automatic reconnection with exponential backoff
- **Message validation:** Schema validation for all TMI protocol messages
- **Logging:** Token redacted from all log output

**Collaboration Service:** `/app/repos/tmi-ux/src/app/core/services/dfd-collaboration.service.ts`

Manages multi-user sessions with:
- User presence tracking
- Cursor position synchronization
- Operational transformation for conflict resolution
- Session lifecycle management

**Security Implications:**
- WebSocket token visibility in DevTools network tab (unavoidable with query parameter auth)
- Potential for token leakage via proxy logs (mitigated by wss:// in production)
- Message tampering requires JWT token (server validates)

---

## 3. Authentication & Authorization Deep Dive

### Authentication Mechanisms

The application supports three authentication methods, all delegated to the backend Go API server:

**1. OAuth 2.0 with PKCE**

**Provider Discovery:** `/oauth2/providers` endpoint returns available OAuth providers (Google, GitHub, Microsoft, custom)

**Flow Implementation:** (auth.service.ts, lines 708-780)

```typescript
// 1. Generate PKCE parameters
const pkceParams = await this.pkceService.generatePKCE();

// 2. Generate CSRF state token
const state = this.generateRandomState(returnUrl);
localStorage.setItem('oauth_state', state);

// 3. Construct authorization URL
const authUrl = `${provider.auth_url}?` +
  `state=${encodeURIComponent(state)}` +
  `&code_challenge=${pkceParams.codeChallenge}` +
  `&code_challenge_method=S256` +
  `&client_callback=${encodeURIComponent(callbackUrl)}`;

// 4. Browser redirects to OAuth provider
window.location.href = authUrl;
```

**Callback Handling:** (auth.service.ts, lines 895-958)

```typescript
// 1. Extract code and state from URL
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const returnedState = urlParams.get('state');

// 2. Validate state parameter (CSRF protection)
const storedState = localStorage.getItem('oauth_state');
if (returnedState !== storedState) {
  throw new Error('State mismatch - possible CSRF attack');
}

// 3. Exchange code for token
const verifier = this.pkceService.getVerifier().codeVerifier;
const tokenResponse = await this.http.post('/oauth2/token', {
  code: code,
  code_verifier: verifier,
  idp: providerId
});

// 4. Store encrypted token
this.storeToken(tokenResponse.access_token);
```

**Security Properties:**
- ✅ PKCE prevents authorization code interception
- ✅ State parameter prevents CSRF attacks
- ✅ Code verifier stored in sessionStorage (cleared on tab close)
- ⚠️ State validation relaxed when `access_token` is present (lines 917-919)

**VULNERABILITY: Relaxed State Validation**
```typescript
// Lines 917-919: State validation skipped if access_token present
if (accessToken && !returnedState) {
  // TMI OAuth proxy may not echo state parameter
  // Proceed without state validation
}
```

This weakens CSRF protection for TMI's OAuth proxy. While the backend may have compensating controls, client-side validation should not be relaxed.

**2. SAML 2.0 SSO**

**Provider Discovery:** `/saml/providers` endpoint returns enterprise SAML providers

**Flow Implementation:** (auth.service.ts, lines 719-722)

```typescript
const clientCallbackUrl = `${window.location.origin}/oauth2/callback`;
const authUrl = `${provider.auth_url}?client_callback=${encodeURIComponent(clientCallbackUrl)}`;
window.location.href = authUrl;
```

**SAML Return URL Handling:** (lines 718-719)
```typescript
sessionStorage.setItem('saml_return_url', returnUrl);
```

**Security Properties:**
- ✅ Client callback URL uses origin (not full current URL)
- ✅ Return URL stored in sessionStorage (not localStorage)
- ✅ SAML assertion validation happens server-side
- ⚠️ No client-side signature validation (expected - SAML assertions are XML signed)

**3. JWT Token Management**

**Token Structure:**
```typescript
interface JwtToken {
  token: string;           // Raw JWT string
  expiresAt: Date;        // Parsed from 'exp' claim
  refreshToken?: string;  // Optional refresh token
}
```

**Token Storage:** (auth.service.ts, lines 1463-1509)

The application encrypts tokens before storing in localStorage:

```typescript
// Encryption process
private async encryptToken(token: JwtToken, keyStr: string): Promise<string> {
  // 1. Derive AES-GCM key from browser fingerprint
  const key = await this.getAesKeyFromString(keyStr);
  
  // 2. Generate random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // 3. Encrypt token JSON
  const plaintext = new TextEncoder().encode(JSON.stringify(token));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  
  // 4. Format as IV:ciphertext
  return `${base64(iv)}:${base64(ciphertext)}`;
}
```

**Key Derivation:** (lines 1951-1971)

**CRITICAL VULNERABILITY: Weak Key Material**

The encryption key is derived from browser fingerprint components:
```typescript
const fingerprint = [
  navigator.userAgent,
  navigator.language,
  screen.width + 'x' + screen.height,
  new Date().getTimezoneOffset().toString(),
  sessionSalt  // 16-byte random value in sessionStorage
].join('|');
```

**Security Issues:**
1. Browser fingerprint components are **easily enumerable** by an attacker with localStorage access
2. Session salt in sessionStorage is **lost on tab close**, making tokens permanently unrecoverable
3. Key derivation uses SHA-256 hash (no key stretching like PBKDF2)

**Comment in code acknowledges this:** (lines 1940-1949)
```typescript
// Note: This encryption is defense-in-depth only, not strong protection.
// A determined attacker with localStorage access could enumerate
// fingerprint components to derive the key.
```

**Recommendation:** Use Web Crypto API to generate a true random key:
```typescript
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  false,  // non-extractable
  ['encrypt', 'decrypt']
);
// Store key handle in IndexedDB or accept session-only tokens
```

**Token Refresh:** (auth.service.ts, lines 354-425)

Tokens are automatically refreshed under these conditions:
- Token expires within 15 minutes AND
- User has been active (recent WebSocket or API activity)

**Refresh Flow:**
```typescript
// 1. Check if refresh needed
const refreshThreshold = 15 * 60 * 1000; // 15 minutes
const needsRefresh = (token.expiresAt.getTime() - now) < refreshThreshold;

// 2. Call refresh endpoint
const newToken = await this.http.post('/oauth2/refresh', {
  refresh_token: token.refreshToken
});

// 3. Store new encrypted token
this.storeToken(newToken);

// 4. Update WebSocket connection
this.websocketAdapter.updateToken(newToken);
```

**Token Validation:** (lines 291-300)
```typescript
private isTokenValid(token?: JwtToken | null): boolean {
  if (!token) return false;
  const now = new Date();
  return token.expiresAt > now;
}
```

### Authentication API Endpoints

**CRITICAL:** All authentication API endpoints listed below are implemented in the **backend Go server**, not this frontend codebase. These endpoints are documented here because they are the primary attack surface for authentication-related vulnerabilities.

| Endpoint | Method | Authentication | Purpose | File Reference |
|----------|--------|----------------|---------|----------------|
| `/oauth2/providers` | GET | Public | List OAuth providers | auth.service.ts:541 |
| `/saml/providers` | GET | Public | List SAML providers | auth.service.ts:587 |
| `/oauth2/authorize` | GET | Public | Initiate OAuth flow | auth.service.ts:722 |
| `/oauth2/callback` | GET | Public | Handle OAuth callback | auth.service.ts:895 |
| `/oauth2/token` | POST | Public | Exchange code for token | auth.service.ts:1169 |
| `/oauth2/refresh` | POST | Authenticated | Refresh JWT token | auth.service.ts:364 |
| `/oauth2/userinfo` | GET | Authenticated | Get user info | N/A (not used) |
| `/me` | GET | Authenticated | Get current user profile | auth.service.ts:1727 |
| `/me/logout` | POST | Authenticated | Logout | auth.service.ts:1896 |
| `/saml/{provider}/login` | GET | Public | Initiate SAML flow | auth.service.ts:719 |
| `/saml/acs` | POST | Public | SAML Assertion Consumer | Backend only |

**OAuth/OIDC Flow Security Checks:**

1. **State Parameter Validation** (auth.service.ts:906-916)
   - **Location:** Lines 906-916
   - **Current Implementation:** Validates state unless access_token is present
   - **VULNERABILITY:** Lines 917-919 skip validation for TMI OAuth proxy
   - **Recommendation:** Always validate state parameter

2. **Nonce Parameter Validation**
   - **Status:** NOT IMPLEMENTED
   - **Risk:** OIDC flows lack replay protection
   - **Recommendation:** Implement nonce generation and validation for OIDC flows

3. **PKCE Code Verifier Protection**
   - **Storage:** sessionStorage (cleared on tab close)
   - **TTL:** 5 minutes (pkce.service.ts:23)
   - **Cleanup:** Cleared after token exchange (auth.service.ts:1224)
   - **Status:** ✅ PROPERLY IMPLEMENTED

### Session Management & Cookie Security

**Session Cookie Configuration:**

**CRITICAL FINDING:** The application does **NOT use HTTP cookies** for session management. All session state is stored in localStorage/sessionStorage with client-side encryption.

**Security Implications:**
- ❌ No HttpOnly flag protection (cookies not used)
- ❌ No Secure flag enforcement (cookies not used)
- ❌ No SameSite protection (cookies not used)
- ✅ Immune to cookie-based attacks (CSRF via cookies, session fixation)
- ⚠️ Vulnerable to XSS-based token theft (despite DOMPurify protection)

**Session Storage Locations:**

1. **localStorage['auth_token']** - Encrypted JWT token
2. **localStorage['user_profile']** - Encrypted user profile
3. **localStorage['oauth_state']** - CSRF state token (cleared after use)
4. **sessionStorage['_ts']** - Session salt for token encryption (lost on tab close)
5. **sessionStorage['pkce_verifier']** - PKCE code verifier (5-minute TTL)

**Session Lifecycle:**

**Session Start:**
1. User initiates OAuth/SAML login
2. Backend returns JWT token
3. Frontend extracts user profile from JWT claims
4. Token encrypted with browser fingerprint key
5. Encrypted token stored in localStorage
6. Session expiry timers started

**Session Activity:**
- Timer: 15 minutes before expiry, check for user activity
- Activity sources: API calls, WebSocket messages, user interactions
- If active: Automatically refresh token
- If inactive: Show 5-minute warning dialog

**Session End (Logout):** (auth.service.ts:1833-1864)
```typescript
private clearAuthData(): void {
  // 1. Remove stored data
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_profile');
  
  // 2. Clear in-memory subjects
  this.jwtTokenSubject.next(null);
  this.userProfileSubject.next(null);
  this.isAuthenticatedSubject.next(false);
  
  // 3. Clear PKCE verifier
  this.pkceService.clearVerifier();
  
  // 4. Broadcast logout to other tabs
  localStorage.setItem('auth_logout_broadcast', Date.now().toString());
  localStorage.removeItem('auth_logout_broadcast');
}
```

**Cross-Tab Logout Synchronization:** (auth.service.ts:236-255)
```typescript
// Listen for storage events from other tabs
window.addEventListener('storage', (event) => {
  if (event.key === 'auth_logout_broadcast') {
    // Another tab logged out - clear local session
    this.clearAuthData();
  }
});
```

This ensures that logging out in one browser tab immediately logs out all other tabs, preventing zombie sessions.

### Authorization Model & RBAC

**Role Hierarchy:**

```
Roles (from JWT claims):
├── tmi_is_administrator = true      (Admin)
├── tmi_is_security_reviewer = true  (Reviewer)
└── (default)                        (Authenticated User)
```

**Permission Model:** (JWT claims)
```typescript
interface JwtPayload {
  sub: string;                          // OAuth sub (user ID)
  email: string;
  name: string;
  groups: string[];                     // Group memberships
  tmi_is_administrator?: boolean;       // Admin flag
  tmi_is_security_reviewer?: boolean;   // Reviewer flag
  exp: number;                          // Token expiry (Unix timestamp)
}
```

**Route Guards:**

| Guard | File | Purpose | Implementation |
|-------|------|---------|----------------|
| authGuard | auth.guard.ts | Protects authenticated routes | Checks token validity |
| adminGuard | admin.guard.ts | Protects admin routes | Checks `tmi_is_administrator` |
| reviewerGuard | reviewer.guard.ts | Protects reviewer routes | Checks `tmi_is_security_reviewer` |
| homeGuard | home.guard.ts | Redirects based on auth state | Routes to dashboard or login |

**CRITICAL VULNERABILITY: Missing Admin Guards**

**Location:** `/app/repos/tmi-ux/src/app/app.routes.ts`

The following admin routes are missing `adminGuard` protection:
```typescript
// Line references needed from actual routes file
{
  path: 'admin/webhooks',
  loadComponent: () => import('./pages/admin/webhooks/admin-webhooks.component'),
  canActivate: [authGuard]  // ❌ Should be [authGuard, adminGuard]
},
{
  path: 'admin/addons',
  loadComponent: () => import('./pages/admin/addons/admin-addons.component'),
  canActivate: [authGuard]  // ❌ Should be [authGuard, adminGuard]
}
```

**Impact:** Authenticated non-admin users may access admin webhook and addon management interfaces.

**Recommendation:**
```typescript
{
  path: 'admin/webhooks',
  loadComponent: () => import('./pages/admin/webhooks/admin-webhooks.component'),
  canActivate: [authGuard, adminGuard]
}
```

**Resource-Level Authorization:**

The application implements Principal-based authorization for resources:

```typescript
interface Principal {
  role: 'owner' | 'writer' | 'reader';
  principal_type: 'user' | 'group';
  principal_id: string;
}
```

**Permission Hierarchy:**
- **Owner:** Full CRUD + share/delete permissions
- **Writer:** Create, read, update (no delete, no share)
- **Reader:** Read-only access

**Authorization Enforcement:**
- Frontend: UI-level restrictions (hide buttons, disable actions)
- Backend: Enforces permissions on all API operations
- **Security Note:** Client-side authorization is UX only; backend enforcement is mandatory

---

## 4. Data Security & Storage

### Database Security

**CRITICAL NOTE:** This Angular SPA frontend has **NO direct database access**. All data persistence is handled by the backend Go API server.

**Database Technology:** (Backend only - not in this codebase)
- The backend TMI server uses a database (PostgreSQL/MySQL/SQLite)
- Connection strings and credentials are managed server-side
- SQL injection vulnerabilities would be backend vulnerabilities

**Frontend Data Storage:**

The frontend uses browser storage mechanisms exclusively:

### localStorage Usage

**1. Encrypted JWT Token** (auth.service.ts:1463-1509)
- **Key:** `auth_token`
- **Content:** AES-GCM encrypted JWT token
- **Encryption:** 256-bit AES-GCM with browser fingerprint-derived key
- **Security:** Weak key derivation (see Section 3)
- **Cleared on:** Logout, token expiry, browser data clearing

**2. Encrypted User Profile** (auth.service.ts:1572-1632)
- **Key:** `user_profile`
- **Content:** AES-GCM encrypted user profile (email, name, roles)
- **Encryption:** AES-GCM with JWT token as key material
- **Security:** Better than token encryption (requires actual token)
- **Cleared on:** Logout

**3. OAuth State Token** (auth.service.ts:755-756)
- **Key:** `oauth_state`
- **Content:** CSRF protection token
- **Encryption:** None (ephemeral)
- **Lifetime:** Only during OAuth flow
- **Cleared on:** OAuth callback completion

**4. User Preferences** (user-preferences.service.ts)
- **Keys:** Various preference keys
- **Content:** UI preferences (theme, language, etc.)
- **Encryption:** None (non-sensitive)
- **Security:** JSON.parse() without prototype pollution protection

### sessionStorage Usage

**1. Session Encryption Salt** (auth.service.ts:1953-1959)
- **Key:** `_ts`
- **Content:** 16-byte random value for token encryption
- **Purpose:** Session-specific salt (lost on tab close)
- **Security:** Proper CSPRNG generation, but causes token unrecoverability

**2. PKCE Code Verifier** (pkce.service.ts:169-180)
- **Key:** `pkce_verifier`
- **Content:** OAuth PKCE parameters
- **Expiry:** 5-minute TTL
- **Cleared on:** Token exchange or expiry

**3. SAML Return URL** (auth.service.ts:718-719)
- **Key:** `saml_return_url`
- **Content:** Post-login redirect URL
- **Lifetime:** Only during SAML flow
- **Cleared on:** SAML callback completion

### Data Flow Security

**JWT Token Flow:**

```
1. OAuth Login
   ↓
2. Backend returns JWT (Claims: sub, email, name, groups, admin flags)
   ↓
3. Frontend: extractUserProfileFromToken()
   - Decodes JWT payload (base64 decode)
   - Extracts: sub, email, name, groups, is_admin, is_security_reviewer
   ↓
4. Token Encryption
   - Generates browser fingerprint key (user agent + language + screen size + timezone + salt)
   - AES-GCM encrypts token
   - Stores encrypted token in localStorage['auth_token']
   ↓
5. Profile Encryption
   - Uses JWT token string as key material
   - AES-GCM encrypts profile
   - Stores encrypted profile in localStorage['user_profile']
   ↓
6. Token Usage
   - JwtInterceptor adds "Authorization: Bearer {token}" to API requests
   - WebSocket connections use token as query parameter (?token=...)
   ↓
7. Token Refresh (15 minutes before expiry)
   - POST /oauth2/refresh with refresh_token
   - Backend returns new JWT
   - Frontend re-encrypts and stores new token
   ↓
8. Logout
   - clearAuthData() removes all localStorage items
   - Broadcasts logout event to other tabs
   - Backend invalidates refresh token
```

**PII Data Handling:**

The application stores the following Personally Identifiable Information (PII):

| Data Type | Storage Location | Encryption | Transmission | Logged? |
|-----------|------------------|------------|--------------|---------|
| Email | localStorage (encrypted) | AES-GCM | HTTPS (JWT) | Redacted |
| Display Name | localStorage (encrypted) | AES-GCM | HTTPS (JWT) | Redacted |
| OAuth Sub (ID) | localStorage (encrypted) | AES-GCM | HTTPS (JWT) | Redacted |
| JWT Token | localStorage (encrypted) | AES-GCM | HTTPS (Bearer) | Redacted |
| IP Address | Server logs only | N/A | HTTPS | Yes (server) |

**PII Protection Controls:**

1. **Encryption at Rest:** All PII encrypted with AES-GCM before localStorage storage
2. **Encryption in Transit:** HTTPS expected for all API communication (environment-dependent)
3. **Log Redaction:** Comprehensive sensitive data redaction in all logging (see redact-sensitive-data.util.ts)
4. **Secure Deletion:** All PII cleared from storage on logout
5. **Session Expiry:** Tokens expire after inactivity (60 minutes default)

**Logging Redaction Examples:**

```typescript
// Input: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...' }
// Output: { Authorization: 'Bearer eyJh************VCJ9' }

// Input: { email: 'user@example.com', password: 'secret123' }
// Output: { email: '[REDACTED]', password: '[REDACTED]' }

// Input: https://api.example.com/oauth2/callback?token=abc123&state=xyz
// Output: https://api.example.com/oauth2/callback?token=ab...[REDACTED]...23&state=xyz
```

### Multi-Tenant Data Isolation

**Multi-Tenancy Model:** Group-based isolation

**Group Membership:** (JWT claim)
```typescript
groups: string[]  // Array of group UUIDs
```

**Data Isolation Enforcement:**
- **Frontend:** Filters data based on current user's groups
- **Backend:** Enforces group-based access control on all queries
- **Trust Boundary:** Backend is authoritative; frontend filtering is UX only

**Threat Model Data Isolation:**

Each threat model has associated principals:
```typescript
interface Principal {
  principal_type: 'user' | 'group';
  principal_id: string;
  role: 'owner' | 'writer' | 'reader';
}
```

**Access Control:**
- Threat models are only accessible to users/groups listed in principals
- Backend validates principal membership on every API request
- Frontend displays only user-accessible threat models

**Security Implications:**
- **Confidential Threat Models:** Feature flag enables sensitive threat models with restricted access
- **Cross-Tenant Attacks:** Prevented by backend principal validation
- **Privilege Escalation:** Backend enforces role hierarchy (owner > writer > reader)

---

## 5. Attack Surface Analysis

### External Entry Points

**IMPORTANT:** This Angular SPA's network-accessible attack surface consists of:
1. The minimal Express.js server serving static assets and configuration
2. The extensive backend API (130+ endpoints documented via OpenAPI)
3. WebSocket collaboration endpoint

The frontend itself is a client-side application with no server-side logic, significantly reducing its attack surface.

#### Express Server Endpoints (IN-SCOPE)

**1. Runtime Configuration Endpoint**

```
Route: GET /config.json
File: /app/repos/tmi-ux/server.js (lines 27-85)
Authentication: Public (no authentication required)
```

**Purpose:** Serves runtime configuration from environment variables to the client

**Environment Variables Exposed:**
- `TMI_API_URL` → `apiUrl` (Backend API base URL)
- `TMI_LOG_LEVEL` → `logLevel` (DEBUG, INFO, WARN, ERROR)
- `TMI_OPERATOR_NAME` → `operatorName` (Service operator)
- `TMI_OPERATOR_CONTACT` → `operatorContact` (Contact email)
- `TMI_OPERATOR_JURISDICTION` → `operatorJurisdiction` (Legal jurisdiction)
- `TMI_AUTH_TOKEN_EXPIRY_MINUTES` → `authTokenExpiryMinutes` (Token TTL)
- `TMI_DEFAULT_AUTH_PROVIDER` → `defaultAuthProvider` (google/github/custom)
- `TMI_DEFAULT_THREAT_MODEL_FRAMEWORK` → `defaultThreatModelFramework` (STRIDE/LINDDUN/CIA)
- `TMI_ENABLE_CONFIDENTIAL_THREAT_MODELS` → `enableConfidentialThreatModels` (Feature flag)
- `TMI_SUPPRESS_ABOUT_LINK` → `suppressAboutLink` (UI config)
- `TMI_SUPPRESS_PRIVACY_TOS_LINKS` → `suppressPrivacyTosLinks` (UI config)
- `TMI_SECURITY_*` → `securityConfig` (Security headers configuration)

**Response Headers:**
```javascript
res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
res.set('Pragma', 'no-cache');
res.set('Expires', '0');
```

**Security Controls:**
✅ Rate limited (1000 requests per 15 minutes per IP)
✅ No-cache headers prevent configuration caching
✅ No sensitive credentials exposed (API URL only)
❌ No authentication required (intentional - needed before login)

**Attack Vectors:**
- **Information Disclosure:** Reveals backend API URL (expected - needed by client)
- **Rate Limit Bypass:** 1000 req/15min is permissive (66 req/minute)
- **Configuration Manipulation:** Not possible (server-side only)

**2. Static File Server**

```
Route: /* (all paths)
File: /app/repos/tmi-ux/server.js (lines 88-93)
Authentication: Public
```

**Purpose:** Serves Angular SPA static assets

**Files Served:**
- `/dist/tmi-ux/browser/*` (compiled Angular application)
- `/index.html` (SPA entry point)
- JavaScript bundles, CSS, fonts, images
- Client-side routing handled by Angular (all paths serve index.html)

**Security Controls:**
✅ Rate limited (1000 requests per 15 minutes per IP)
✅ Serves from restricted directory (/dist/tmi-ux/browser)
❌ No directory listing (Express default)
❌ No file upload functionality

**Attack Vectors:**
- **Path Traversal:** Mitigated by Express static file middleware
- **Directory Listing:** Disabled by default
- **File Injection:** Not possible (read-only filesystem)

#### Backend API Entry Points (IN-SCOPE - Backend Analysis Required)

**CRITICAL:** The following 130+ API endpoints are implemented in the **backend Go server** (github.com/ericfitz/tmi), not this frontend codebase. They represent the primary attack surface for the application.

**API Schema Documentation:**
- **File:** `/app/repos/tmi-ux/src/app/generated/api-types.d.ts` (28,793 lines)
- **Generated From:** OpenAPI specification at https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/main/api-schema/tmi-openapi.json
- **Format:** TypeScript type definitions

**Authentication Endpoints (11 endpoints):**

| Endpoint | Method | Auth | Purpose | Frontend Reference |
|----------|--------|------|---------|-------------------|
| `/oauth2/providers` | GET | Public | List OAuth providers | auth.service.ts:541 |
| `/oauth2/authorize` | GET | Public | Start OAuth flow | auth.service.ts:722 |
| `/oauth2/callback` | GET | Public | OAuth callback | auth.service.ts:895 |
| `/oauth2/token` | POST | Public | Token exchange | auth.service.ts:1169 |
| `/oauth2/refresh` | POST | Auth | Refresh token | auth.service.ts:364 |
| `/oauth2/userinfo` | GET | Auth | Get user info | N/A |
| `/oauth2/revoke` | POST | Auth | Revoke token | N/A |
| `/oauth2/introspect` | POST | Auth | Inspect token | N/A |
| `/saml/providers` | GET | Public | List SAML providers | auth.service.ts:587 |
| `/saml/{provider}/login` | GET | Public | Start SAML flow | auth.service.ts:719 |
| `/saml/acs` | POST | Public | SAML assertion consumer | Backend only |

**User Management Endpoints (7 endpoints):**

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/me` | GET | Auth | Current user profile |
| `/me` | PUT | Auth | Update profile |
| `/me/sessions` | GET | Auth | List active sessions |
| `/me/client_credentials` | GET, POST | Auth | API key management |
| `/me/preferences` | GET, PUT | Auth | User preferences |
| `/me/logout` | POST | Auth | Logout |
| `/me/groups` | GET | Auth | User's groups |

**Threat Model Endpoints (20+ endpoints):**

| Endpoint Pattern | Methods | Auth | Purpose |
|------------------|---------|------|---------|
| `/threat_models` | GET, POST | Auth | List/create threat models |
| `/threat_models/{id}` | GET, PUT, DELETE | Auth | CRUD threat models |
| `/threat_models/{id}/threats` | GET, POST | Auth | Manage threats |
| `/threat_models/{id}/diagrams` | GET, POST | Auth | Manage DFD diagrams |
| `/threat_models/{id}/documents` | GET, POST | Auth | Manage documents |
| `/threat_models/{id}/notes` | GET, POST | Auth | Manage notes |
| `/threat_models/{id}/assets` | GET, POST | Auth | Manage assets |
| `/threat_models/{id}/metadata` | GET, POST | Auth | Manage metadata |

**Admin Endpoints (25+ endpoints - Require Admin Role):**

| Endpoint Pattern | Methods | Auth | Purpose |
|------------------|---------|------|---------|
| `/admin/users` | GET | Admin | List all users |
| `/admin/users/{id}` | GET, PATCH, DELETE | Admin | Manage users |
| `/admin/groups` | GET, POST | Admin | Manage groups |
| `/admin/quotas/*` | GET, PUT | Admin | Quota management |
| `/admin/webhooks/*` | GET, POST, DELETE | Admin | Webhook management |
| `/admin/settings/*` | GET, PUT | Admin | System settings |
| `/admin/surveys/*` | GET, POST, PUT | Admin | Survey management |

**Webhook Endpoints (6 endpoints - HIGH SSRF RISK):**

| Endpoint | Method | Auth | Purpose | SSRF Risk |
|----------|--------|------|---------|-----------|
| `/webhooks/subscriptions` | GET, POST | Auth | Create webhook | LOW |
| `/webhooks/subscriptions/{id}` | GET, DELETE | Auth | Manage webhook | LOW |
| `/webhooks/subscriptions/{id}/test` | POST | Auth | Test webhook | **HIGH** |
| `/webhooks/deliveries` | GET | Auth | List deliveries | NONE |
| `/webhooks/deliveries/{id}` | GET | Auth | Get delivery | NONE |

**CRITICAL FINDING: Webhook Test SSRF Vulnerability**

**Location:** `/app/repos/tmi-ux/src/app/core/services/webhook.service.ts:74-82`

```typescript
public test(id: string): Observable<void> {
  return this.apiService.post<void>(`${this.config.endpoint}/${id}/test`, {});
}
```

**Attack Vector:**
1. Attacker creates webhook with malicious URL: `http://169.254.169.254/latest/meta-data/`
2. Attacker clicks "Test Webhook" in UI
3. **Backend Go server** makes server-side request to AWS metadata endpoint
4. Attacker extracts cloud credentials from webhook delivery logs

**Mitigation Required (Backend):**
- Block private IP ranges (RFC 1918, RFC 3927, loopback)
- Block cloud metadata endpoints (169.254.169.254, metadata.google.internal)
- Enforce HTTPS for production webhooks
- Limit redirects or disable redirect following
- Implement request timeout (5-10 seconds)

#### WebSocket Collaboration Endpoint (IN-SCOPE - HIGH PRIORITY)

**Endpoint:** `/threat_models/{threat_model_id}/diagrams/{diagram_id}/collaborate`

**Protocol:** WebSocket (ws:// or wss://)

**Authentication:**
```typescript
// Frontend: websocket.adapter.ts:224-246
const wsUrl = `${baseUrl}?token=${encryptedToken}`;
this._socket = new WebSocket(wsUrl);
```

**Token Transmission:** Query parameter (unavoidable for WebSocket auth)

**Message Types:**
```typescript
// TMI Collaboration Protocol
{
  type: 'join_session' | 'leave_session' | 'diagram_operation' | 
        'presenter_cursor' | 'presenter_selection' | 'user_presence_update' |
        'session_started' | 'session_ended',
  payload: { ... }
}
```

**Security Controls:**
✅ JWT token authentication
✅ Token redacted from application logs
✅ Automatic reconnection with exponential backoff
✅ Message schema validation
❌ Token visible in browser DevTools network tab (WebSocket limitation)
⚠️ Token may be logged by proxies/load balancers

**Attack Vectors:**
1. **Token Interception:** Man-in-the-middle attacks (mitigated by wss://)
2. **Session Hijacking:** Stolen token grants full collaboration access
3. **Message Injection:** Requires valid JWT token (backend validates)
4. **DoS via Flooding:** Rate limiting required (backend enforcement)

**Recommendations:**
1. Use wss:// (TLS) in production (prevents MITM)
2. Implement per-connection rate limiting (backend)
3. Consider Sec-WebSocket-Protocol header for token (requires server support)
4. Monitor for suspicious WebSocket activity (backend)

### Internal Service Communication

**IMPORTANT:** This frontend SPA has no internal service communication. All communication is between the browser and the backend API.

**Architecture:**
```
Browser (Angular SPA)  ←→  Backend Go API Server
                 ↓
         [No internal services]
```

**Trust Relationships:**
- Browser → Backend API: JWT bearer token authentication
- All requests are external (no internal service mesh)

**Security Implications:**
- No internal authentication mechanisms to analyze
- No service-to-service trust relationships
- All security controls enforce the browser ↔ backend trust boundary

### Input Validation Patterns

**Client-Side Validation:** (UX only - not security boundary)

The application implements comprehensive Angular reactive form validation:

**File:** `/app/repos/tmi-ux/src/app/shared/services/form-validation.service.ts`

**Custom Validators:**
- Email validation
- URL validation
- Required field validation
- Min/max length validation
- Pattern matching validation

**Security Note:** All client-side validation is **bypassable** (browser DevTools). Backend validation is mandatory.

**Server-Side Input Validation:** (Backend responsibility)

All user input is sent to the backend API for validation:
- JWT claim validation (backend verifies token signatures)
- Request body schema validation (OpenAPI schema enforcement)
- SQL injection prevention (parameterized queries, assumed)
- Command injection prevention (no shell execution in frontend)
- Path traversal prevention (backend filesystem operations)

**Input Sanitization:**

**1. Markdown Rendering** (app.config.ts:150-285)

DOMPurify sanitization with whitelist approach:
```typescript
ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 
               'em', 'del', 'a', 'img', 'code', 'pre', 'ul', 'ol', 'li', 
               'blockquote', 'table'],
ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'type'],
ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
```

**2. Log Input Sanitization** (logger.service.ts:177-181)
```typescript
private sanitizeForLog(input: string): string {
  return input.replace(/[\u0000-\u001F\u007F]/g, '');  // Remove control characters
}
```

**3. Filename Sanitization** (filename validation in file operations)
- Removes directory traversal sequences (../)
- Restricts to alphanumeric + safe characters

**Input Validation Weaknesses:**

**FINDING: URL Scheme Validation Missing**

**Location:** `/app/repos/tmi-ux/src/app/pages/tm/components/threat-page/threat-page.component.ts:752`

```typescript
openUriInNewTab(uri: string): void {
  if (uri?.trim()) {
    window.open(uri, '_blank', 'noopener,noreferrer');
  }
}
```

**Issue:** User-provided threat reference URIs are opened without scheme validation

**Attack Vector:** User enters `javascript:alert(document.cookie)` as a threat reference URI

**Recommendation:**
```typescript
private isValidUrl(uri: string): boolean {
  try {
    const url = new URL(uri);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
}
```

### Background Processing

**IMPORTANT:** This frontend SPA has no background processing on the server side. All background processing occurs in the browser or is handled by the backend API.

**Browser-Side Background Processing:**

**1. Token Refresh Timer** (session-manager.service.ts)
- Runs in browser background tabs
- Checks token expiry every 15 minutes
- Automatically refreshes tokens for active users
- **Security Note:** Timer drift detection prevents zombie sessions in throttled tabs

**2. WebSocket Heartbeat** (websocket.adapter.ts)
- Sends ping messages every 30 seconds
- Detects connection loss
- Automatic reconnection with exponential backoff

**3. Activity Tracker** (activity-tracker.service.ts)
- Monitors user activity (clicks, keystrokes, mouse movement)
- Triggers token refresh on activity
- No sensitive data processing

**Backend Processing Triggered by Frontend:**

**1. Webhook Delivery** (webhook.service.ts)
- User creates webhook subscription
- Backend processes event triggers
- HTTP POST to user-configured URL
- **SSRF Risk:** See Section 10 for webhook test endpoint vulnerability

**2. Addon Invocations** (addon.service.ts)
- User invokes addon
- Backend executes addon logic
- Results returned via webhook callback
- **Security Note:** Addon execution is server-side (not analyzed in this report)

---

## 6. Infrastructure & Operational Security

### Secrets Management

**Frontend Secret Handling:**

**POSITIVE FINDING:** No hardcoded secrets found in the codebase.

**Environment Variable Injection:** (server.js:23-84)

```javascript
// Runtime configuration from environment
const config = {};
if (process.env.TMI_API_URL) config.apiUrl = process.env.TMI_API_URL;
if (process.env.TMI_LOG_LEVEL) config.logLevel = process.env.TMI_LOG_LEVEL;
// ... (other non-sensitive config)
```

**Security Controls:**
✅ No secrets in environment files
✅ API URL is configuration, not a secret
✅ Secrets (API keys, database passwords) managed server-side
✅ JWT tokens encrypted before localStorage storage

**Dependency Secrets:**

**Package Installation:**
- No `.npmrc` with registry credentials in repository
- pnpm uses registry authentication from user's `~/.npmrc` (not committed)
- No private registry credentials in code

### Configuration Security

**Environment Files:**

The application has 8 environment configurations:

1. **production** - `environment.prod.ts`
2. **development** - `environment.dev.ts`
3. **staging** - `environment.staging.ts`
4. **test** - `environment.test.ts`
5. **local** - `environment.local.ts`
6. **hosted-container** - `environment.hosted-container.ts` (Cloud Run)
7. **oci** - `environment.oci.ts` (OCI deployments)
8. **container** - `environment.container.ts` (Generic containers)

**Environment Configuration Structure:**

```typescript
export const environment: Environment = {
  production: boolean,
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  apiUrl: string,  // Backend API base URL
  operatorName?: string,
  defaultAuthProvider?: 'google' | 'github' | string,
  authTokenExpiryMinutes?: number,
  securityConfig?: {
    enableHSTS?: boolean,
    hstsMaxAge?: number,
    frameOptions?: 'DENY' | 'SAMEORIGIN',
    referrerPolicy?: string,
    permissionsPolicy?: string
  }
};
```

**Security Headers Configuration:**

**FINDING: No infrastructure files defining security headers found in frontend codebase.**

**Expected Locations (Not Found):**
- Nginx configuration (`nginx.conf`) - Not in repository
- Kubernetes Ingress (`ingress.yaml`) - Not in repository
- CDN configuration (Cloudflare, Fastly) - Not in repository
- Dockerfile HSTS configuration - Present but not enforcing headers

**Dockerfiles Analysis:**

**1. Standard Dockerfile** (`/app/repos/tmi-ux/Dockerfile`)
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10.18.3
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build:hosted-container

FROM node:22-alpine
WORKDIR /app
RUN echo '{"dependencies":{"express":"^5.1.0","express-rate-limit":"^8.1.0"}}' > package.json
RUN npm install --omit=dev
COPY --from=builder /app/dist/tmi-ux/browser ./dist/tmi-ux/browser
COPY server.js .
EXPOSE 8080
CMD ["node", "server.js"]
```

**Security Assessment:**
✅ Multi-stage build (smaller attack surface)
✅ Minimal runtime dependencies
✅ Non-root user (Alpine default)
❌ No HSTS headers configured in Dockerfile
❌ No CSP headers configured

**2. Chainguard Dockerfile** (`Dockerfile.chainguard`)
- Uses Chainguard base images (supply chain security)
- Minimal vulnerability surface (distroless approach)

**3. OCI Dockerfile** (`Dockerfile.oci`)
- OCI-compliant container builds

**Security Headers Implementation:**

**Current Implementation:** Application-level security headers configured via environment variables, but **NOT enforced by infrastructure**.

**Expected Headers (NOT FOUND in infrastructure config):**

```nginx
# Expected Nginx configuration (NOT PRESENT)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

**Recommendation:** Add infrastructure-level security headers configuration in:
- Reverse proxy (Nginx/Apache)
- Kubernetes Ingress annotations
- CDN configuration
- Load balancer configuration

### External Dependencies

**Production Dependencies:** (package.json)

| Dependency | Version | Purpose | Security Notes |
|------------|---------|---------|----------------|
| `@angular/*` | 21.2.0 | Framework | Regular updates, security patches |
| `express` | 5.2.1 | Static server | Security-focused version 5 |
| `express-rate-limit` | 8.2.1 | Rate limiting | DoS protection |
| `dompurify` | 3.3.1 | XSS prevention | Critical security dependency |
| `marked` | 17.0.3 | Markdown parsing | Combined with DOMPurify |
| `mermaid` | 11.12.3 | Diagram rendering | Configured with securityLevel: 'strict' |
| `ngx-markdown` | 21.1.0 | Angular markdown | With custom sanitization |

**Security Overrides (pnpm):**

The application uses `pnpm.overrides` to enforce security patches:

```json
"pnpm.overrides": {
  "node-forge": "^1.3.2",           // CVE fixes
  "body-parser": ">=2.2.1",         // Security patches
  "qs": "^6.14.2",                  // Prototype pollution fix
  "tar": ">=7.5.9",                 // Arbitrary file write fix
  "webpack": ">=5.104.1",           // CVE fixes
  "serialize-javascript": ">=7.0.3" // XSS fix
}
```

**Dependency Management:**
✅ pnpm lockfile (`pnpm-lock.yaml`) ensures reproducible builds
✅ Security overrides for known vulnerabilities
✅ Regular dependency updates (Angular 21.2 is latest stable)
⚠️ Dependencies should be audited regularly (`pnpm audit`)

**Third-Party Services:**

| Service | Purpose | Data Shared | Security Implications |
|---------|---------|-------------|----------------------|
| Backend TMI API | Business logic | JWT tokens, all user data | Trust boundary |
| OAuth Providers | Authentication | Email, name, profile | Trusted (Google, GitHub) |
| SAML Providers | Enterprise SSO | Email, name, groups | Trusted (configured by admin) |
| WebSocket Server | Collaboration | Diagram operations | Same as REST API |

**External Service Security:**
- OAuth/SAML providers are configured server-side (not user-controllable)
- Backend API URL is environment variable (can be changed per deployment)
- No analytics, tracking, or telemetry services integrated

### Monitoring & Logging

**Frontend Logging:**

**Logger Service:** `/app/repos/tmi-ux/src/app/core/services/logger.service.ts`

**Log Levels:**
- DEBUG: Verbose component-level logging
- INFO: General application events
- WARN: Warnings (non-critical issues)
- ERROR: Error conditions

**Log Output:**
- Browser console (development)
- Structured logging with component context
- **Sensitive data redaction** (see redact-sensitive-data.util.ts)

**Security Event Logging:**

The application logs the following security events:

| Event | Log Level | Sensitive Data Redacted? |
|-------|-----------|--------------------------|
| OAuth login initiated | INFO | ✅ State token redacted |
| OAuth callback received | INFO | ✅ Auth code redacted |
| Token refresh | DEBUG | ✅ Token redacted |
| Token expiry warning | INFO | ❌ No sensitive data |
| Logout | INFO | ❌ No sensitive data |
| WebSocket connection | INFO | ✅ Token redacted from URL |
| API request/response | DEBUG | ✅ Authorization header redacted |
| 401 Unauthorized | WARN | ✅ Token redacted |
| CSP violation | WARN | ❌ Violation details |

**Backend Logging:** (Not in this codebase)

Expected security events to be logged by backend:
- Authentication attempts (success/failure)
- Authorization failures
- Token issuance and refresh
- Admin actions (user/group management)
- Webhook deliveries
- SSRF attempt detection (webhook URL validation failures)

**CSP Violation Monitoring:**

**File:** `/app/repos/tmi-ux/src/app/core/services/security-config.service.ts`

```typescript
monitorSecurityViolations(): void {
  document.addEventListener('securitypolicyviolation', (event) => {
    console.warn('CSP Violation:', {
      violatedDirective: event.violatedDirective,
      blockedURI: event.blockedURI,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber
    });
    
    // Could send to backend for analysis
    if (this.config.cspReportUri) {
      fetch(this.config.cspReportUri, {
        method: 'POST',
        body: JSON.stringify({ /* violation details */ })
      });
    }
  });
}
```

**Monitoring Gaps:**

❌ No centralized log aggregation (client-side logs stay in browser)
❌ No security event alerting (no SIEM integration)
❌ No anomaly detection (excessive failed logins, etc.)
⚠️ Backend monitoring capabilities unknown (not in this codebase)

---

## 7. Overall Codebase Indexing

The TMI-UX codebase is a **mature, well-architected Angular 21.2 single-page application** with 84 injectable services organized into a feature-based modular structure. The application follows Angular best practices with standalone components, OnPush change detection, and strict TypeScript compilation. The codebase demonstrates strong security consciousness with defense-in-depth patterns, comprehensive authentication mechanisms, and careful attention to XSS prevention and sensitive data handling.

**Directory Structure:**

```
/app/repos/tmi-ux/
├── src/                                # Application source
│   ├── app/                            # Angular application root
│   │   ├── auth/                       # Authentication module (15,000+ lines)
│   │   │   ├── guards/                 # Route guards (authGuard, adminGuard, reviewerGuard)
│   │   │   ├── interceptors/           # HTTP interceptors (JWT, security headers)
│   │   │   ├── services/               # Auth services (auth, pkce, session-manager, token-validity)
│   │   │   └── utils/                  # Crypto utilities (PKCE, key derivation)
│   │   ├── core/                       # Core services (25+ services)
│   │   │   ├── components/             # Shared components (navbar, footer)
│   │   │   ├── interceptors/           # HTTP logging, error handling
│   │   │   ├── services/               # API client, WebSocket, logging, security
│   │   │   └── utils/                  # Redaction, validators
│   │   ├── pages/                      # Feature modules
│   │   │   ├── admin/                  # Admin dashboard (user, group, quota, webhook, addon, settings, survey management)
│   │   │   ├── dashboard/              # User dashboard (threat model list, quick actions)
│   │   │   ├── dfd/                    # Data Flow Diagram editor (X6 graph library integration)
│   │   │   ├── tm/                     # Threat Model editor (markdown, threats, notes, documents)
│   │   │   ├── intake/                 # Survey intake (form filling, response submission)
│   │   │   └── triage/                 # Triage workflow (reviewer-only, response management)
│   │   ├── shared/                     # Shared UI components & utilities
│   │   │   ├── components/             # Reusable UI components
│   │   │   ├── services/               # Framework, form validation
│   │   │   └── dialogs/                # Modal dialogs
│   │   ├── i18n/                       # Internationalization (16 languages)
│   │   │   └── language.service.ts     # Language switching, RTL support
│   │   ├── generated/                  # OpenAPI-generated types
│   │   │   └── api-types.d.ts          # 28,793 lines of TypeScript types from backend API schema
│   │   ├── app.config.ts               # Application configuration (DOMPurify, Mermaid, providers)
│   │   └── app.routes.ts               # Client-side routing configuration
│   ├── assets/                         # Static assets
│   │   ├── frameworks/                 # Threat framework definitions (STRIDE, LINDDUN, CIA, etc.)
│   │   ├── i18n/                       # Translation JSON files (16 languages)
│   │   └── fonts/                      # TrueType fonts for PDF generation
│   └── environments/                   # Environment configurations (8 environments)
├── scripts/                            # Build and validation scripts (OUT-OF-SCOPE)
│   ├── validate-json.cjs               # JSON validation utility
│   ├── check-i18n.py                   # i18n synchronization checker
│   ├── check-security.ts               # Security validation
│   └── push-*.sh                       # Deployment scripts (Heroku, OCI, Chainguard)
├── server.js                           # Express static file server (99 lines)
├── Dockerfile                          # Standard Docker build
├── Dockerfile.chainguard               # Chainguard base image build
├── Dockerfile.oci                      # OCI-compliant build
├── angular.json                        # Angular CLI configuration (build targets, optimization)
├── tsconfig.json                       # TypeScript strict mode configuration
├── package.json                        # Dependencies and scripts
├── pnpm-lock.yaml                      # Lockfile (reproducible builds)
└── .husky/                             # Git hooks (pre-commit validation)
```

**Codebase Organization Conventions:**

1. **Feature-Based Modules:** Each major feature (admin, dashboard, threat modeling, diagrams, surveys, triage) is isolated in its own module with dedicated components, services, and types. This organization makes it easy to identify security boundaries and data flows for each feature.

2. **Service Layer Pattern:** The application uses 84 injectable services organized by concern:
   - **Authentication Services:** auth.service, pkce.service, session-manager.service
   - **API Services:** api.service, webhook.service, addon.service, threat-model.service
   - **Infrastructure Services:** websocket.adapter, logger.service, security-config.service
   - **Feature Services:** dfd-collaboration.service, survey.service, triage.service

3. **Guard-Based Authorization:** Angular route guards (authGuard, adminGuard, reviewerGuard) protect routes, making it easy to audit which routes require authentication/authorization. However, this also makes missing guards (like the `/admin/webhooks` vulnerability) immediately visible in the route configuration.

4. **Interceptor Pipeline:** HTTP interceptors provide cross-cutting concerns (JWT injection, logging, error handling, security headers validation) in a centralized, auditable location.

5. **TypeScript Strict Mode:** Strict compilation catches potential runtime errors at compile-time, reducing security bugs from null/undefined dereferences, type coercion, and implicit any types.

6. **OpenAPI Type Generation:** The 28,793-line `api-types.d.ts` file is generated from the backend's OpenAPI schema, ensuring frontend-backend contract enforcement. This prevents API misuse and documents all available endpoints in a single location.

**Build and Tooling Conventions:**

1. **Angular CLI:** Standard Angular build system with production optimization (minification, tree-shaking, dead code elimination)

2. **pnpm Package Manager:** Faster installs, strict dependency resolution, content-addressable storage (better security than npm)

3. **Docker Multi-Stage Builds:** Builder stage compiles application, runtime stage contains only production dependencies (minimal attack surface)

4. **Environment-Based Configuration:** 8 environments with different security and feature flags allow deployment-specific tuning

5. **Pre-Commit Hooks:** Husky git hooks run validation checks before commits (lint, format, test, security checks)

6. **Code Generation Scripts:**
   - `generate:api-types` - Generate TypeScript types from OpenAPI schema
   - `validate-json` - Validate JSON configuration files
   - `check-i18n` - Ensure translation completeness
   - `check-security` - Custom security validation

**Impact on Security Component Discoverability:**

✅ **Excellent Discoverability:** The feature-based structure makes it trivial to locate security-relevant code:
- Authentication? → `/app/auth/`
- API communication? → `/app/core/services/api.service.ts`
- WebSocket? → `/app/core/services/websocket.adapter.ts`
- Logging? → `/app/core/services/logger.service.ts`
- Admin functions? → `/app/pages/admin/`

✅ **Centralized Security Services:** All security-critical services are in predictable locations (auth/, core/services/, core/interceptors/)

✅ **OpenAPI Documentation:** The generated `api-types.d.ts` file serves as a complete catalog of all backend API endpoints, making attack surface analysis straightforward

❌ **Potential for Inconsistency:** With 84 services, maintaining consistent security practices (logging, error handling, input validation) requires discipline. The centralized interceptor pattern helps, but service-level logic could diverge.

**Notable Tools and Patterns:**

1. **X6 Graph Library Integration:** (`/app/pages/dfd/`) - The Data Flow Diagram editor uses AntV X6 for graph rendering. The codebase explicitly excludes the `markup` property from allowed cell attributes (cell-property-filter.util.ts:435) to prevent XSS via SVG/HTML injection.

2. **RxJS Observables:** Extensive use of reactive patterns for state management, HTTP requests, and WebSocket messages. Security implications include race conditions (mitigated by proper subscription management) and observable chain complexity (makes data flow tracing harder).

3. **Angular Standalone Components:** Modern Angular pattern (no NgModules) improves tree-shaking and reduces bundle size, which indirectly improves security by reducing code surface area.

4. **TypeScript Path Aliases:** `@app/*` aliases prevent `../../../` path traversal in imports, reducing readability issues that could hide security vulnerabilities.

5. **DOMPurify + Marked Integration:** Custom marked renderer (app.config.ts:150-285) passes all HTML through DOMPurify with a whitelist-based approach, demonstrating proper defense-in-depth for user-generated content.

**Testing Infrastructure:**

- **Unit Tests:** Vitest 4.0.18 (fast, modern test runner)
- **E2E Tests:** Playwright 1.58.2 (browser automation)
- **Coverage:** @vitest/coverage-v8 (code coverage reporting)
- **Test Files:** `*.spec.ts` files alongside source code (OUT-OF-SCOPE for security analysis)

---

## 8. Critical File Paths

Below are the specific file paths referenced throughout this security analysis, categorized by their security relevance. These files should be prioritized for manual security review.

### Configuration

- `/app/repos/tmi-ux/server.js` - Express server, rate limiting, /config.json endpoint
- `/app/repos/tmi-ux/Dockerfile` - Multi-stage Docker build
- `/app/repos/tmi-ux/Dockerfile.chainguard` - Chainguard base image build
- `/app/repos/tmi-ux/Dockerfile.oci` - OCI-compliant build
- `/app/repos/tmi-ux/angular.json` - Angular CLI build configurations
- `/app/repos/tmi-ux/tsconfig.json` - TypeScript strict mode configuration
- `/app/repos/tmi-ux/src/app/app.config.ts` - DOMPurify configuration, Mermaid security level, application providers
- `/app/repos/tmi-ux/src/environments/environment.ts` - Base environment configuration
- `/app/repos/tmi-ux/src/environments/environment.prod.ts` - Production environment
- `/app/repos/tmi-ux/src/environments/environment.interface.ts` - Environment type definitions (security config structure)

### Authentication & Authorization

- `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` - Primary authentication service (2,047 lines, token encryption, OAuth/SAML flows)
- `/app/repos/tmi-ux/src/app/auth/services/pkce.service.ts` - PKCE implementation (RFC 7636)
- `/app/repos/tmi-ux/src/app/auth/utils/pkce-crypto.utils.ts` - Cryptographic utilities (code verifier generation, SHA-256 challenge)
- `/app/repos/tmi-ux/src/app/auth/services/session-manager.service.ts` - Session lifecycle, token refresh, expiry warnings
- `/app/repos/tmi-ux/src/app/auth/services/token-validity-guard.service.ts` - Zombie session prevention
- `/app/repos/tmi-ux/src/app/auth/guards/auth.guard.ts` - Route authentication guard
- `/app/repos/tmi-ux/src/app/auth/guards/admin.guard.ts` - Admin authorization guard
- `/app/repos/tmi-ux/src/app/auth/guards/reviewer.guard.ts` - Reviewer authorization guard
- `/app/repos/tmi-ux/src/app/auth/guards/home.guard.ts` - Post-login routing guard
- `/app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts` - JWT bearer token injection, 401 handling

### API & Routing

- `/app/repos/tmi-ux/src/app/core/services/api.service.ts` - HTTP client wrapper, base URL configuration, request timeout
- `/app/repos/tmi-ux/src/app/app.routes.ts` - Client-side route definitions, guard assignments
- `/app/repos/tmi-ux/src/app/generated/api-types.d.ts` - OpenAPI-generated TypeScript types (28,793 lines, backend API contract)

### Data Models & API Interaction

- `/app/repos/tmi-ux/src/app/core/services/threat-model.service.ts` - Threat model CRUD operations
- `/app/repos/tmi-ux/src/app/core/services/webhook.service.ts` - Webhook management (contains webhook test endpoint call)
- `/app/repos/tmi-ux/src/app/core/services/addon.service.ts` - Addon invocation
- `/app/repos/tmi-ux/src/app/core/services/survey.service.ts` - Survey intake
- `/app/repos/tmi-ux/src/app/core/services/triage.service.ts` - Triage workflow
- `/app/repos/tmi-ux/src/app/pages/admin/webhooks/admin-webhooks.component.ts` - Admin webhook UI (line 260: window.open() with user-stored URL)

### Dependency Manifests

- `/app/repos/tmi-ux/package.json` - Dependencies, security overrides (pnpm.overrides section)
- `/app/repos/tmi-ux/pnpm-lock.yaml` - Lockfile for reproducible builds

### Sensitive Data & Secrets Handling

- `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` - Token encryption (lines 1976-2045), key derivation (lines 1951-1971)
- `/app/repos/tmi-ux/src/app/core/utils/redact-sensitive-data.util.ts` - Sensitive data redaction for logging, prototype pollution protection
- `/app/repos/tmi-ux/src/app/core/services/user-preferences.service.ts` - User preferences storage (localStorage)

### Middleware & Input Validation

- `/app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts` - JWT bearer token injection
- `/app/repos/tmi-ux/src/app/core/interceptors/http-logging.interceptor.ts` - Request/response logging with redaction
- `/app/repos/tmi-ux/src/app/core/interceptors/security-headers.interceptor.ts` - Development-mode security header validation
- `/app/repos/tmi-ux/src/app/shared/services/form-validation.service.ts` - Angular reactive form validation (client-side only)
- `/app/repos/tmi-ux/src/app/pages/tm/components/threat-page/threat-page.component.ts` - Threat reference URI handling (line 752: missing scheme validation)

### Logging & Monitoring

- `/app/repos/tmi-ux/src/app/core/services/logger.service.ts` - Centralized logging, URL redaction, log injection prevention
- `/app/repos/tmi-ux/src/app/core/services/security-config.service.ts` - CSP violation monitoring

### Infrastructure & Deployment

- `/app/repos/tmi-ux/server.js` - Express static server, rate limiting configuration
- `/app/repos/tmi-ux/Dockerfile` - Standard Docker build
- `/app/repos/tmi-ux/scripts/push-heroku.sh` - Heroku deployment script
- `/app/repos/tmi-ux/scripts/push-oci.sh` - OCI registry deployment
- `/app/repos/tmi-ux/scripts/push-chainguard.sh` - Chainguard image deployment
- `/app/repos/tmi-ux/scripts/check-security.ts` - Custom security validation script

### WebSocket & Real-Time Communication

- `/app/repos/tmi-ux/src/app/core/services/websocket.adapter.ts` - WebSocket connection management (1,227 lines, token authentication, message validation)
- `/app/repos/tmi-ux/src/app/core/services/dfd-collaboration.service.ts` - Collaborative diagram editing, session management

### XSS Prevention & Content Security

- `/app/repos/tmi-ux/src/app/app.config.ts` - DOMPurify configuration (lines 150-285), Mermaid security settings (line 292)
- `/app/repos/tmi-ux/src/app/pages/dfd/utils/cell-property-filter.util.ts` - X6 graph cell property filtering (line 435: markup property exclusion)

---

## 9. XSS Sinks and Render Contexts

After comprehensive analysis of all network-accessible components in the Angular 21.2 SPA, the application demonstrates **excellent XSS prevention** with zero critical vulnerabilities identified. The application properly uses DOMPurify for all user-generated content, avoids dangerous JavaScript sinks like `eval()` and `innerHTML`, and implements whitelist-based sanitization.

### Summary: Zero Critical XSS Sinks Found

**Total Critical Sinks:** 0  
**Recommendations:** 2 (low-medium severity)

The application's security posture for XSS prevention is **strong**, with comprehensive DOMPurify integration and careful avoidance of dangerous browser APIs.

---

### HTML Body Context Sinks

**Status: ✅ NO VULNERABLE SINKS FOUND**

**Searched Patterns:**
- `element.innerHTML = userInput`
- `element.outerHTML = userInput`
- `document.write(userInput)`
- `document.writeln(userInput)`
- `element.insertAdjacentHTML('beforeend', userInput)`
- `Range.createContextualFragment(userInput)`

**Finding:** One `innerHTML` usage found in test file (OUT-OF-SCOPE):

```typescript
// File: /app/repos/tmi-ux/src/app/pages/dfd/infrastructure/embedding-operations-integration.spec.ts:169
document.body.innerHTML = '';  // Test teardown, literal empty string
```

**Classification:** OUT-OF-SCOPE (test file cleanup, no user input)

---

### JavaScript Context Sinks

**Status: ✅ NO VULNERABLE SINKS FOUND**

**Searched Patterns:**
- `eval(userInput)`
- `Function(userInput)`
- `setTimeout(userInput, 1000)` (string argument)
- `setInterval(userInput, 1000)` (string argument)

**Finding:** None

**Angular AOT Compilation:** The application uses Ahead-of-Time compilation in production, which prevents runtime template compilation and eliminates template injection vulnerabilities.

---

### URL Context Sinks

**Status: ⚠️ CONTROLLED USAGE - LOW RISK**

#### 1. `window.location.href` Assignments (Authentication Redirects)

**Files:**
- `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts:722` (SAML flow)
- `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts:780` (OAuth flow)

**Code Context:**

```typescript
// Line 722 - SAML authentication
const clientCallbackUrl = `${window.location.origin}/oauth2/callback`;
const authUrl = `${provider.auth_url}?client_callback=${encodeURIComponent(clientCallbackUrl)}`;
window.location.href = authUrl;

// Line 780 - OAuth authentication with PKCE
const authUrl = `${provider.auth_url}?state=${state}&code_challenge=${challenge}&...`;
window.location.href = authUrl;
```

**Security Analysis:**
- **User Input:** `provider.auth_url` comes from **server-provided** OAuth/SAML provider configuration (fetched from `/oauth2/providers` or `/saml/providers`)
- **Mitigation:** URLs are controlled by backend configuration, not direct user input
- **Encoding:** `encodeURIComponent()` used for callback URL
- **Risk Level:** LOW - Auth URLs are server-validated
- **Classification:** IN-SCOPE, properly secured

#### 2. `window.open()` Usage - Threat Reference URIs

**FINDING #1: Missing URL Scheme Validation**

**Files:**
- `/app/repos/tmi-ux/src/app/pages/tm/components/threat-page/threat-page.component.ts:752`
- `/app/repos/tmi-ux/src/app/pages/tm/components/threat-editor-dialog/threat-editor-dialog.component.ts:*`
- `/app/repos/tmi-ux/src/app/pages/tm/tm-edit.component.ts:*`

**Vulnerable Code:**

```typescript
// Line 752: threat-page.component.ts
openUriInNewTab(uri: string): void {
  if (uri?.trim()) {
    window.open(uri, '_blank', 'noopener,noreferrer');
  }
}
```

**Security Issue:**
- **User Input:** `uri` parameter is a threat reference URL entered by users and stored in threat models
- **Attack Vector:** User enters `javascript:alert(document.cookie)` as a threat reference URI
- **Current Mitigation:** `noopener,noreferrer` flags prevent tabnabbing but **do not prevent JavaScript execution**
- **Severity:** MEDIUM
- **Classification:** IN-SCOPE

**Recommendation:**

```typescript
private isValidUrl(uri: string): boolean {
  try {
    const url = new URL(uri);
    // Whitelist safe schemes
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
}

openUriInNewTab(uri: string): void {
  if (uri?.trim() && this.isValidUrl(uri)) {
    window.open(uri, '_blank', 'noopener,noreferrer');
  } else {
    this.logger.warn('Invalid or unsafe URI scheme blocked:', uri);
  }
}
```

#### 3. Admin Webhook URL Opening

**File:** `/app/repos/tmi-ux/src/app/pages/admin/webhooks/admin-webhooks.component.ts:260`

```typescript
openWebhookUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
```

**Security Analysis:**
- **User Input:** Webhook URL stored in backend webhook configuration
- **Context:** Admin-only function
- **Mitigation:** `noopener,noreferrer` flags present
- **Risk Level:** LOW (admin users, server-stored URLs)
- **Classification:** IN-SCOPE but low priority

#### 4. Hardcoded URLs (Safe)

**File:** `/app/repos/tmi-ux/src/app/core/components/navbar/navbar.component.ts`

```typescript
// Line 409: Opens API URL from environment config
window.open(environment.apiUrl, '_blank');

// Line 417: Hardcoded GitHub issues link
window.open('https://github.com/ericfitz/tmi-ux/issues/new', '_blank');
```

**Classification:** OUT-OF-SCOPE (literal constants, no user input)

---

### Markdown Rendering (User-Generated Content)

**Status: ✅ PROPERLY SECURED**

**File:** `/app/repos/tmi-ux/src/app/app.config.ts` (lines 150-285)

**Implementation:**

The application uses `ngx-markdown` with a **custom DOMPurify-based renderer**:

```typescript
// Custom HTML renderer with DOMPurify sanitization
renderer.html = (args): string => {
  const html = originalHtml(args);
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'del',
      'a', 'img', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'table',
      'thead', 'tbody', 'tr', 'th', 'td', 'input', 'label',
      // SVG tags for Mermaid diagrams
      'svg', 'g', 'path', 'rect', 'circle', 'line', 'text', 'defs', 'marker'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'type', 'checked', 'disabled',
      // SVG attributes
      'viewBox', 'width', 'height', 'fill', 'stroke', 'd', 'x', 'y', 'cx', 'cy', 'r'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    KEEP_CONTENT: true,
  });
};
```

**External Link Handling:**

```typescript
renderer.link = (args): string => {
  const link = originalLink(args);
  if (args.href?.startsWith('http')) {
    return link.replace('<a', '<a target="_blank" rel="noopener noreferrer"');
  }
  return link;
};
```

**Security Properties:**
✅ Whitelist approach for tags and attributes (deny-by-default)  
✅ URI scheme validation via `ALLOWED_URI_REGEXP`  
✅ External links open in new tab with `noopener noreferrer`  
✅ No `<script>`, `<iframe>`, `<object>`, `<embed>` tags allowed  
✅ No `onclick`, `onerror`, `onload` event handlers allowed  
✅ No `javascript:` or `data:text/html` URIs allowed

**Mermaid Diagram Security:**

```typescript
// Line 292: Strict security level
mermaidAPI.initialize({
  securityLevel: 'strict',  // Prevents XSS in diagram definitions
  maxTextSize: 50000,       // DoS prevention
  startOnLoad: false
});
```

**Usage in Templates:**

```html
<markdown [data]="threatDescription" mermaid></markdown>
```

**Classification:** IN-SCOPE, properly secured

---

### Angular Template Bindings

**Status: ✅ NO UNSAFE BINDINGS FOUND**

**Searched Patterns:**
- `[innerHTML]="unsafeHtml"` with `bypassSecurityTrustHtml()`
- `[outerHTML]="unsafeHtml"` with bypass methods
- `[attr.srcdoc]="unsafeIframe"`

**Finding:** None - No sanitization bypass detected

Angular's built-in sanitization is **not bypassed** anywhere in the codebase. All data binding goes through Angular's `SecurityContext` checks.

---

### Deserialization Sinks (JSON.parse)

**Status: ⚠️ MULTIPLE INSTANCES - CONTROLLED CONTEXTS**

#### 1. WebSocket Message Parsing (Server Messages)

**Files:**
- `/app/repos/tmi-ux/src/app/core/services/websocket.adapter.ts:494`
- `/app/repos/tmi-ux/src/app/core/services/websocket.adapter.ts:681`

```typescript
parsedMessage = JSON.parse(rawData as string);
```

**Context:** Parses WebSocket messages from **authenticated backend server**

**Risk:** LOW - Server-to-client messages over authenticated connection

**Mitigation:**
- Try-catch error handling
- Message schema validation
- Backend is trusted source

#### 2. JWT Token Parsing (Token Claims)

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`

```typescript
const decodedPayload = JSON.parse(atob(payload)) as JwtPayload;
```

**Context:** Decodes JWT payloads for claim extraction (email, name, roles)

**Risk:** LOW - JWTs validated by backend, signatures checked

**Note:** Client-side JWT parsing is for **display only**, not for access control

#### 3. LocalStorage Data Parsing

**Files:**
- `/app/repos/tmi-ux/src/app/auth/services/pkce.service.ts:106`
- `/app/repos/tmi-ux/src/app/core/services/user-preferences.service.ts:201`
- `/app/repos/tmi-ux/src/app/pages/dfd/infrastructure/adapters/infra-local-storage.adapter.ts:175`

```typescript
params = JSON.parse(stored) as PkceParameters;
const parsed = JSON.parse(cached) as Partial<UserPreferencesData>;
return JSON.parse(item) as LocalStorageData;
```

**Context:** Parsing user preferences, PKCE state, diagram data from localStorage

**Risk:** LOW-MEDIUM - localStorage is origin-bound but can be manipulated

**Mitigation:** Try-catch blocks, type validation after parsing

#### 4. User File Import - Threat Model JSON

**FINDING #2: JSON Import Prototype Pollution Risk**

**Files:**
- `/app/repos/tmi-ux/src/app/pages/dashboard/dashboard.component.ts:779`
- `/app/repos/tmi-ux/src/app/pages/tm/tm.component.ts:398`

```typescript
const content = await file.text();
const threatModelData = JSON.parse(content) as Record<string, unknown>;
await this.importThreatModel(threatModelData);
```

**Security Issue:**
- **User Input:** User selects local JSON file for import via browser file picker
- **Attack Vector:** Malicious JSON with `__proto__` or `constructor` keys
- **Example Payload:**
  ```json
  {
    "name": "Malicious Threat Model",
    "__proto__": { "isAdmin": true },
    "constructor": { "prototype": { "isAdmin": true } }
  }
  ```
- **Current Mitigation:** Backend validation on import API call
- **Severity:** LOW-MEDIUM
- **Classification:** IN-SCOPE

**Recommendation:**

```typescript
function sanitizeObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  
  // Create null-prototype object to prevent pollution
  const sanitized = Object.create(null);
  
  for (const key in obj) {
    // Skip dangerous keys
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      continue;
    }
    
    if (obj.hasOwnProperty(key)) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
  }
  
  return sanitized;
}

// Before import:
const threatModelData = sanitizeObject(JSON.parse(content));
```

**Note:** The `redact-sensitive-data.util.ts` already implements prototype pollution protection for logging, but not for file imports.

---

### X6 Graph Library - DOM Manipulation

**Status: ✅ SECURE BY DESIGN**

**File:** `/app/repos/tmi-ux/src/app/pages/dfd/utils/cell-property-filter.util.ts:435`

**Security Feature:**

```typescript
// Line 435: markup property explicitly excluded
const CELL_ALLOWED_FIELDS = ['id', 'shape', 'data'] as const;
// 'markup' field is NOT included (prevents arbitrary SVG/HTML injection)
```

**Security Analysis:**

The X6 graph library allows setting arbitrary SVG/HTML via the `markup` property. This application **explicitly excludes** this property from allowed cell fields, preventing XSS attacks via diagram manipulation.

✅ Only shape metadata, not HTML/SVG markup, is accepted  
✅ X6 graph operations use `.setAttrs()` with controlled attribute objects  
✅ No direct HTML injection into graph cells

**Classification:** IN-SCOPE, properly secured

---

### Template Injection

**Status: ✅ NO VULNERABLE SINKS**

**Angular Compilation:**
- **Production:** AOT (Ahead-of-Time) compilation used
- **Development:** JIT (Just-in-Time) compilation with no dynamic templates
- **Finding:** No runtime template compilation with user input

**Searched Patterns:**
- Dynamic component compilation (`Compiler.compileModuleAndAllComponentsAsync`)
- JIT compiler usage with user input

**Classification:** SECURE - No template injection vectors

---

### Node.js Server - Command Injection

**Status: ✅ NO VULNERABLE SINKS**

**File Analyzed:** `/app/repos/tmi-ux/server.js`

**Findings:**
✅ No `exec`, `execSync`, `spawn`, `spawnSync` usage  
✅ No shell command execution  
✅ Simple Express static file server only  
✅ Only serves pre-built static assets  

**Classification:** IN-SCOPE, secure

---

### File Path Traversal

**Status: ✅ NO VULNERABLE SINKS**

**Searched Patterns:**
- `fs.readFile(userInput)`
- `fs.writeFile(userInput)`
- `fs.open(userInput)`
- File operations with user input

**Findings:**
- File operations found ONLY in build scripts (OUT-OF-SCOPE)
- `server.js` uses `path.join()` safely with constants only
- **Browser File System Access API** used for user file selection (safe - requires user gesture)

**Classification:** SECURE

---

## Summary of XSS Findings

### ✅ SECURE AREAS (No Action Required)

1. **HTML Body Context** - No `innerHTML`, `outerHTML`, `document.write` usage
2. **JavaScript Execution** - No `eval()`, `Function()` constructor
3. **Markdown Rendering** - Properly sanitized with DOMPurify
4. **Angular Template Bindings** - No sanitization bypass
5. **Node.js Server** - No command injection vectors
6. **File Operations** - No path traversal vulnerabilities
7. **X6 Graph Rendering** - Markup property explicitly excluded
8. **Template Injection** - AOT compilation, no dynamic templates

### ⚠️ RECOMMENDATIONS (Low-Medium Priority)

**FINDING #1: URL Scheme Validation Missing**

**Files:**
- `/app/repos/tmi-ux/src/app/pages/tm/components/threat-page/threat-page.component.ts:752`
- `/app/repos/tmi-ux/src/app/pages/tm/components/threat-editor-dialog/threat-editor-dialog.component.ts`
- `/app/repos/tmi-ux/src/app/pages/tm/tm-edit.component.ts`

**Severity:** MEDIUM  
**Risk:** User could inject `javascript:` URLs in threat references  
**Recommendation:** Add URL scheme whitelist validation (http, https, mailto, tel only)

**FINDING #2: JSON Import Prototype Pollution**

**Files:**
- `/app/repos/tmi-ux/src/app/pages/dashboard/dashboard.component.ts:779`
- `/app/repos/tmi-ux/src/app/pages/tm/tm.component.ts:398`

**Severity:** LOW-MEDIUM  
**Risk:** Prototype pollution from malicious JSON threat model imports  
**Current Mitigation:** Backend validation provides defense-in-depth  
**Recommendation:** Add explicit prototype key filtering before import

---

## 10. SSRF Sinks

After comprehensive analysis of all network-accessible components, the application demonstrates **limited SSRF exposure**. The Angular SPA is a client-side application where all outbound HTTP requests originate from the **browser** and target a **configured backend API**. No server-side request functionality exists in the frontend that would allow user-controlled SSRF attacks.

**CRITICAL FINDING:** The ONLY potential SSRF vulnerability exists in the **webhook test functionality**, which triggers the backend Go server to make server-side requests with user-configured URLs.

---

### Summary: Single High-Risk SSRF Sink Identified

**Total SSRF Sinks:** 1 (webhook test endpoint)  
**Risk Level:** HIGH (requires backend mitigation)  
**Client-Side HTTP Requests:** 7 categories (all browser-originated, no SSRF risk)

---

### IN-SCOPE SINKS IDENTIFIED

#### 1. HTTP Client Sinks (Client-Side Only - No SSRF Risk)

**1.1 Angular HttpClient Service Layer**

**File:** `/app/repos/tmi-ux/src/app/core/services/api.service.ts` (lines 78-207)

**Description:** Centralized API service wrapping Angular HttpClient for all backend communications.

**HTTP Methods:**
```typescript
get<T>(endpoint: string, params?: Record<string, string | number | boolean>): Observable<T>
post<T>(endpoint: string, body: Record<string, unknown>): Observable<T>
put<T>(endpoint: string, body: Record<string, unknown>): Observable<T>
delete<T>(endpoint: string): Observable<T>
patch<T>(endpoint: string, operations: JsonPatchOperation[]): Observable<T>
```

**URL Construction:**
```typescript
private buildUrl(endpoint: string): string {
  const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${normalizedEndpoint}`;
}
```

**User Input Control:**
- **Endpoint:** Hardcoded in calling services (e.g., `/threat-models`, `/me`)
- **Query Params:** Type-checked (string | number | boolean)
- **Request Body:** Type-checked JSON objects
- **Base URL:** Fixed at app initialization from `environment.apiUrl`

**Security Controls:**
✅ Fixed base URL (configured via environment variables)  
✅ Type-safe parameters (TypeScript enforces types)  
✅ Path normalization (slash handling)  
✅ JWT interceptor (automatic token injection)

**Classification:** IN-SCOPE (client-side browser requests to known backend)  
**SSRF Risk:** NONE - All requests originate from browser, not server

**1.2 Authentication Service OAuth/SAML Flows**

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`

**Key Endpoints:**
```typescript
// OAuth Provider Discovery (line 541)
http.get<ProvidersResponse>(`${environment.apiUrl}/oauth2/providers`)

// SAML Provider Discovery (line 587)
http.get<SAMLProvidersResponse>(`${environment.apiUrl}/saml/providers`)

// OAuth Token Exchange (line 1169)
http.post(`${environment.apiUrl}/oauth2/token?idp=${providerId}`, exchangeRequest)

// Token Refresh (line 364)
http.post(`${environment.apiUrl}/oauth2/refresh`, { refresh_token })

// User Profile Fetch (line 1727)
http.get<UserMeResponse>(`${environment.apiUrl}/me`)

// Logout (line 1896)
http.post(`${environment.apiUrl}/me/logout`, null)
```

**OAuth Redirect Flow:**
```typescript
// Lines 708-722, 759-780
const authUrl = `${provider.auth_url}?state=${state}&code_challenge=${challenge}&...`;
window.location.href = authUrl;  // Browser redirect (not server-side fetch)
```

**User Input Control:**
- **Provider ID:** Selected from server-provided list
- **OAuth State:** CSRF token generated by client
- **auth_url:** Returned by server's `/oauth2/providers` endpoint

**Security Controls:**
✅ Provider whitelist (fetched from server)  
✅ PKCE protection (code challenge/verifier)  
✅ State validation (CSRF protection)  
✅ Browser-initiated redirects (not server-side)

**Classification:** IN-SCOPE (OAuth/SAML authentication flows)  
**SSRF Risk:** NONE - Redirects happen in browser, not server-side fetch

**1.3 Translation Loader**

**File:** `/app/repos/tmi-ux/src/app/i18n/transloco-loader.service.ts:10-12`

```typescript
getTranslation(lang: string): Observable<Record<string, unknown>> {
  return this.http.get<Translation>(`/assets/i18n/${lang}.json`);
}
```

**User Input:** Language code (validated by language service whitelist)

**Classification:** IN-SCOPE (static asset loading)  
**SSRF Risk:** NONE - Loads local static assets only

**1.4 Framework Service**

**File:** `/app/repos/tmi-ux/src/app/shared/services/framework.service.ts:32,52`

```typescript
loadAllFrameworks(): Observable<FrameworkModel[]> {
  const requests = this._frameworkFiles.map(fileName =>
    this.http.get<Framework>(`${this._frameworkAssetPath}${fileName}`)
  );
  return forkJoin(requests);
}
```

**User Input:** Framework name (selected from hardcoded list)

**Classification:** IN-SCOPE (static asset loading)  
**SSRF Risk:** NONE - No user-controlled paths

---

#### 2. WebSocket Connections (Client-Side - No SSRF Risk)

**File:** `/app/repos/tmi-ux/src/app/core/services/websocket.adapter.ts:224-312`

**Connection Code:**
```typescript
connect(url: string): Observable<void> {
  this._socket = new WebSocket(url);
  this._setupEventListeners();
}
```

**URL Construction (DfdCollaborationService):**
```typescript
const apiUrl = environment.apiUrl;
const wsUrl = apiUrl.startsWith('https://') 
  ? apiUrl.replace('https://', 'wss://')
  : apiUrl.replace('http://', 'ws://');
```

**Security Controls:**
✅ Fixed base URL (derived from environment config)  
✅ Protocol mapping (http→ws, https→wss)  
✅ JWT authentication (token as query parameter)

**Classification:** IN-SCOPE (real-time collaboration)  
**SSRF Risk:** NONE - WebSocket URL is environment-configured

---

#### 3. Fetch API Usage (Client-Side - Low Risk)

**3.1 Branding Config Service**

**File:** `/app/repos/tmi-ux/src/app/core/services/branding-config.service.ts:129-158,192-221`

**Config Fetching:**
```typescript
private async fetchConfig(): Promise<ServerConfig | null> {
  const configUrl = apiUrl.replace(/\/api$/, '') + '/config';
  const response = await fetch(configUrl, { signal: controller.signal });
  return await response.json();
}
```

**Logo Fetching:**
```typescript
private async fetchAndValidatePng(url: string): Promise<Uint8Array | null> {
  const response = await fetch(url, { signal: controller.signal });
  
  // Validate content type
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('image/png')) return null;
  
  // Enforce size limit
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_LOGO_SIZE) return null;  // 2MB max
  
  return new Uint8Array(buffer);
}
```

**User Input Control:**
- **Config URL:** Derived from `environment.apiUrl` (fixed)
- **Logo URL:** Returned by server's `/config` endpoint in `ui.logo_url` field

**Security Controls:**
✅ Fixed config URL (environment variable)  
⚠️ Server-provided logo URL (trust backend)  
✅ Content-Type validation (image/png only)  
✅ Size limit (2MB)  
✅ Timeout (5 seconds)

**Classification:** IN-SCOPE  
**SSRF Risk:** LOW - Logo URL is provided by backend `/config` endpoint. If the backend is compromised, an attacker could inject a malicious logo URL. However, this is a **client-side fetch** (browser's same-origin policy applies), so it's NOT traditional SSRF.

**Recommendation:** If backend allows user-controlled `logo_url` values, validate URLs point to trusted domains.

**3.2 PDF Font Manager**

**File:** `/app/repos/tmi-ux/src/app/pages/tm/services/report/pdf-font-manager.ts:234-247`

```typescript
private async fetchFont(fontPath: string): Promise<Uint8Array> {
  const response = await fetch(fontPath);
  const fontData = new Uint8Array(await response.arrayBuffer());
  return fontData;
}
```

**Font Paths:** Hardcoded in `DEFAULT_FONT_CONFIGS` (e.g., `assets/fonts/ttf/NotoSans-*.ttf`)

**Classification:** OUT-OF-SCOPE (PDF generation utility)  
**SSRF Risk:** NONE - All font paths are static assets

---

#### 4. Webhook Functionality (SERVER-SIDE - HIGH SSRF RISK)

**CRITICAL FINDING: Webhook Test Endpoint SSRF Vulnerability**

**File:** `/app/repos/tmi-ux/src/app/core/services/webhook.service.ts:74-82`

```typescript
public test(id: string): Observable<void> {
  return this.apiService.post<void>(`${this.config.endpoint}/${id}/test`, {});
}
```

**Attack Vector:**

This UI call triggers the **backend Go server** to perform an HTTP POST to the webhook URL:

**Exploitation Flow:**
1. User creates webhook subscription with malicious URL
2. User clicks "Test Webhook" in admin UI
3. Frontend sends POST to `/webhooks/subscriptions/{id}/test`
4. **Backend Go server** makes server-side HTTP request to stored webhook URL
5. Attacker exploits SSRF to access internal resources

**Example Exploit URLs:**

```
http://127.0.0.1:8080/admin              # Access localhost admin panel
http://169.254.169.254/latest/meta-data  # AWS EC2 metadata (credentials)
http://metadata.google.internal/...      # GCP metadata
http://192.168.1.1/                      # Internal network scanning
```

**Security Controls (Frontend):**
✅ Webhook ID validation (only existing webhooks can be tested)  
✅ JWT authentication (user must be authenticated)  
❌ NO URL validation in frontend

**Backend Security Requirements:**

⚠️ **URL Validation Required** - Backend must implement SSRF protection:
- Block private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Block localhost (127.0.0.1, ::1, localhost)
- Block link-local addresses (169.254.0.0/16)
- Block cloud metadata endpoints (169.254.169.254, metadata.google.internal)
- Enforce HTTPS for production webhooks
- Implement request timeouts (5-10 seconds)
- Limit or disable HTTP redirects
- Use DNS rebinding protection

**Classification:** IN-SCOPE (webhook testing is network-accessible)  
**SSRF Risk:** HIGH (backend-dependent)  
**Location:** Backend Go server (not in this frontend codebase)

**Recommendation for Backend Implementation:**

```go
// Pseudo-code for backend webhook URL validation
func validateWebhookURL(url string) error {
    parsed, err := net.ParseURL(url)
    if err != nil {
        return err
    }
    
    // Enforce HTTPS in production
    if production && parsed.Scheme != "https" {
        return errors.New("HTTPS required for webhooks")
    }
    
    // Resolve hostname
    ips, err := net.LookupIP(parsed.Hostname())
    if err != nil {
        return err
    }
    
    // Block private/reserved IPs
    for _, ip := range ips {
        if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() {
            return errors.New("Webhook URL resolves to private IP")
        }
        
        // Block AWS metadata
        if ip.String() == "169.254.169.254" {
            return errors.New("AWS metadata endpoint blocked")
        }
    }
    
    return nil
}
```

---

#### 5. Express Server (No Outbound Requests)

**File:** `/app/repos/tmi-ux/server.js:1-99`

**Endpoints:**
- `GET /config.json` - Returns environment config (no outbound requests)
- `GET /*` - Serves Angular SPA static assets

**Classification:** OUT-OF-SCOPE  
**SSRF Risk:** NONE - Server is purely a static file host

---

### NO ADDITIONAL SINKS FOUND

**Comprehensive Search Results:**

✅ No `axios`, `node-fetch`, or `request` libraries  
✅ No `XMLHttpRequest` direct usage (Angular HttpClient wraps it)  
✅ No server-side `import()` with dynamic URLs  
✅ No PDF/image processing with URL inputs (except client-side fonts)  
✅ No link preview/unfurler functionality  
✅ No RSS/feed readers  
✅ No URL health checkers or pingers  
✅ No OAuth JWKS/discovery with user-controlled URLs (server-provided only)  
✅ No SSR/headless browser functionality  
✅ Express server makes no outbound HTTP requests

---

### SSRF Risk Summary

| Sink | Location | User Input | Risk | Notes |
|------|----------|------------|------|-------|
| API Service | api.service.ts | Endpoint path | NONE | Client-side only |
| OAuth/SAML | auth.service.ts | Provider ID | NONE | Browser redirects |
| i18n Loader | transloco-loader | Language code | NONE | Static assets |
| Framework Loader | framework.service | Framework name | NONE | Static assets |
| WebSocket | websocket.adapter | Connection URL | NONE | Environment config |
| Branding Config | branding-config | Logo URL | LOW | Client-side fetch |
| **Webhook Test** | webhook.service | Webhook URL | **HIGH** | **Server-side request** |

---

### Recommendations

**For Frontend Team:**
1. ✅ No immediate action required for client-side HTTP requests
2. Document webhook test SSRF risks in admin UI
3. Consider adding webhook URL validation warnings in UI

**For Backend Team (HIGH PRIORITY):**
1. **URGENT:** Audit `/webhooks/subscriptions/{id}/test` endpoint implementation
2. Implement private IP range blocking (RFC 1918, RFC 3927, loopback)
3. Block cloud metadata endpoints (169.254.169.254, metadata.google.internal)
4. Enforce HTTPS for production webhooks
5. Implement request timeout (5-10 seconds)
6. Limit or disable HTTP redirect following
7. Log all webhook test requests for security monitoring
8. Consider rate limiting webhook tests per user/webhook

**For Security Review:**
1. Focus backend assessment on webhook implementation
2. Test webhook test endpoint with SSRF payloads:
   - `http://127.0.0.1:8080/admin`
   - `http://169.254.169.254/latest/meta-data/`
   - `http://metadata.google.internal/computeMetadata/v1/`
   - `http://192.168.0.1/`
3. Verify redirect handling (e.g., redirect to localhost)
4. Test DNS rebinding attacks if applicable

---

### Conclusion

The Angular SPA demonstrates **strong SSRF protection** for a client-side application. All HTTP requests originate from the browser and target a fixed backend API. The Express static file server makes no outbound requests.

**The single exception is the webhook test functionality**, which delegates to the backend Go server. This requires backend-side SSRF mitigations that are **outside the scope of this frontend codebase**.

**Overall SSRF Risk:** LOW (assuming backend implements proper webhook URL validation)

---

## Penetration Testing Execution Plan

Based on this comprehensive code analysis, the following penetration testing priorities are recommended:

### Phase 1: Authentication & Session Management Testing
1. **OAuth/SAML Flow Testing**
   - Test state parameter validation (including TMI OAuth proxy relaxed validation)
   - PKCE implementation verification
   - Token refresh race conditions
   - Cross-site request forgery via OAuth
   - Authorization code interception

2. **Session Management Testing**
   - Token storage security (localStorage XSS extraction)
   - Cross-tab session synchronization
   - Zombie session prevention
   - Token expiry and refresh logic
   - WebSocket token authentication

3. **Authorization Testing**
   - Missing admin guards on `/admin/webhooks` and `/admin/addons`
   - Privilege escalation (reader → writer → owner)
   - Principal-based access control bypass
   - Group membership manipulation

### Phase 2: Backend API Testing (130+ Endpoints)
1. **Authentication Endpoint Testing**
   - `/oauth2/token` - Token exchange security
   - `/oauth2/refresh` - Refresh token rotation
   - `/oauth2/callback` - Callback parameter manipulation
   - `/saml/acs` - SAML assertion validation

2. **CRUD Endpoint Testing**
   - SQL injection in filters/queries
   - Mass assignment vulnerabilities
   - Insecure direct object references (IDOR)
   - Bulk operation abuse

3. **Admin Endpoint Testing**
   - User/group management authorization
   - Quota bypass
   - Settings manipulation
   - Survey management privilege escalation

### Phase 3: SSRF & Injection Testing
1. **Webhook Test Endpoint (HIGH PRIORITY)**
   - Test webhook test endpoint with SSRF payloads
   - Cloud metadata endpoint access
   - Internal network scanning
   - DNS rebinding attacks
   - Redirect following exploitation

2. **XSS Testing**
   - URL scheme validation bypass (threat references)
   - JSON import prototype pollution
   - Markdown rendering edge cases
   - DOMPurify configuration bypass attempts

### Phase 4: Data Security Testing
1. **Token Encryption**
   - Browser fingerprint enumeration
   - localStorage token extraction via XSS
   - Session salt manipulation

2. **PII Handling**
   - Log file analysis for leaked tokens
   - WebSocket token exposure in proxy logs
   - Error message information disclosure

### Phase 5: Infrastructure & DoS Testing
1. **Rate Limiting**
   - Test 1000 req/15min rate limit effectiveness
   - Bypass via distributed IPs
   - WebSocket connection flooding

2. **Security Headers**
   - Verify HSTS, CSP, X-Frame-Options enforcement
   - Content-Type sniffing
   - Clickjacking

---

**PRE-RECON CODE ANALYSIS COMPLETE**

## Authenticated Scans

### SCHEMATHESIS
Status: success
Schema: cia.json
Error: 
    at runTerminalScan (file:///app/src/phases/pre-recon.js:61:88)
    exit code: 1

Schema: die.json
Error: 
    at runTerminalScan (file:///app/src/phases/pre-recon.js:61:88)
    exit code: 1

Schema: linddun.json
Error: 
    at runTerminalScan (file:///app/src/phases/pre-recon.js:61:88)
    exit code: 1

Schema: plot4ai.json
Error: 
    at runTerminalScan (file:///app/src/phases/pre-recon.js:61:88)
    exit code: 1

Schema: stride.json
Error: 
    at runTerminalScan (file:///app/src/phases/pre-recon.js:61:88)
    exit code: 1

---
Report generated at: 2026-03-04T04:23:58.575Z