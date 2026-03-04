# Authentication Analysis Report

## 1. Executive Summary
- **Analysis Status:** Complete
- **Key Outcome:** Multiple critical authentication vulnerabilities were identified, primarily related to transport security, rate limiting, OAuth CSRF protection, and weak token encryption.
- **Purpose of this Document:** This report provides the strategic context on the application's authentication mechanisms, dominant vulnerability patterns, and key architectural details necessary to effectively exploit the vulnerabilities listed in the exploitation queue.

## 2. Dominant Vulnerability Patterns

### Pattern 1: Insufficient Rate Limiting and Brute Force Protection
- **Description:** The application applies a global rate limit of 1000 requests per 15 minutes to ALL routes (including static files), providing virtually no protection against authentication attacks. There is no per-account rate limiting, no CAPTCHA, and no monitoring/alerting for failed attempts.
- **Implication:** Attackers can conduct large-scale credential stuffing, password spraying, and brute force attacks with minimal resistance. The permissive limit of 66 requests per minute allows testing thousands of credentials daily from a single IP address.
- **Representative Findings:** `AUTH-VULN-01` (Insufficient Login Rate Limiting), `AUTH-VULN-02` (No Per-Account Lockout), `AUTH-VULN-03` (Missing CAPTCHA), `AUTH-VULN-04` (No Monitoring/Alerting)

### Pattern 2: OAuth State Validation Bypass (CSRF)
- **Description:** The application's OAuth implementation contains a critical flaw where state parameter validation is completely bypassed when an access token is present in the callback response. This defeats the primary CSRF protection mechanism.
- **Implication:** Attackers can conduct CSRF attacks against the OAuth flow, potentially leading to session fixation and account takeover scenarios.
- **Representative Finding:** `AUTH-VULN-05` (OAuth State Validation Bypass)

### Pattern 3: Missing OIDC Nonce Implementation
- **Description:** Despite requesting OpenID Connect scopes (`openid profile email`), the application does not implement nonce generation or validation, making it vulnerable to ID token replay attacks.
- **Implication:** Attackers who intercept or obtain valid ID tokens can replay them to authenticate as the victim user without detection.
- **Representative Finding:** `AUTH-VULN-06` (Missing OIDC Nonce)

### Pattern 4: Weak Token Encryption Key Derivation
- **Description:** JWT tokens stored in localStorage are encrypted using a key derived from easily enumerable browser fingerprint components (user agent, language, screen resolution, timezone). An attacker with XSS access or physical device access can brute-force the small keyspace and decrypt tokens.
- **Implication:** The encryption provides minimal protection against determined attackers, especially when combined with XSS vulnerabilities.
- **Representative Finding:** `AUTH-VULN-11` (Weak Encryption Key Derivation)

### Pattern 5: Transport Security Deficiencies
- **Description:** The application lacks HTTPS enforcement at the server level and does not set HSTS headers, allowing HTTP connections that expose authentication credentials to network interception.
- **Implication:** In development and misconfigured production environments, JWT tokens and OAuth authorization codes could be transmitted over unencrypted HTTP connections.
- **Representative Findings:** `AUTH-VULN-07` (No HTTPS Enforcement), `AUTH-VULN-08` (Missing HSTS Headers)

## 3. Strategic Intelligence for Exploitation

### Authentication Architecture
- **Primary Method:** OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- **Secondary Method:** SAML 2.0 enterprise SSO
- **Supported Providers:** Google, GitHub, Microsoft, custom OAuth/SAML providers
- **Session Management:** JWT tokens stored encrypted in localStorage (NOT HTTP cookies)
- **Token Format:** JWT with claims: `sub`, `email`, `name`, `groups`, `tmi_is_administrator`, `tmi_is_security_reviewer`, `exp`

### Token Storage and Encryption Details
- **Access Token Storage:** `localStorage['auth_token']` - AES-GCM encrypted
- **Refresh Token Storage:** Included in the same encrypted storage
- **User Profile Storage:** `localStorage['user_profile']` - AES-GCM encrypted with JWT as key
- **Session Salt:** `sessionStorage['_ts']` - 16-byte random value used for key derivation
- **PKCE Verifier:** `sessionStorage['pkce_verifier']` - Cleared after token exchange

### Encryption Weakness Details (Critical for Exploitation)
The token encryption uses browser fingerprint for key derivation:
```typescript
// Fingerprint components (easily enumerable):
- navigator.userAgent (20-30 common values)
- navigator.language (7-10 common values)
- screen.width + 'x' + screen.height (5-10 common values)
- timezone offset (9 common values)
- sessionSalt from sessionStorage (readable)

Total keyspace: ~6,000-10,000 combinations
Brute force time: Seconds to minutes on modern hardware
```

### Rate Limit Configuration
- **Current Setting:** 1000 requests per 15 minutes per IP (global across all routes)
- **Effective Rate:** 66 requests per minute
- **Applied To:** All routes including static files, configuration endpoint, and authentication endpoints
- **Implementation:** express-rate-limit middleware at server level

### OAuth Flow Security
- **PKCE:** Properly implemented with S256 (SHA-256) challenge method
- **State Parameter:** Generated with 128 bits of cryptographic randomness BUT validation is bypassed when access_token is present
- **Nonce Parameter:** NOT IMPLEMENTED (despite requesting OIDC scope)
- **Redirect URI:** Dynamically constructed as `${window.location.origin}/oauth2/callback`

### Session Lifecycle
- **Token Lifetime:** 60 minutes (configurable via `TMI_AUTH_TOKEN_EXPIRY_MINUTES`)
- **Proactive Refresh:** 15 minutes before expiry for active users
- **Inactive Warning:** 5-minute warning before session expiry
- **Logout:** Clears localStorage, sessionStorage, and calls `/me/logout` endpoint
- **Cross-Tab Sync:** Logout in one tab propagates to all tabs via storage events

### Authentication Endpoints (Backend API)
All authentication logic is implemented in the backend Go server (not in this frontend codebase):
- `GET /oauth2/providers` - Public (list OAuth providers)
- `POST /oauth2/token` - Public (exchange authorization code for tokens)
- `POST /oauth2/refresh` - Authenticated (refresh access token)
- `GET /me` - Authenticated (get current user profile)
- `POST /me/logout` - Authenticated (logout and invalidate session)
- `GET /saml/providers` - Public (list SAML providers)

## 4. Secure by Design: Validated Components
These components were analyzed and found to have robust defenses. They are low-priority for further testing.

| Component/Flow | Endpoint/File Location | Defense Mechanism Implemented | Verdict |
|---|---|---|---|
| PKCE Implementation | `/app/repos/tmi-ux/src/app/auth/services/pkce.service.ts` | RFC 7636 compliant, S256 challenge method, cryptographically random 256-bit verifier, 5-minute expiration, cleared after use | SAFE |
| Token Expiration Enforcement | `/app/repos/tmi-ux/src/app/auth/services/session-manager.service.ts` | JWT exp claim extracted and validated, proactive refresh 15 minutes before expiry, inactive warning 5 minutes before expiry | SAFE |
| Session Rotation After Login | `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts:1463-1509` | New JWT tokens generated by server on each login, old tokens completely replaced in storage, session timers reset | SAFE |
| Logout and Session Invalidation | `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts:1833-1896` | Clears all localStorage/sessionStorage, calls backend logout endpoint, cross-tab synchronization via storage events | SAFE |
| Authentication Error Messages | `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts:1693-1703` | Generic error messages, no user enumeration, timing-attack resistant | SAFE |
| CSRF via Cookies | N/A (No cookies used) | Application uses localStorage instead of cookies, immune to cookie-based CSRF attacks | SAFE |
| Password Policy | N/A (OAuth/SAML only) | No password fields, authentication delegated to identity providers (Google, GitHub, Microsoft, SAML) | SAFE |
| Password Reset | N/A (OAuth/SAML only) | No password reset functionality, account recovery handled by identity providers | SAFE |

## 5. External Exploitability Assessment

All vulnerabilities identified in this analysis are assessed for external exploitability based on the scope requirement: "Only report vulnerabilities exploitable via http://host.docker.internal:3000 from the internet."

### Externally Exploitable Vulnerabilities

**Rate Limiting Issues (AUTH-VULN-01, AUTH-VULN-02, AUTH-VULN-03, AUTH-VULN-04):**
- **External Access:** YES - Authentication endpoints are publicly accessible
- **Attack Vector:** Network-based credential stuffing, password spraying, brute force
- **Requirements:** No authentication required to attempt login
- **Exploitability:** HIGH

**OAuth State Validation Bypass (AUTH-VULN-05):**
- **External Access:** YES - OAuth callback endpoint is publicly accessible
- **Attack Vector:** CSRF attack via crafted callback URL
- **Requirements:** Victim must click attacker's link
- **Exploitability:** HIGH

**Missing OIDC Nonce (AUTH-VULN-06):**
- **External Access:** YES - OIDC flows are network-accessible
- **Attack Vector:** ID token replay attack
- **Requirements:** Intercept or obtain valid ID token
- **Exploitability:** MEDIUM (requires token interception first)

**Transport Security Issues (AUTH-VULN-07, AUTH-VULN-08):**
- **External Access:** YES - HTTP endpoint is network-accessible (if configured)
- **Attack Vector:** Network interception (MITM)
- **Requirements:** HTTP connection (development/misconfigured environments)
- **Exploitability:** MEDIUM (environment-dependent)

**Weak Token Encryption (AUTH-VULN-11):**
- **External Access:** CONDITIONAL - Requires XSS vulnerability OR physical access
- **Attack Vector:** Decrypt tokens stolen via XSS or device access
- **Requirements:** First obtain encrypted token via XSS or physical access
- **Exploitability:** MEDIUM (requires XSS as prerequisite)

### Non-Externally Exploitable (Excluded from Queue)

**Refresh Token Rotation (AUTH-VULN-09):**
- **External Access:** NO - Backend configuration issue
- **Attack Vector:** Would require compromised backend server
- **Reason for Exclusion:** Cannot be exploited via external network access alone

**Backend Cache-Control (AUTH-VULN-10):**
- **External Access:** NO - Backend configuration issue
- **Attack Vector:** Would require access to intermediate proxies/CDN cache
- **Reason for Exclusion:** Cannot be directly exploited via frontend; backend fix required

## 6. Exploitation Considerations

### Attack Prerequisites
Most authentication vulnerabilities require minimal prerequisites:
- **Rate Limiting Issues:** No prerequisites - attackers can immediately begin credential stuffing
- **OAuth CSRF:** Victim must click malicious link containing crafted OAuth callback
- **OIDC Replay:** Attacker must first intercept valid ID token
- **Weak Encryption:** Attacker must have XSS or physical access to read localStorage

### Attack Detection Risk
- **Rate Limiting Attacks:** LOW - No monitoring/alerting, attacks go undetected
- **OAuth CSRF:** MEDIUM - Requires victim interaction, may appear in access logs
- **Token Decryption:** LOW - Happens entirely client-side, undetectable by server
- **HTTPS Downgrade:** HIGH - Modern browsers warn about HTTPS→HTTP transitions

### Recommended Exploitation Order
1. **Credential Stuffing (AUTH-VULN-01):** Immediate attack with low detection risk
2. **OAuth CSRF (AUTH-VULN-05):** Requires social engineering but high success rate
3. **Token Decryption (AUTH-VULN-11):** Requires XSS prerequisite, combine with injection phase findings
4. **OIDC Replay (AUTH-VULN-06):** Requires token interception, more complex attack

## 7. Backend Dependencies

Many authentication security controls depend on proper backend implementation. The following should be verified during backend security assessment:

### Backend Responsibilities
- **Rate Limiting:** Per-account lockout after failed attempts
- **Token Rotation:** Refresh token rotation on each refresh
- **Token Revocation:** Immediate token blacklisting on logout
- **Cache-Control:** No-store headers on authentication responses
- **HTTPS Enforcement:** Redirect HTTP to HTTPS, enforce HSTS
- **OAuth Security:** Validate state parameter even when access_token present
- **OIDC Security:** Generate and validate nonce claims
- **Monitoring:** Log failed authentication attempts, alert on anomalies

### Verification Needed
The following backend behaviors should be tested during exploitation phase:
- Does the backend rotate refresh tokens on each use?
- Does the backend invalidate tokens on logout?
- Does the backend enforce per-account rate limits?
- Does the backend properly validate OAuth state parameters?
- Does the backend set Cache-Control: no-store on auth responses?

---

**Report compiled from comprehensive white-box code audit of TMI-UX authentication mechanisms. All findings include file locations, line numbers, code evidence, attack scenarios, and remediation guidance.**