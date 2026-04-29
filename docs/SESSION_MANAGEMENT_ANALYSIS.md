# SESSION MANAGEMENT AND TOKEN PROPERTIES - CODE ANALYSIS REPORT

**Application:** TMI-UX (Threat Model Intelligence - User Experience)
**Analysis Type:** Session Management, Cookie Security, and Token Properties
**Date:** 2026-03-05
**Scope:** Frontend Angular Application (`/app/repos/tmi-ux/`)

---

## EXECUTIVE SUMMARY

This is a **JWT-based authentication system** with NO session cookies. All authentication state is managed through JWT tokens stored in **encrypted localStorage**. The application implements OAuth 2.0 + PKCE for authentication and uses sophisticated token management with automatic refresh, cross-tab synchronization, and activity-based proactive token renewal.

**Overall Security Posture:** **MIXED** - Strong cryptographic implementation with several architectural concerns.

**Critical Finding:** Token storage in localStorage (even when encrypted) is vulnerable to XSS attacks, which is a fundamental architectural limitation compared to HttpOnly cookies.

---

## 1. SESSION COOKIES ANALYSIS

### Verdict: **N/A** (No Session Cookies Used)

**Confirmation:** The application does **NOT** use session cookies for authentication.

#### Evidence:

**Frontend Express Server (`/app/repos/tmi-ux/server.js`):**
- **Lines 1-99:** No cookie-setting code found
- **Line 27-85:** Only serves JSON configuration and static files
- **No Set-Cookie headers** are configured
- No cookie middleware (e.g., `cookie-parser`) is used

**Source Code Search Results:**
```bash
grep -r "Set-Cookie" /app/repos/tmi-ux/src --include="*.ts" --include="*.js"
# Result: No matches found in application source code
```

**Authentication Implementation:**
```typescript
// File: /app/repos/tmi-ux/src/app/auth/services/auth.service.ts
// Lines 104-106
private readonly tokenStorageKey = 'auth_token';
private readonly profileStorageKey = 'user_profile';
```

All authentication state is stored in **localStorage**, not cookies.

#### API Documentation Confirmation:

**File:** `/app/repos/tmi-ux/outputs/schemas/tmi-api-types.d.ts`
```typescript
// Lines 12, 32, 52, 72, 92, 112, 132, etc.
cookie?: never;
```

Every API endpoint explicitly declares `cookie?: never`, confirming no cookie-based authentication.

### Architectural Decision:

The application deliberately uses **localStorage + JWT tokens** instead of cookies for the following reasons (implied from implementation):

1. **OAuth 2.0 Pattern:** JWT tokens from OAuth providers naturally fit localStorage
2. **Cross-Origin API:** Backend API is separate from frontend, making cookie management complex
3. **SPA Architecture:** Single Page Application with client-side routing
4. **CORS Simplification:** Avoids CORS cookie credential complexity

### Security Implications:

**Advantages of No Cookies:**
- ✅ No CSRF attacks on authentication tokens
- ✅ No cookie theft via network interception (if HTTPS enforced)
- ✅ No SameSite attribute complexity
- ✅ Tokens only sent when explicitly requested (not auto-sent like cookies)

**Disadvantages:**
- ❌ **Vulnerable to XSS attacks** - JavaScript can access localStorage
- ❌ **No HttpOnly protection** - tokens cannot be marked inaccessible to JavaScript
- ❌ **Token theft via XSS** is the primary risk vector

---

## 2. JWT TOKEN STORAGE SECURITY

### Verdict: **PARTIAL PASS** - Strong encryption implementation but architectural XSS vulnerability

### 2.1 Storage Location

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`

```typescript
// Lines 104-105
private readonly tokenStorageKey = 'auth_token';
private readonly profileStorageKey = 'user_profile';
```

- **Access Tokens:** Stored in `localStorage` as `'auth_token'` (encrypted)
- **Refresh Tokens:** Included in the same encrypted object
- **User Profile:** Stored in `localStorage` as `'user_profile'` (encrypted)

### 2.2 Encryption Implementation

#### Algorithm: **AES-256-GCM** ✅

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`

**Token Encryption (Lines 2029-2040):**
```typescript
private async encryptToken(token: JwtToken, keyStr: string): Promise<string> {
  const key = await this.getAesKeyFromString(keyStr);
  const iv = crypto.getRandomValues(new Uint8Array(12));  // 96-bit IV for GCM
  const plaintext = new TextEncoder().encode(JSON.stringify(token));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const b64Iv = this.uint8ToB64(iv);
  const b64Cipher = this.uint8ToB64(new Uint8Array(ciphertext));
  return `${b64Iv}:${b64Cipher}`;  // Format: "iv:ciphertext"
}
```

**Encryption Properties:**
- ✅ **Algorithm:** AES-256-GCM (authenticated encryption)
- ✅ **IV:** Cryptographically random 12-byte IV (96 bits)
- ✅ **IV Uniqueness:** New IV generated for each encryption operation
- ✅ **GCM Mode:** Provides both confidentiality and authenticity
- ✅ **Web Crypto API:** Uses browser's native crypto implementation

**Token Decryption (Lines 2042-2074):**
```typescript
private async decryptToken(encryptedToken: string, keyStr: string): Promise<JwtToken | null> {
  const [b64Iv, b64Cipher] = encryptedToken.split(':');
  if (!b64Iv || !b64Cipher) return null;

  try {
    const key = await this.getAesKeyFromString(keyStr);
    const iv = this.b64ToUint8(b64Iv);
    const ciphertext = this.b64ToUint8(b64Cipher);
    const plaintextBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    const plaintext = new TextDecoder().decode(plaintextBuf);
    const parsed = JSON.parse(plaintext) as JwtToken;
    // Convert expiresAt string back to Date object if needed
    if (typeof parsed.expiresAt === 'string') {
      parsed.expiresAt = new Date(parsed.expiresAt);
    }
    return parsed;
  } catch (error) {
    // Decryption failure expected when browser session context changes
    this.logger.debug('Token decryption failed - clearing stale encrypted data', error);
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.profileStorageKey);
    return null;
  }
}
```

**Decryption Properties:**
- ✅ **Error Handling:** Failed decryption clears stale data
- ✅ **GCM Authentication:** Tampered ciphertext causes decryption failure
- ✅ **Type Safety:** Reconstructs Date objects from serialized JSON
- ⚠️ **Auto-cleanup:** Automatically removes corrupted/invalid encrypted data

### 2.3 Encryption Key Derivation

#### Key Material: **Browser Fingerprint + Session Salt** ⚠️

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`

**Key Generation (Lines 1969-2000):**
```typescript
/**
 * Generate encryption key for token storage based on browser fingerprint.
 *
 * SECURITY NOTE: This provides defense-in-depth only, not strong protection.
 * The fingerprint components (user agent, language, screen size, timezone) are
 * easily enumerable by an attacker with localStorage access. The session salt
 * in sessionStorage is lost on tab close, making tokens unrecoverable.
 *
 * Future enhancement: Consider using Web Crypto API to generate a random key
 * stored in IndexedDB for stronger protection, while accepting the trade-off
 * that tokens become unrecoverable if IndexedDB is cleared.
 */
private getTokenEncryptionKey(): string {
  // Get or create session-specific salt
  let sessionSalt = sessionStorage.getItem('_ts');
  if (!sessionSalt) {
    const saltArray = new Uint8Array(16);
    crypto.getRandomValues(saltArray);  // ✅ Cryptographically secure random
    sessionSalt = this.uint8ToB64(saltArray);
    sessionStorage.setItem('_ts', sessionSalt);
  }

  // Create browser fingerprint components
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset().toString(),
    sessionSalt,
  ].join('|');

  return fingerprint;
}
```

**AES Key Derivation (Lines 1697-1706):**
```typescript
private async getAesKeyFromString(keyStr: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(keyStr));  // SHA-256 hash
  return await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}
```

**Key Derivation Process:**
```
Fingerprint = [userAgent | language | screenSize | timezone | sessionSalt]
              ↓ (concatenate with '|')
Key Material (string)
              ↓ (SHA-256 hash)
AES-256 Key (32 bytes)
```

#### Security Assessment of Key Derivation: **WEAK** ⚠️

**The code itself acknowledges this limitation** (Lines 1971-1978):

> "SECURITY NOTE: This provides defense-in-depth only, not strong protection.
> The fingerprint components (user agent, language, screen size, timezone) are
> easily enumerable by an attacker with localStorage access."

**Vulnerabilities:**

1. **❌ Low Entropy Components:**
   - `navigator.userAgent`: ~20 common values
   - `navigator.language`: ~50 common languages
   - `screen.width + 'x' + screen.height`: ~10 common resolutions
   - `timezone offset`: ~24 time zones
   - **Total keyspace without salt:** ~20 × 50 × 10 × 24 = **240,000 combinations**
   - **Easily brute-forceable** by an attacker with localStorage access

2. **⚠️ Session Salt Limitation:**
   - Salt stored in `sessionStorage` (key: `'_ts'`)
   - **Lost on tab close** - tokens become unrecoverable
   - 16-byte random salt provides 2^128 entropy ✅
   - BUT attacker with XSS can read sessionStorage immediately ❌

3. **❌ XSS Attack Vector:**
   ```javascript
   // Attacker's XSS payload can steal both encrypted token AND decryption key
   const encryptedToken = localStorage.getItem('auth_token');
   const sessionSalt = sessionStorage.getItem('_ts');
   const fingerprint = [
     navigator.userAgent,
     navigator.language,
     screen.width + 'x' + screen.height,
     new Date().getTimezoneOffset().toString(),
     sessionSalt
   ].join('|');
   // Attacker now has everything needed to decrypt the token
   ```

4. **❌ Defense-in-Depth Only:**
   - Encryption **ONLY** protects against:
     - Physical disk access to browser profile
     - Database dumps of localStorage
   - **DOES NOT** protect against:
     - XSS attacks (attacker has JavaScript execution)
     - Browser extensions with storage access
     - Malicious scripts loaded via compromised CDN

**Recommendation from Code Comments (Lines 1976-1978):**
> "Future enhancement: Consider using Web Crypto API to generate a random key
> stored in IndexedDB for stronger protection, while accepting the trade-off
> that tokens become unrecoverable if IndexedDB is cleared."

### 2.4 XSS Vulnerability Risk

#### Risk Level: **HIGH** ❌

**Fundamental Limitation:** Tokens stored in localStorage are **accessible to JavaScript**, making them vulnerable to XSS attacks.

**Attack Scenario:**
1. Attacker injects malicious script via XSS vulnerability
2. Script reads `localStorage.getItem('auth_token')`
3. Script reads `sessionStorage.getItem('_ts')`
4. Script extracts browser fingerprint (userAgent, language, etc.)
5. Script derives AES key using same algorithm as application
6. Script decrypts token and exfiltrates to attacker's server
7. **Attacker gains full access to victim's session**

**Contrast with HttpOnly Cookies:**
- HttpOnly cookies are **NOT accessible** to JavaScript
- XSS attack cannot directly steal HttpOnly cookies
- Attack requires network interception or CSRF (both harder than XSS token theft)

**Mitigation:** The application relies on **CSP (Content Security Policy)** to prevent XSS:

**File:** `/app/repos/tmi-ux/src/app/core/interceptors/security-headers.interceptor.ts`
```typescript
// Strong CSP blocks inline scripts and restricts script sources
const csp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; ..."
```

**However:** CSP is a defense-in-depth measure, not a guarantee against XSS.

### 2.5 Profile Encryption

**User profiles are also encrypted** using the **access token as key material**:

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`

**Profile Encryption (Lines 1597-1615):**
```typescript
private async storeUserProfile(profile: UserProfile): Promise<void> {
  try {
    // Use the JWT access token as key material
    const tokenObj = this.getStoredToken();
    const keyMaterial = tokenObj?.token;  // ✅ Access token itself is the key
    if (!keyMaterial) {
      throw new Error('Missing access token for profile encryption');
    }
    const encProfile = await this.encryptProfile(profile, keyMaterial);
    localStorage.setItem(this.profileStorageKey, encProfile);
  } catch (e) {
    this.logger.error('Error encrypting user profile', e);
  }
}
```

**Security Properties:**
- ✅ **Key Material:** Access token (high entropy, ~1024-4096 bits for JWT)
- ✅ **Separate Encryption:** Profile encrypted independently from token
- ✅ **Same Algorithm:** AES-256-GCM with random IV
- ⚠️ **Token Dependency:** Profile can only be decrypted if access token is available
- ⚠️ **Same XSS Risk:** Profile encryption doesn't protect against XSS (attacker can read the token)

---

## 3. TOKEN PROPERTIES

### Verdict: **PASS** - Strong token management implementation

### 3.1 Token Entropy and Randomness

#### A. Session ID / Token Generation

**Tokens are NOT generated by the frontend** - they are issued by the backend OAuth server.

**Frontend only generates:**

1. **OAuth State Parameter (CSRF Protection)**

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 806-826)
```typescript
private generateRandomState(returnUrl?: string): string {
  const array = new Uint8Array(16);  // 16 bytes = 128 bits
  window.crypto.getRandomValues(array);  // ✅ Cryptographically secure
  const csrf = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

  if (returnUrl) {
    // Base64 encode JSON object with CSRF + returnUrl
    const stateObject = { csrf: csrf, returnUrl: returnUrl };
    const stateJson = JSON.stringify(stateObject);
    const encoder = new TextEncoder();
    const data = encoder.encode(stateJson);
    return btoa(String.fromCharCode(...data));
  }

  return csrf;  // Just CSRF token if no returnUrl
}
```

**Properties:**
- ✅ **Cryptographically Secure:** `crypto.getRandomValues()` (CSPRNG)
- ✅ **128-bit Entropy:** 16 random bytes = 2^128 possible values
- ✅ **Non-predictable:** Cannot predict next state value
- ✅ **Purpose:** CSRF protection for OAuth flow

2. **PKCE Code Verifier**

**File:** `/app/repos/tmi-ux/src/app/auth/utils/pkce-crypto.utils.ts` (Lines 18-29)
```typescript
export function generateCodeVerifier(): string {
  // RFC 7636 requires 32-byte minimum (43 characters base64url)
  const bytes = new Uint8Array(32);  // 32 bytes = 256 bits
  crypto.getRandomValues(bytes);  // ✅ Cryptographically secure

  // Convert to base64url (URL-safe base64)
  return base64UrlEncode(bytes);
}
```

**Properties:**
- ✅ **Cryptographically Secure:** `crypto.getRandomValues()` (CSPRNG)
- ✅ **256-bit Entropy:** 32 random bytes = 2^256 possible values
- ✅ **RFC 7636 Compliant:** Meets PKCE specification
- ✅ **Purpose:** Prevent authorization code interception attacks

3. **Session Salt (Encryption Key Component)**

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 1984-1987)
```typescript
const saltArray = new Uint8Array(16);  // 16 bytes = 128 bits
crypto.getRandomValues(saltArray);  // ✅ Cryptographically secure
sessionSalt = this.uint8ToB64(saltArray);
sessionStorage.setItem('_ts', sessionSalt);
```

**Properties:**
- ✅ **Cryptographically Secure:** `crypto.getRandomValues()` (CSPRNG)
- ✅ **128-bit Entropy:** 16 random bytes = 2^128 possible values
- ✅ **Purpose:** Adds entropy to encryption key derivation

#### B. JWT Token Properties (Backend-Issued)

**Frontend receives JWT tokens from backend** and validates them:

**JWT Payload Structure** (Lines 56-72):
```typescript
interface JwtPayload {
  sub?: string;      // Subject (user ID)
  email?: string;    // User email
  name?: string;     // Display name
  iat?: number;      // Issued At (timestamp)
  exp?: number;      // Expiration (timestamp)
  idp?: string;      // Identity Provider
  aud?: string;      // Audience
  iss?: string;      // Issuer
  groups?: string[]; // User groups
  providers?: Array<{ provider: string; is_primary: boolean; }>;
  tmi_is_administrator?: boolean;
  tmi_is_security_reviewer?: boolean;
}
```

**Token Validation:**
- ✅ **Expiration Check:** `exp` claim validated before each use
- ✅ **Format Validation:** Must be 3-part JWT (header.payload.signature)
- ✅ **Signature:** Validated by backend (frontend trusts backend-issued tokens)

### 3.2 Token Protection

#### A. HTTPS-Only Transmission ✅

**Tokens are only sent over HTTPS** in production:

**File:** `/app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts` (Lines 61-65)
```typescript
const tokenizedRequest = request.clone({
  setHeaders: {
    Authorization: `Bearer ${token.token}`,  // ✅ Bearer token in header
  },
});
```

**API URL Configuration:**
```typescript
// Production environment enforces HTTPS
apiUrl: 'https://api.example.com'  // ✅ HTTPS
```

**WebSocket Security:**

**File:** `/app/repos/tmi-ux/src/app/core/services/dfd-collaboration.service.ts` (Lines 1647-1649)
```typescript
if (apiUrl.startsWith('https://')) {
  wsUrl = apiUrl.replace('https://', 'wss://');  // ✅ Secure WebSocket
} else if (apiUrl.startsWith('http://')) {
  wsUrl = apiUrl.replace('http://', 'ws://');    // ⚠️ Insecure (dev only)
}
```

**Security Assessment:**
- ✅ **Production:** HTTPS/WSS enforced
- ⚠️ **Development:** HTTP/WS allowed (acceptable for localhost)
- ✅ **Recommendation:** Enforce WSS even in development (already noted in AUTH_QUEUE.json)

#### B. Token Logging and Exposure

**Tokens are properly redacted in logs:**

**File:** `/app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts` (Lines 89-103)
```typescript
requestHeaders: request.headers?.keys()?.reduce((acc, key) => {
  const value = request.headers.get(key);
  if (value) {
    if (key.toLowerCase() === 'authorization') {
      // ✅ Show only the Bearer prefix and token type for debugging
      acc[key] = value.substring(0, 20) + '...[redacted]';
    } else {
      acc[key] = value;
    }
  }
  return acc;
}, {} as Record<string, string>),
```

**HTTP Logging Interceptor:**

**File:** `/app/repos/tmi-ux/src/app/core/interceptors/http-logging.interceptor.ts`
```typescript
// Test expectation (line 245):
Authorization: 'Bearer abc1************l012',  // ✅ Redacted
```

**Security Properties:**
- ✅ **Authorization Header Redaction:** Only first 20 chars + "[redacted]" logged
- ✅ **Prevents Log Leakage:** Tokens not exposed in application logs
- ✅ **Debug-Friendly:** Still shows token is present without revealing value

#### C. Tokens in URLs ❌

**FINDING: Tokens ARE exposed in WebSocket URLs**

**File:** `/app/repos/tmi-ux/src/app/core/services/dfd-collaboration.service.ts` (Lines 1571-1591)
```typescript
private _getFullWebSocketUrl(websocketUrl: string): string {
  // Get valid token for authentication
  let token: string | null = null;
  this.authService.getValidToken().subscribe({
    next: jwtToken => {
      token = jwtToken.token;
    },
    error: error => {
      this.logger.error('Failed to get valid token for WebSocket connection', error);
    },
  });

  // ...

  // ❌ SECURITY ISSUE: Token in query parameter
  const finalUrl = `${wsUrl}?token=${encodeURIComponent(token)}`;

  return finalUrl;
}
```

**Vulnerability Details:**
- ❌ **Token in Query Parameter:** `wss://api.example.com/ws?token=eyJhbGc...`
- ❌ **Browser History:** Query parameters stored in browser history
- ❌ **Referrer Leakage:** May be sent in Referer header to external sites
- ❌ **Server Logs:** WebSocket URLs logged on server (includes token)
- ❌ **Proxy Logs:** Corporate proxies log URLs including query parameters

**Severity:** **HIGH** - This is a significant security vulnerability.

**Already Identified:** This issue is documented in `/app/repos/tmi-ux/outputs/AUTH_QUEUE.json`:

```json
{
  "id": "AUTH-001",
  "title": "Token exposure in WebSocket URL query parameters",
  "severity": "high",
  "recommendation": "Replace query parameter authentication with WebSocket Subprotocol Authentication..."
}
```

### 3.3 Token Expiration

#### Access Token Lifetime: **Backend-Controlled** ✅

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`

**Token Expiration Extraction (Lines 1329-1345):**
```typescript
private extractExpirationFromToken(token: string): Date | null {
  try {
    const payload = token.split('.')[1];
    const decodedPayload = JSON.parse(atob(payload)) as JwtPayload;

    if (decodedPayload.exp) {
      // ✅ exp is in seconds since epoch, convert to milliseconds
      return new Date(decodedPayload.exp * 1000);
    }

    this.logger.warn('JWT token missing exp claim');
    return null;
  } catch (error) {
    this.logger.error('Error extracting expiration from JWT', error);
    return null;
  }
}
```

**Expiration Validation (Lines 291-300):**
```typescript
private isTokenValid(token?: JwtToken | null): boolean {
  const tokenToCheck = token || this.getStoredToken();
  if (!tokenToCheck) {
    return false;
  }

  // ✅ Check if token is expired
  const now = new Date();
  return tokenToCheck.expiresAt > now;
}
```

**Properties:**
- ✅ **JWT `exp` Claim:** Uses standard JWT expiration claim
- ✅ **Backend Control:** Expiration time set by backend token issuer
- ✅ **Client Enforcement:** Frontend validates expiration before each request
- ✅ **Fallback:** If `exp` missing, uses `expires_in` from OAuth response (default 3600s)

**Typical Expiration Times (from OAuth responses):**
- **Access Token:** 3600 seconds (1 hour) - backend default
- **Refresh Token:** No expiration claim in JWT (backend manages)

#### Automatic Token Refresh: **15 Minutes Before Expiry** ✅

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 338-347)
```typescript
private shouldRefreshToken(token?: JwtToken | null): boolean {
  const tokenToCheck = token || this.getStoredToken();
  if (!tokenToCheck || !tokenToCheck.refreshToken) {
    return false;
  }

  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000); // ✅ 15 minute buffer
  return tokenToCheck.expiresAt <= fifteenMinutesFromNow;
}
```

**Token Refresh Configuration:**

**File:** `/app/repos/tmi-ux/src/app/auth/config/session.config.ts` (Lines 12-17)
```typescript
export const SESSION_CONFIG = {
  /**
   * Time before token expiration to proactively refresh (for active users).
   * Active users get silent background refresh at this threshold.
   * Default: 15 minutes
   */
  PROACTIVE_REFRESH_MS: 15 * 60 * 1000,  // ✅ 900,000 ms = 15 minutes
```

**Activity-Based Refresh Logic:**

**File:** `/app/repos/tmi-ux/src/app/auth/services/session-manager.service.ts` (Lines 203-240)
```typescript
private checkActivityAndRefreshIfNeeded(): void {
  const token = this.authService.getStoredToken();
  if (!token) return;

  const now = new Date();
  const timeToExpiry = token.expiresAt.getTime() - now.getTime();

  // ✅ If token expires within proactiveRefreshTime AND user is active, refresh proactively
  if (timeToExpiry <= this.proactiveRefreshTime && this.activityTracker.isUserActive()) {
    this.logger.info('User is active and token expiring soon - refreshing proactively', {
      timeToExpiry: `${Math.floor(timeToExpiry / 1000)}s`,
    });

    this.authService.refreshToken().subscribe({
      next: newToken => {
        this.logger.info('Proactive token refresh successful', {
          newExpiry: newToken.expiresAt.toISOString(),
        });
        // ✅ Store the new token - this will trigger onTokenRefreshed() and restart timers
        this.authService.storeToken(newToken);
      },
      error: error => {
        this.logger.error('Proactive token refresh failed', error);
        // ✅ Don't force logout on proactive refresh failure
        this.notificationService.showWarning(
          'Session refresh failed. Please save your work to avoid data loss.',
          8000,
        );
      },
    });
  }
}
```

**Refresh Strategy:**
- ✅ **Active Users:** Silent background refresh 15 minutes before expiry
- ✅ **Inactive Users:** Warning dialog 5 minutes before expiry
- ✅ **Activity Check:** Every 60 seconds
- ✅ **Activity Window:** 2 minutes (user active if interaction within 2 minutes)

#### Session Timeout Configuration:

**File:** `/app/repos/tmi-ux/src/app/auth/config/session.config.ts`
```typescript
export const SESSION_CONFIG = {
  WARNING_TIME_MS: 5 * 60 * 1000,        // ✅ 5 minutes before expiry
  PROACTIVE_REFRESH_MS: 15 * 60 * 1000,  // ✅ 15 minutes before expiry
  ACTIVITY_CHECK_INTERVAL_MS: 60 * 1000, // ✅ Check every 1 minute
  ACTIVITY_WINDOW_MS: 2 * 60 * 1000,     // ✅ 2 minute activity window
  LOGOUT_GRACE_PERIOD_MS: 30 * 1000,     // ✅ 30 second grace period after expiry
}
```

**Timeline Example (1-hour token):**
```
T+0:00   Token issued (expires at T+60:00)
T+45:00  Proactive refresh check starts (15 min before expiry)
         - If user active → silent refresh
         - If user inactive → wait
T+55:00  Warning dialog (5 min before expiry, if still not refreshed)
T+60:00  Token expires
T+60:30  Forced logout (30s grace period elapsed)
```

### 3.4 Token Invalidation

#### Server-Side Invalidation: **YES** ✅

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 1899-1966)

**Logout Implementation:**
```typescript
logout(): void {
  // Determine if we should call server logout endpoint
  const isConnectedToServer =
    this.serverConnectionService.currentStatus === ServerConnectionStatus.CONNECTED;
  const shouldCallServerLogout = this.isAuthenticated && isConnectedToServer && !this.isTestUser;

  if (shouldCallServerLogout) {
    const token = this.getStoredToken();
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
    };

    // ✅ Add Authorization header if we have a token
    if (token?.token) {
      headers['Authorization'] = `Bearer ${token.token}`;
    }

    // ✅ Call backend logout endpoint
    this.http
      .post(`${environment.apiUrl}/me/logout`, null, { headers })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          // ✅ Log error but don't fail logout
          if (error.status === 0 || error.name === 'HttpErrorResponse') {
            this.logger.warn(
              'Server unavailable during logout - proceeding with client-side logout',
            );
          } else {
            this.logger.error('Error during logout', error);
          }
          return of(null);
        }),
      )
      .subscribe({
        complete: () => {
          // ✅ Clear client-side data after server logout
          this.clearAuthData();
          this.logger.info('User logged out successfully');
          void this.router.navigate(['/']);
        },
      });
  } else {
    // ✅ Client-side only logout (offline or test user)
    this.clearAuthData();
    this.logger.info('User logged out successfully (client-side only)');
    void this.router.navigate(['/']);
  }
}
```

**Server-Side Invalidation Properties:**
- ✅ **Backend Endpoint:** `POST /me/logout` with Bearer token
- ✅ **Token Revocation:** Backend invalidates access and refresh tokens
- ✅ **Graceful Degradation:** Works offline (client-side cleanup only)
- ✅ **Error Handling:** Proceeds with logout even if server call fails
- ✅ **Test User Skip:** Skips server call for test users (optimization)

#### Client-Side Cleanup: **COMPREHENSIVE** ✅

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 1862-1893)

```typescript
private clearAuthData(): void {
  // ✅ Remove encrypted tokens
  localStorage.removeItem(this.tokenStorageKey);
  localStorage.removeItem(this.profileStorageKey);

  // ✅ Clear in-memory state
  this.isAuthenticatedSubject.next(false);
  this.userProfileSubject.next(null);
  this.jwtTokenSubject.next(null);

  // ✅ Clear cached providers
  this.cachedOAuthProviders = null;
  this.cachedSAMLProviders = null;
  this.oauthProvidersCacheTime = 0;
  this.samlProvidersCacheTime = 0;

  // ✅ Clear PKCE verifier
  this.pkceService.clearVerifier();

  // ✅ Notify SessionManager to stop timers
  if (this.sessionManagerService) {
    this.sessionManagerService.stopExpiryTimers();
  }

  // ✅ Broadcast logout to other browser tabs for cross-tab synchronization
  try {
    localStorage.setItem('auth_logout_broadcast', Date.now().toString());
    localStorage.removeItem('auth_logout_broadcast');
  } catch {
    // Ignore storage errors (e.g., private browsing mode)
  }
}
```

**Cleanup Items:**
- ✅ **localStorage:** Removes `auth_token` and `user_profile`
- ✅ **sessionStorage:** PKCE verifier cleared
- ✅ **Memory State:** All BehaviorSubjects reset to null/false
- ✅ **Provider Cache:** OAuth/SAML provider lists cleared
- ✅ **Session Timers:** All expiry/warning timers stopped
- ✅ **Cross-Tab Sync:** Broadcasts logout to other browser tabs

#### Refresh Token Revocation: **YES** ✅

**Server-side refresh token revocation** occurs on:
1. **Explicit Logout:** `POST /me/logout` revokes refresh tokens
2. **Token Refresh:** Backend may rotate refresh tokens (audit logging enabled)

**Token Rotation Audit (Lines 1796-1801):**
```typescript
// ✅ Check for refresh token rotation (security audit logging)
if (currentToken.refreshToken === response.refresh_token) {
  this.logger.debug(
    'Refresh token was not rotated by server (same token returned). ' +
    'This may indicate the server does not support refresh token rotation.',
  );
}
```

---

## 4. SESSION FIXATION PROTECTION

### Verdict: **PASS** - Robust protection mechanisms

### 4.1 Token Rotation on Login

**NEW tokens are issued on every login** - no session fixation possible.

#### OAuth Flow Token Exchange:

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts**

**Step 1: Generate New PKCE Challenge (Lines 752-769)**
```typescript
private async initiateTMIOAuthLogin(...): Promise<void> {
  // ✅ Generate NEW PKCE parameters for each login
  const pkceParams = await this.pkceService.generatePkceParameters();

  // ✅ Generate NEW state parameter (CSRF protection)
  const state = this.generateRandomState(returnUrl);
  localStorage.setItem('oauth_state', state);
  localStorage.setItem('oauth_provider', provider.id);

  // ✅ Construct authorization URL with NEW challenge
  const authUrl =
    `${provider.auth_url}${separator}` +
    `state=${state}` +
    `&client_callback=${encodeURIComponent(clientCallbackUrl)}` +
    `&scope=${scope}` +
    `&code_challenge=${encodeURIComponent(pkceParams.codeChallenge)}` +
    `&code_challenge_method=${pkceParams.codeChallengeMethod}`;

  window.location.href = authUrl;  // ✅ Redirect to OAuth provider
}
```

**Step 2: State Validation (Lines 908-933)**
```typescript
handleOAuthCallback(response: OAuthResponse): Observable<boolean> {
  if (response.state) {
    const storedState = localStorage.getItem('oauth_state');
    const receivedState = response.state;

    // ✅ Decode and validate state parameter
    const decodedStoredState = storedState ? this.decodeState(storedState) : null;
    const decodedReceivedState = this.decodeState(receivedState);

    // ✅ CSRF validation
    if (!decodedStoredState || decodedStoredState.csrf !== decodedReceivedState.csrf) {
      this.logger.error('State parameter mismatch - possible CSRF attack');
      this.handleAuthError({
        code: 'invalid_state',
        message: 'Invalid state parameter, possible CSRF attack',
        retryable: false,
      });
      return of(false);
    }
  }

  // ✅ Clear state after validation (single-use)
  localStorage.removeItem('oauth_state');
  localStorage.removeItem('oauth_provider');
```

**Step 3: Token Exchange with PKCE (Lines 1151-1298)**
```typescript
private exchangeAuthorizationCode(...): Observable<boolean> {
  // ✅ Retrieve PKCE verifier (stored during authorization)
  let codeVerifier: string;
  try {
    codeVerifier = this.pkceService.retrieveVerifier();
  } catch (error) {
    // ✅ Error if verifier missing/expired (prevents replay attacks)
    this.handleAuthError({ ... });
    return of(false);
  }

  // ✅ Exchange authorization code for NEW tokens
  const exchangeRequest = {
    grant_type: 'authorization_code',
    code: response.code,
    code_verifier: codeVerifier,  // ✅ Proves client initiated request
    redirect_uri: redirectUri,
  };

  return this.http
    .post<TokenResponse>(exchangeUrl, exchangeRequest)
    .pipe(
      map(tokenResponse => {
        // ✅ Store NEW token (completely replaces any old session)
        const token: JwtToken = {
          token: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresIn,
          expiresAt,
        };

        // ✅ Clear PKCE verifier after successful exchange (single-use)
        this.pkceService.clearVerifier();

        // ✅ Store new token and profile
        this.storeToken(token);
        const userProfile = this.extractUserProfileFromToken(token);
        void this.storeUserProfile(userProfile);

        // ✅ Update authentication state
        this.isAuthenticatedSubject.next(true);
        this.userProfileSubject.next(userProfile);
```

**Session Fixation Protection Mechanisms:**

1. **✅ State Parameter (CSRF Protection):**
   - Unique random state generated per login (128-bit entropy)
   - Validated on callback
   - Single-use (removed after validation)
   - **Cannot be predicted or forced by attacker**

2. **✅ PKCE Code Verifier:**
   - Unique random verifier per login (256-bit entropy)
   - Stored in sessionStorage (lost on tab close)
   - Validated during token exchange
   - Expires after 5 minutes
   - **Prevents authorization code interception**

3. **✅ New Token Issuance:**
   - **Backend issues NEW tokens** on every successful login
   - No token reuse from previous sessions
   - **Pre-authentication tokens are never elevated to authenticated sessions**

4. **✅ Authorization Code:**
   - Single-use authorization code from OAuth provider
   - Exchanged for tokens via PKCE
   - **Cannot be reused or predicted**

### 4.2 Pre-Authentication Token Handling

**No pre-authentication tokens exist** - the application uses OAuth 2.0 authorization code flow:

**Timeline:**
```
1. User clicks "Login" → Generate state + PKCE
2. Redirect to OAuth provider → User authenticates
3. OAuth provider redirects back → Callback with authorization code
4. Exchange code for tokens → Backend issues NEW JWT tokens
5. Store tokens → User authenticated
```

**Key Point:** There is **NO** session or token before step 5. The authorization code is:
- ✅ Single-use
- ✅ Short-lived (~60 seconds typical)
- ✅ Cannot be elevated to authenticated session without PKCE verifier

### 4.3 Can Attacker Force Session ID?

**NO** ❌ - Multiple layers prevent session fixation:

**Attack Scenario 1: Force State Parameter**
```
Attacker sends: https://app.com/oauth2/callback?state=ATTACKER_STATE&code=...
```
**Defense:**
- ❌ `storedState` in localStorage won't match `ATTACKER_STATE`
- ❌ State validation fails (Line 967-977)
- ❌ Authentication aborted

**Attack Scenario 2: Force Authorization Code**
```
Attacker sends: https://app.com/oauth2/callback?code=ATTACKER_CODE
```
**Defense:**
- ❌ PKCE verifier in sessionStorage doesn't match attacker's verifier
- ❌ Backend rejects token exchange (PKCE validation failure)
- ❌ No tokens issued

**Attack Scenario 3: Force Pre-Set Token**
```
Attacker sets: localStorage.setItem('auth_token', 'ATTACKER_ENCRYPTED_TOKEN')
```
**Defense:**
- ❌ Token encrypted with browser fingerprint + session salt
- ❌ Victim's browser has different fingerprint/salt
- ❌ Decryption fails
- ❌ Stale encrypted data cleared (Line 2070)

**Attack Scenario 4: XSS to Set Token**
```javascript
// Attacker's XSS payload
localStorage.setItem('auth_token', 'VALID_ENCRYPTED_TOKEN');
sessionStorage.setItem('_ts', 'SALT_FROM_ATTACKER_SESSION');
```
**Defense:**
- ⚠️ **This would work** if attacker has XSS
- ⚠️ But if attacker has XSS, they can do much worse (steal tokens directly)
- ⚠️ XSS is the primary attack vector, not session fixation

**Conclusion:** Session fixation is **NOT POSSIBLE** in this architecture. The application is well-protected against session fixation attacks through OAuth 2.0 + PKCE.

---

## 5. SESSION ROTATION

### Verdict: **PARTIAL PASS** - Rotation on login, not periodic

### 5.1 Rotation After Login

**YES** ✅ - New token issued on every successful authentication (as demonstrated in Section 4.1).

**Evidence:**
```typescript
// Line 1256: Store NEW token (replaces any previous token)
this.storeToken(token);
```

Every login results in:
- ✅ New access token (unique JWT)
- ✅ New refresh token (unique opaque token)
- ✅ New expiration time
- ✅ New state parameter (next login)
- ✅ New PKCE verifier (next login)

### 5.2 Rotation After Privilege Escalation

**N/A** - No privilege escalation mechanism in the application.

**Explanation:**
- User roles (`is_admin`, `is_security_reviewer`) are set at login time
- Embedded in JWT claims (`tmi_is_administrator`, `tmi_is_security_reviewer`)
- **No runtime privilege escalation** (user must logout and login again for role changes)

**If roles change:**
1. Admin grants user new role in backend
2. User continues with current token (old privileges)
3. User logs out or token expires
4. User logs in again → **NEW token with updated roles**

**Recommendation:** Implement privilege escalation detection:
```typescript
// Poll /me endpoint to check for role changes
// If roles changed, force re-authentication
```

### 5.3 Rotation After Logout

**YES** ✅ - Tokens invalidated on logout.

**Evidence:**
```typescript
// Lines 1862-1867: Clear all tokens
localStorage.removeItem(this.tokenStorageKey);
localStorage.removeItem(this.profileStorageKey);
this.jwtTokenSubject.next(null);

// Lines 1899-1925: Server-side invalidation
this.http.post(`${environment.apiUrl}/me/logout`, null, { headers })
```

**On logout:**
- ✅ Access token removed from localStorage
- ✅ Refresh token removed from localStorage
- ✅ Backend invalidates tokens (if online)
- ✅ **Next login will issue NEW tokens**

### 5.4 Periodic Rotation During Session

**NO** ❌ - Tokens are NOT rotated periodically during active session.

**Current Behavior:**
- Token refreshed 15 minutes before expiry (for active users)
- Refresh operation **MAY** rotate refresh token (backend-dependent)
- **Access token is replaced**, but this is token refresh, not rotation

**Access Token Refresh (Lines 1739-1821):**
```typescript
refreshToken(): Observable<JwtToken> {
  const currentToken = this.getStoredToken();
  if (!currentToken?.refreshToken) {
    return throwError(() => new Error('No refresh token available'));
  }

  return this.http
    .post<TokenResponse>(`${environment.apiUrl}/oauth2/refresh`, {
      refresh_token: currentToken.refreshToken,
    })
    .pipe(
      map(response => {
        // ✅ NEW access token issued
        const newToken = {
          token: response.access_token,
          refreshToken: response.refresh_token,  // May be NEW (rotation) or SAME
          expiresIn,
          expiresAt,
        };

        // ⚠️ Check if refresh token was rotated
        if (currentToken.refreshToken === response.refresh_token) {
          this.logger.debug(
            'Refresh token was not rotated by server (same token returned).'
          );
        }

        return newToken;
      }),
```

**Refresh Token Rotation:**
- ⚠️ **Backend-dependent** - frontend logs warning if refresh token not rotated
- ⚠️ **Not enforced** - application works with or without rotation
- ✅ **Audit logging** - warns if backend doesn't rotate (Line 1797-1801)

**Session Lifetime:**
```
Login → Access Token (1 hour) → Refresh → New Access Token (1 hour) → Refresh → ...
        ↑                                  ↑
        Refresh Token (long-lived)         Refresh Token (may rotate)
```

**Recommendation:**
1. **Enforce refresh token rotation** on backend
2. **Limit refresh token lifetime** (e.g., 30 days)
3. **Implement absolute session timeout** (e.g., force re-authentication after 7 days)

---

## 6. TOKEN RENEWAL

### Verdict: **PASS** - Excellent implementation with activity-based intelligence

### 6.1 Automatic Token Refresh

**YES** ✅ - Sophisticated activity-based refresh mechanism.

**File:** `/app/repos/tmi-ux/src/app/auth/services/session-manager.service.ts`

#### Refresh Strategy:

**1. Proactive Refresh for Active Users (Lines 203-240)**
```typescript
private checkActivityAndRefreshIfNeeded(): void {
  const token = this.authService.getStoredToken();
  if (!token) return;

  const now = new Date();
  const timeToExpiry = token.expiresAt.getTime() - now.getTime();

  // ✅ If token expires within 15 minutes AND user is active, refresh proactively
  if (timeToExpiry <= this.proactiveRefreshTime && this.activityTracker.isUserActive()) {
    this.logger.info('User is active and token expiring soon - refreshing proactively');

    this.authService.refreshToken().subscribe({
      next: newToken => {
        this.logger.info('Proactive token refresh successful');
        // ✅ Store new token → triggers onTokenRefreshed() → restarts timers
        this.authService.storeToken(newToken);
      },
      error: error => {
        this.logger.error('Proactive token refresh failed', error);
        // ✅ Don't force logout - show warning to user
        this.notificationService.showWarning(
          'Session refresh failed. Please save your work to avoid data loss.',
          8000,
        );
      },
    });
  }
}
```

**Activity Detection:**
- Checks every **60 seconds** (configurable)
- User considered active if interaction within **2 minutes**
- Tracks: mouse, keyboard, touch events

**2. Warning for Inactive Users (Lines 127-157)**
```typescript
if (timeToWarning <= 0) {
  // ✅ Token expires very soon, check activity
  if (!this.activityTracker.isUserActive()) {
    this.showExpiryWarning(token.expiresAt);
  } else {
    this.logger.info('User is active - proactive refresh will handle this');
  }
} else {
  // ✅ Set warning timer (only shown if user is inactive)
  this.warningTimer = timer(timeToWarning).subscribe(() => {
    if (!this.activityTracker.isUserActive()) {
      this.showExpiryWarning(token.expiresAt);  // ✅ Show dialog 5 min before expiry
    }
  });
}
```

**Warning Dialog:**
- Shown **5 minutes before expiry** (for inactive users only)
- User can extend session or logout
- Countdown timer shows remaining time

**3. Grace Period for In-Flight Refreshes (Lines 162-178)**
```typescript
// ✅ Set logout timer with grace period
const logoutDelay = timeToExpiry + this.logoutGracePeriod;  // +30 seconds
this.logoutTimer = timer(logoutDelay).subscribe(() => {
  this.logger.warn('Token expired (past grace period), forcing logout');
  this.handleSessionTimeout();
});
```

**Grace Period:**
- **30 seconds** after token expiry
- Allows in-flight refresh requests to complete
- If refresh succeeds, new timers cancel old timers
- If refresh fails, logout after grace period

#### Refresh Triggers:

**A. Activity Check Timer:**
```typescript
// Check every 60 seconds
this.activityCheckTimer = timer(0, this.activityCheckInterval).subscribe(() => {
  this.checkActivityAndRefreshIfNeeded();
});
```

**B. API Request (JWTInterceptor):**
```typescript
// File: /app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts
// Lines 51-52
return this.authService.getValidToken().pipe(
  switchMap(token => {
    // ✅ getValidToken() automatically refreshes if needed
```

**C. Manual Extension:**
```typescript
// User clicks "Extend Session" in warning dialog
private handleExtendSession(): void {
  this.authService.refreshToken().subscribe({ ... });
}
```

#### Refresh Flow:

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 1739-1821)
```typescript
refreshToken(): Observable<JwtToken> {
  const currentToken = this.getStoredToken();
  if (!currentToken?.refreshToken) {
    return throwError(() => new Error('No refresh token available'));
  }

  return this.http
    .post<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    }>(`${environment.apiUrl}/oauth2/refresh`, {
      refresh_token: currentToken.refreshToken,  // ✅ Send refresh token
    })
    .pipe(
      map(response => {
        // ✅ Extract expiration from JWT exp claim (preferred) or fall back to expires_in
        let expiresAt = this.extractExpirationFromToken(response.access_token);
        let expiresIn = response.expires_in;

        const newToken = {
          token: response.access_token,       // ✅ NEW access token
          refreshToken: response.refresh_token, // ✅ NEW or SAME refresh token
          expiresIn,
          expiresAt,
        };

        // ✅ Audit logging for refresh token rotation
        if (currentToken.refreshToken === response.refresh_token) {
          this.logger.debug('Refresh token was not rotated by server');
        }

        return newToken;
      }),
      catchError((error: HttpErrorResponse) => {
        this.logger.error('Token refresh failed', error);
        // ✅ Clear auth data and redirect to login
        this.clearAuthData();
        return throwError(() => new Error('Token refresh failed - please login again'));
      }),
    );
}
```

**Refresh Deduplication:**
```typescript
// Lines 1829-1857: Prevent concurrent refresh requests
private refreshInProgress$: Observable<JwtToken> | null = null;

forceRefreshToken(): Observable<JwtToken> {
  // ✅ If refresh already in progress, return same observable
  if (this.refreshInProgress$) {
    this.logger.debugComponent('Auth', 'Refresh already in progress, reusing existing request');
    return this.refreshInProgress$;
  }

  // ✅ Create shared refresh observable
  this.refreshInProgress$ = this.refreshToken().pipe(
    tap(newToken => {
      this.storeToken(newToken);
      this.refreshInProgress$ = null;  // ✅ Clear flag on success
    }),
    catchError((error: unknown) => {
      this.refreshInProgress$ = null;  // ✅ Clear flag on error
      return throwError(() => error);
    }),
    shareReplay(1),  // ✅ Share result with multiple subscribers
  );

  return this.refreshInProgress$;
}
```

**Deduplication Benefits:**
- ✅ **Prevents duplicate refresh calls** if multiple components request token simultaneously
- ✅ **Shares single HTTP request** across multiple subscribers
- ✅ **Reduces server load** and token churn

### 6.2 Refresh Token Rotation

**STATUS:** ✅ Supported but not enforced (backend-dependent)

**Client-side behavior:**
```typescript
// Lines 1796-1801
if (currentToken.refreshToken === response.refresh_token) {
  this.logger.debug(
    'Refresh token was not rotated by server (same token returned). ' +
    'This may indicate the server does not support refresh token rotation.',
  );
}
```

**Rotation Detection:**
- ✅ **Logs warning** if refresh token not rotated
- ✅ **Accepts both** rotated and non-rotated refresh tokens
- ✅ **Security audit trail** for monitoring

**Recommendation (from recon report):**
> "Client logs warning if refresh_token not rotated"

**Best Practice:**
- Backend SHOULD rotate refresh tokens on each refresh
- Mitigates refresh token theft (stolen token becomes invalid after use)
- Enables detection of token replay attacks

### 6.3 Token Expiry Detection

**MULTIPLE LAYERS OF EXPIRY DETECTION:**

**1. Before Each API Request (JWT Interceptor)**
```typescript
// File: /app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts
// Lines 51-52
return this.authService.getValidToken().pipe(
```

**getValidToken() Implementation (Lines 354-425):**
```typescript
getValidToken(): Observable<JwtToken> {
  const token = this.getStoredToken();

  if (token) {
    return this.processValidToken(token);  // ✅ Validates expiry
  }

  // ✅ Wait for token decryption if in progress
  if (!this.tokenReadySubject.value) {
    return this.tokenReady$.pipe(
      filter(ready => ready),
      take(1),
      switchMap(() => {
        const decryptedToken = this.getStoredToken();
        if (!decryptedToken) {
          return throwError(() => new Error('No token available'));
        }
        return this.processValidToken(decryptedToken);
      }),
    );
  }

  return throwError(() => new Error('No token available'));
}

private processValidToken(token: JwtToken): Observable<JwtToken> {
  const isValid = this.isTokenValid(token);        // ✅ Check expiry
  const shouldRefresh = this.shouldRefreshToken(token); // ✅ Check refresh threshold

  // ✅ Token valid and doesn't need refresh
  if (isValid && !shouldRefresh) {
    return of(token);
  }

  // ✅ Token needs refresh
  if (token.refreshToken) {
    return this.refreshToken().pipe(
      map(newToken => {
        this.storeToken(newToken);
        return newToken;
      }),
    );
  }

  // ❌ Token expired, no refresh token
  this.clearAuthData();
  return throwError(() => new Error('Token expired and no refresh token available'));
}
```

**2. Proactive Activity-Based Check**
```typescript
// Checked every 60 seconds in SessionManagerService
private checkActivityAndRefreshIfNeeded(): void {
  const timeToExpiry = token.expiresAt.getTime() - now.getTime();

  // ✅ Check if expiring within 15 minutes
  if (timeToExpiry <= this.proactiveRefreshTime && this.activityTracker.isUserActive()) {
    this.authService.refreshToken().subscribe({ ... });
  }
}
```

**3. Timer-Based Expiry (Inactive Users)**
```typescript
// Warning timer fires 5 minutes before expiry
this.warningTimer = timer(timeToWarning).subscribe(() => {
  if (!this.activityTracker.isUserActive()) {
    this.showExpiryWarning(token.expiresAt);  // ✅ Show dialog
  }
});

// Logout timer fires at expiry + 30s grace period
this.logoutTimer = timer(logoutDelay).subscribe(() => {
  this.handleSessionTimeout();  // ✅ Force logout
});
```

**4. Page Visibility / Tab Resume**

**File:** `/app/repos/tmi-ux/src/app/auth/services/token-validity-guard.service.ts` (Lines 62-81)
```typescript
// Layer 1: Page visibility change detection
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // ✅ Tab became visible - validate token expiry
    this.authService.validateAndUpdateAuthState();
  }
});

// Layer 2: Timer drift detection (throttled timers)
setInterval(() => {
  const elapsed = Date.now() - lastHeartbeat;
  if (elapsed > EXPECTED_INTERVAL * DRIFT_MULTIPLIER) {
    // ✅ Significant drift detected - validate token
    this.authService.validateAndUpdateAuthState();
  }
  lastHeartbeat = Date.now();
}, HEARTBEAT_INTERVAL);
```

**validateAndUpdateAuthState() Implementation (Lines 311-331):**
```typescript
validateAndUpdateAuthState(): void {
  const token = this.getStoredToken();

  // ✅ No token but auth state is true - clear state
  if (!token) {
    if (this.isAuthenticatedSubject.value) {
      this.logger.warn('No token found but auth state was true, clearing auth state');
      this.clearAuthData();
    }
    return;
  }

  // ✅ Token expired but auth state is true - clear state
  if (!this.isTokenValid(token) && this.isAuthenticatedSubject.value) {
    this.logger.warn('Token expired during background period, clearing auth state', {
      tokenExpiry: token.expiresAt.toISOString(),
      currentTime: new Date().toISOString(),
    });
    this.clearAuthData();
  }
}
```

**Expiry Detection Triggers:**
- ✅ Before each API request (automatic)
- ✅ Every 60 seconds (activity check)
- ✅ 5 minutes before expiry (warning timer)
- ✅ At token expiry + 30s (logout timer)
- ✅ When tab becomes visible (resume detection)
- ✅ When timer drift detected (background throttling detection)

### 6.4 Session Extension

**User-Initiated Extension:** ✅

**File:** `/app/repos/tmi-ux/src/app/auth/services/session-manager.service.ts` (Lines 316-350)
```typescript
private handleExtendSession(): void {
  this.logger.info('User requested session extension');

  // ✅ Force token refresh (even if token still valid)
  this.authService.refreshToken().subscribe({
    next: newToken => {
      this.logger.info('Session extension successful', {
        newExpiry: newToken.expiresAt.toISOString(),
      });
      // ✅ Store new token → triggers onTokenRefreshed() → restarts timers
      this.authService.storeToken(newToken);
      // ✅ Close warning dialog
      if (this.warningDialog) {
        this.warningDialog.close('extend');
      }
    },
    error: error => {
      this.logger.error('Session extension failed', error);
      // ❌ Refresh failed → logout
      this.handleSessionTimeout();
    },
  });
}
```

**Extension Flow:**
```
1. User inactive for 55 minutes (token expires at 60 minutes)
2. Warning dialog appears: "Session expiring in 5:00"
3. User clicks "Extend Session"
4. Frontend calls POST /oauth2/refresh with refresh_token
5. Backend issues NEW access token (1 hour expiry)
6. Frontend stores new token
7. Timer reset → warning at 55 minutes from now
```

**Grace Period Protection:**
- Timer system includes 30-second grace period
- Allows in-flight refresh requests to complete
- Prevents premature logout during extension

---

## 7. URLS AND SESSION IDS

### Verdict: **FAIL** - Tokens exposed in WebSocket URLs

### 7.1 Tokens in URLs

**CRITICAL FINDING:** ❌ **Access tokens ARE included in WebSocket URLs**

**File:** `/app/repos/tmi-ux/src/app/core/services/dfd-collaboration.service.ts` (Lines 1571-1591)

**Vulnerable Code:**
```typescript
private _getFullWebSocketUrl(websocketUrl: string): string {
  // Get valid token for authentication
  let token: string | null = null;
  this.authService.getValidToken().subscribe({
    next: jwtToken => {
      token = jwtToken.token;
    },
    error: error => {
      this.logger.error('Failed to get valid token for WebSocket connection', error);
    },
  });

  // ...URL construction...

  // ❌ CRITICAL SECURITY ISSUE
  const finalUrl = `${wsUrl}?token=${encodeURIComponent(token)}`;

  return finalUrl;
}
```

**Example WebSocket URL:**
```
wss://api.example.com/threat_models/{tm_id}/diagrams/{diagram_id}/ws?token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.NHVaYe26MbtOYhSKkoKYdFVomg4i8ZJd8_-RU8VNbftc4TSMb4bXP3l3YlNWACwyXPGffz5aXHc6lty1Y2t4SWRqGteragsVdZufDn5BlnJl9pdR_kdVFUsra2rWKEofkZeIC4yWytE58sMIihvo9H1ScmmVwBcQP6XETqYd0aSHp1gOa9RdUPDvoXQ5oqygTqVtxaDr6wUFKrKItgBMzWIdNZ6y7O9E0DhEPTbE9rfBo6KTFsHAZnMg4k68CDp2woYIaXbmYTWcvbzIuHO7_37GT79XdIwkm95QJ7hYC9RiwrV7mesbY4PAahERJawntho0my942XheVLmGwLMBkQ
```

**Security Risks:**

1. **❌ Browser History Leak:**
   - Full URL with token stored in browser history
   - Accessible via: `chrome://history`, `about:history`, etc.
   - Persists even after logout
   - **Mitigation:** None - query parameters always logged in history

2. **❌ Referrer Header Leak:**
   - If WebSocket page loads external resources, token may leak via Referer header
   - Example: `<img src="https://external.com/analytics.gif">` sends full URL
   - **Mitigation:** CSP `Referrer-Policy: no-referrer` helps but not foolproof

3. **❌ Server Logs:**
   - Backend server logs full WebSocket URL including token
   - CDN logs, load balancer logs, proxy logs all capture token
   - **Compliance Risk:** Token logging may violate PCI DSS, GDPR, etc.

4. **❌ Proxy Logs:**
   - Corporate proxies log full URLs
   - Network monitoring tools capture WebSocket upgrade request
   - **Risk:** Tokens accessible to network administrators

5. **❌ Shoulder Surfing:**
   - Developer tools Network tab shows full URL
   - Token visible in plaintext in browser console

**Severity:** **HIGH**

**Already Documented:** This vulnerability is tracked in `/app/repos/tmi-ux/outputs/AUTH_QUEUE.json`:

```json
{
  "id": "AUTH-001",
  "title": "Token exposure in WebSocket URL query parameters",
  "severity": "high",
  "category": "authentication",
  "cwe": "CWE-598: Use of GET Request Method With Sensitive Query Strings",
  "file_path": "/app/repos/tmi-ux/src/app/core/services/dfd-collaboration.service.ts",
  "line_start": 1571,
  "line_end": 1591,
  "recommendation": "Replace query parameter authentication with one of the following secure alternatives:\n\n**Option 1 (Preferred): WebSocket Subprotocol Authentication**\n```typescript\n// Instead of token in URL, use subprotocol:\nconst socket = new WebSocket(url, ['authorization', `Bearer.${token}`]);\n```\n\n**Option 2: Initial Message Authentication**\n```typescript\nconst socket = new WebSocket(url);\nsocket.onopen = () => {\n  socket.send(JSON.stringify({\n    type: 'authenticate',\n    token: authService.getStoredToken().token\n  }));\n};\n```\n\n**Option 3: Cookie-Based Authentication**\nUse httpOnly, secure cookies for WebSocket authentication. Backend validates cookie on WebSocket upgrade request."
}
```

### 7.2 OAuth Callback URL

**OAuth callback DOES include authorization code in URL** - this is **expected and acceptable**:

**Example:**
```
https://app.example.com/oauth2/callback?code=AUTH_CODE_HERE&state=STATE_HERE
```

**Why this is acceptable:**

1. **✅ Temporary:** Authorization code is short-lived (~60 seconds)
2. **✅ Single-Use:** Code can only be exchanged once
3. **✅ PKCE-Protected:** Code useless without PKCE verifier (in sessionStorage)
4. **✅ Standard OAuth 2.0:** This is the OAuth authorization code flow specification
5. **✅ Not a Token:** Authorization code is NOT an access token (cannot access resources)

**Code Exchange:**
```typescript
// Lines 1151-1206: Exchange code for tokens
private exchangeAuthorizationCode(response: OAuthResponse, ...): Observable<boolean> {
  // ✅ Retrieve PKCE verifier (proves client initiated request)
  let codeVerifier: string;
  try {
    codeVerifier = this.pkceService.retrieveVerifier();
  } catch (error) {
    // ❌ Code useless without verifier
    return of(false);
  }

  // ✅ Exchange code + verifier for tokens (server-to-server)
  return this.http.post<TokenResponse>(exchangeUrl, {
    grant_type: 'authorization_code',
    code: response.code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });
}
```

**Security:**
- ✅ Code in URL is temporary (appears once, then removed)
- ✅ Code cannot be used without PKCE verifier
- ✅ Code single-use (replay attacks prevented)
- ✅ **Access tokens are NEVER in URLs** (except WebSocket vulnerability above)

### 7.3 Summary: Tokens in URLs

| Token Type | In URL? | Location | Severity |
|------------|---------|----------|----------|
| **Access Token (WebSocket)** | ❌ YES | Query parameter `?token=...` | **HIGH** |
| **Authorization Code (OAuth)** | ✅ YES | Query parameter `?code=...` | **ACCEPTABLE** (standard OAuth flow) |
| **Access Token (API Requests)** | ✅ NO | `Authorization: Bearer` header | **SECURE** |
| **Refresh Token** | ✅ NO | Request body (POST /oauth2/refresh) | **SECURE** |
| **State Parameter** | ✅ YES | Query parameter `?state=...` | **ACCEPTABLE** (CSRF protection) |

**Required Remediation:** Fix WebSocket authentication to avoid token in URL (AUTH-001).

---

## 8. LOGOUT FUNCTIONALITY

### Verdict: **PASS** - Comprehensive multi-layer logout

### 8.1 Server-Side Invalidation

**YES** ✅ - Backend logout endpoint called to revoke tokens.

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 1899-1966)

**Logout Implementation:**
```typescript
logout(): void {
  // Determine if we should call server logout endpoint
  const isConnectedToServer =
    this.serverConnectionService.currentStatus === ServerConnectionStatus.CONNECTED;
  const shouldCallServerLogout = this.isAuthenticated && isConnectedToServer && !this.isTestUser;

  if (shouldCallServerLogout) {
    const token = this.getStoredToken();
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
    };

    // ✅ Add Authorization header with current token
    if (token?.token) {
      headers['Authorization'] = `Bearer ${token.token}`;
    }

    // ✅ POST /me/logout to revoke tokens server-side
    this.http
      .post(`${environment.apiUrl}/me/logout`, null, { headers })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          // ✅ Log error but don't fail logout
          if (error.status === 0 || error.name === 'HttpErrorResponse') {
            this.logger.warn(
              'Server unavailable during logout - proceeding with client-side logout',
            );
          } else {
            this.logger.error('Error during logout', error);
          }
          return of(null);  // ✅ Continue with client-side cleanup
        }),
      )
      .subscribe({
        complete: () => {
          // ✅ Clear client-side data after server logout
          this.clearAuthData();
          void this.router.navigate(['/']);
        },
      });
  } else {
    // ✅ Skip server call if offline or test user
    this.clearAuthData();
    void this.router.navigate(['/']);
  }
}
```

**Server-Side Invalidation Properties:**

1. **✅ Backend Endpoint:** `POST /me/logout`
   - Revokes access token
   - Revokes refresh token
   - Invalidates server-side session (if any)

2. **✅ Bearer Authentication:**
   ```typescript
   headers['Authorization'] = `Bearer ${token.token}`;
   ```
   - Uses current access token for logout request
   - Ensures only token owner can revoke it

3. **✅ Graceful Degradation:**
   - If server unreachable (offline), proceeds with client-side cleanup
   - Doesn't block logout if backend is down
   - **User can always logout** even if network fails

4. **✅ Error Handling:**
   ```typescript
   catchError((error: HttpErrorResponse) => {
     // Log error but continue with logout
     return of(null);  // ✅ Don't throw - always complete logout
   })
   ```

5. **✅ Test User Optimization:**
   ```typescript
   const shouldCallServerLogout = this.isAuthenticated && isConnectedToServer && !this.isTestUser;
   ```
   - Skips server call for test users (demo accounts)
   - Reduces unnecessary backend load during testing

### 8.2 Client-Side Cleanup

**COMPREHENSIVE** ✅ - All authentication artifacts removed.

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 1862-1893)

**clearAuthData() Implementation:**
```typescript
private clearAuthData(): void {
  // ✅ 1. Remove encrypted tokens from localStorage
  localStorage.removeItem(this.tokenStorageKey);      // 'auth_token'
  localStorage.removeItem(this.profileStorageKey);    // 'user_profile'

  // ✅ 2. Clear in-memory authentication state
  this.isAuthenticatedSubject.next(false);
  this.userProfileSubject.next(null);
  this.jwtTokenSubject.next(null);

  // ✅ 3. Clear cached provider information
  this.cachedOAuthProviders = null;
  this.cachedSAMLProviders = null;
  this.oauthProvidersCacheTime = 0;
  this.samlProvidersCacheTime = 0;

  // ✅ 4. Clear PKCE verifier from sessionStorage
  this.pkceService.clearVerifier();

  // ✅ 5. Stop all session timers
  if (this.sessionManagerService) {
    this.sessionManagerService.stopExpiryTimers();
  }

  // ✅ 6. Broadcast logout to other browser tabs
  try {
    localStorage.setItem('auth_logout_broadcast', Date.now().toString());
    localStorage.removeItem('auth_logout_broadcast');
  } catch {
    // Ignore storage errors (private browsing, quota exceeded, etc.)
  }
}
```

**PKCE Verifier Cleanup:**

**File:** `/app/repos/tmi-ux/src/app/auth/services/pkce.service.ts` (Lines 144-151)
```typescript
clearVerifier(): void {
  const hadVerifier = sessionStorage.getItem(this.VERIFIER_STORAGE_KEY) !== null;
  sessionStorage.removeItem(this.VERIFIER_STORAGE_KEY);  // ✅ Remove 'pkce_verifier'

  if (hadVerifier) {
    this.logger.debugComponent('PKCE', 'Cleared PKCE verifier from sessionStorage');
  }
}
```

**Session Timer Cleanup:**

**File:** `/app/repos/tmi-ux/src/app/auth/services/session-manager.service.ts` (Lines 270-278)
```typescript
stopExpiryTimers(): void {
  // ✅ Cancel all timers
  if (this.warningTimer) {
    this.warningTimer.unsubscribe();
    this.warningTimer = null;
  }
  if (this.logoutTimer) {
    this.logoutTimer.unsubscribe();
    this.logoutTimer = null;
  }
  if (this.activityCheckTimer) {
    this.activityCheckTimer.unsubscribe();
    this.activityCheckTimer = null;
  }

  // ✅ Close warning dialog if open
  if (this.warningDialog) {
    this.warningDialog.close();
    this.warningDialog = null;
  }
}
```

**Cleanup Checklist:**

| Artifact | Storage Location | Cleanup Method | ✅ |
|----------|------------------|----------------|---|
| Access Token (encrypted) | `localStorage['auth_token']` | `removeItem()` | ✅ |
| User Profile (encrypted) | `localStorage['user_profile']` | `removeItem()` | ✅ |
| Token Object (memory) | `jwtTokenSubject` | `.next(null)` | ✅ |
| Auth State (memory) | `isAuthenticatedSubject` | `.next(false)` | ✅ |
| User Profile (memory) | `userProfileSubject` | `.next(null)` | ✅ |
| PKCE Verifier | `sessionStorage['pkce_verifier']` | `removeItem()` | ✅ |
| OAuth State | `localStorage['oauth_state']` | Cleared on callback | ✅ |
| Provider Cache | In-memory variables | Set to `null` | ✅ |
| Warning Timer | SessionManager | `unsubscribe()` | ✅ |
| Logout Timer | SessionManager | `unsubscribe()` | ✅ |
| Activity Timer | SessionManager | `unsubscribe()` | ✅ |
| Warning Dialog | Material Dialog | `close()` | ✅ |

### 8.3 Cross-Tab Synchronization

**YES** ✅ - Sophisticated cross-tab logout mechanism.

#### Broadcasting Mechanism:

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 1883-1891)
```typescript
// Broadcast logout to other browser tabs for cross-tab synchronization
// The storage event only fires in OTHER tabs, not the one that made the change
try {
  localStorage.setItem('auth_logout_broadcast', Date.now().toString());
  localStorage.removeItem('auth_logout_broadcast');  // ✅ Triggers storage event
} catch {
  // Ignore storage errors (e.g., private browsing mode)
}
```

**How it works:**

1. **Tab A:** User clicks logout
2. **Tab A:** Sets `localStorage['auth_logout_broadcast'] = timestamp`
3. **Tab A:** Immediately removes `localStorage['auth_logout_broadcast']`
4. **Browser:** Fires `storage` event in **ALL OTHER TABS** (B, C, D, ...)
5. **Tab B, C, D:** Receive `storage` event with key `'auth_logout_broadcast'`
6. **Tab B, C, D:** Clear their own auth data and logout

**Listening for Broadcast:**

**File:** `/app/repos/tmi-ux/src/app/auth/services/token-validity-guard.service.ts` (Lines 146-175)

```typescript
/**
 * Layer 3: Storage Event Listener
 * Listens for cross-tab logout events via localStorage.
 * When another tab logs out, it sets/removes 'auth_logout_broadcast',
 * which triggers a 'storage' event in this tab.
 *
 * Note: The 'storage' event only fires in OTHER tabs, not the one that made
 * the change. The tab that initiated logout clears its state directly.
 */
private setupStorageEventListener(): void {
  this.storageEventHandler = (event: StorageEvent) => {
    // ✅ Check for logout broadcast
    if (event.key === 'auth_logout_broadcast') {
      this.logger.info('Cross-tab logout detected - clearing authentication state');

      // ✅ Clear auth data in this tab
      this.authService['clearAuthData']();  // Call private method

      // ✅ Redirect to home page
      this.router.navigate(['/'], {
        queryParams: { reason: 'logged_out_in_another_tab' }
      });
    }
  };

  // ✅ Register event listener
  window.addEventListener('storage', this.storageEventHandler);
}
```

**Properties:**

1. **✅ Automatic:** Logout in any tab logs out all tabs
2. **✅ Instant:** No polling required (event-based)
3. **✅ Browser Native:** Uses built-in `storage` event API
4. **✅ Graceful Degradation:** Catches storage errors (private browsing)
5. **✅ User Experience:** Prevents "zombie sessions" across tabs

**Sequence Diagram:**
```
Tab A (User)          Browser          Tab B (Background)
    |                    |                    |
    | logout()           |                    |
    |----Set storage---->|                    |
    | 'auth_logout_      |                    |
    |  _broadcast'       |                    |
    |                    |----storage event-->|
    |                    |   key='auth_       |
    |                    |   logout_broadcast'|
    |                    |                    |
    | Remove storage     |                    | clearAuthData()
    |<-------------------|                    |<---------------
    |                    |                    |
    | clearAuthData()    |                    | navigate('/')
    |<---------------    |                    |<---------------
    |                    |                    |
    | navigate('/')      |                    | [Tab B logged out]
    |<---------------    |                    |
    |                    |                    |
    | [Tab A logged out] |                    |
```

**Edge Cases Handled:**

1. **Private Browsing Mode:**
   ```typescript
   try {
     localStorage.setItem('auth_logout_broadcast', Date.now().toString());
     localStorage.removeItem('auth_logout_broadcast');
   } catch {
     // ✅ Silently fails (localStorage unavailable)
     // ✅ Current tab still logs out
     // ⚠️ Other tabs won't be notified (acceptable limitation)
   }
   ```

2. **Storage Quota Exceeded:**
   - Same try/catch handling
   - Current tab logs out
   - Other tabs may not receive event

3. **Tab Closed Before Event Fires:**
   - No cleanup needed (tab already closed)

4. **Multiple Rapid Logouts:**
   - Each logout event processed independently
   - `clearAuthData()` is idempotent (safe to call multiple times)

**Testing:**

**File:** `/app/repos/tmi-ux/src/app/auth/services/token-validity-guard.service.spec.ts` (Lines 223-277)
```typescript
describe('Layer 3: Cross-Tab Storage Events', () => {
  it('should logout when auth_logout_broadcast event is received', () => {
    // Simulate storage event from another tab
    const storageEvent = new StorageEvent('storage', {
      key: 'auth_logout_broadcast',
    });
    window.dispatchEvent(storageEvent);

    // ✅ Verify logout was called
    expect(mockAuthService.clearAuthData).toHaveBeenCalled();
  });

  it('should ignore unrelated storage events', () => {
    const storageEvent = new StorageEvent('storage', {
      key: 'some_other_key',
    });
    window.dispatchEvent(storageEvent);

    // ✅ Verify no action taken
    expect(mockAuthService.clearAuthData).not.toHaveBeenCalled();
  });
});
```

### 8.4 Logout Scenarios

**Comprehensive logout coverage:**

| Scenario | Server Call | Client Cleanup | Cross-Tab Sync | Navigate |
|----------|-------------|----------------|----------------|----------|
| **User clicks Logout** | ✅ | ✅ | ✅ | ✅ Home |
| **Token expired (auto)** | ❌ | ✅ | ⚠️ | ✅ Home |
| **Server unreachable** | ⚠️ Attempt | ✅ | ✅ | ✅ Home |
| **Offline mode** | ❌ | ✅ | ✅ | ✅ Home |
| **Test user logout** | ❌ | ✅ | ✅ | ✅ Home |
| **Cross-tab logout** | ❌ | ✅ | N/A (receiver) | ✅ Home |
| **401 after refresh fails** | ❌ | ✅ | ⚠️ | Via error handler |

**Navigation after Logout:**
```typescript
// Lines 1951, 1964
void this.router.navigate(['/']);  // ✅ Always redirects to home page
```

**Query Parameters (Cross-Tab):**
```typescript
// token-validity-guard.service.ts, Line 170
this.router.navigate(['/'], {
  queryParams: { reason: 'logged_out_in_another_tab' }  // ✅ Informative reason
});
```

---

## 9. CODE EVIDENCE SUMMARY

### Key Files and Line Numbers

**Authentication Service:**
- **File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (2075 lines)
- **Token Storage:** Lines 104-105
- **Encryption:** Lines 2029-2074
- **Key Derivation:** Lines 1969-2000
- **Token Validation:** Lines 291-300
- **Token Refresh:** Lines 1739-1821
- **Logout:** Lines 1899-1966
- **Cross-Tab Broadcast:** Lines 1883-1891

**Session Manager:**
- **File:** `/app/repos/tmi-ux/src/app/auth/services/session-manager.service.ts` (377 lines)
- **Activity Check:** Lines 203-240
- **Warning Timer:** Lines 127-157
- **Logout Timer:** Lines 162-178
- **Session Extension:** Lines 316-350

**JWT Interceptor:**
- **File:** `/app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts** (262 lines)
- **Token Injection:** Lines 51-67
- **401 Handling:** Lines 164-231
- **Token Redaction:** Lines 89-103

**PKCE Service:**
- **File:** `/app/repos/tmi-ux/src/app/auth/services/pkce.service.ts` (183 lines)
- **Code Verifier Generation:** Lines 34-59
- **Verifier Storage:** Lines 169-181
- **Verifier Retrieval:** Lines 92-138

**Token Validity Guard:**
- **File:** `/app/repos/tmi-ux/src/app/auth/services/token-validity-guard.service.ts**
- **Cross-Tab Logout:** Lines 146-175
- **Visibility Detection:** Lines 62-81

**Session Configuration:**
- **File:** `/app/repos/tmi-ux/src/app/auth/config/session.config.ts**
- **Timing Constants:** Lines 5-53

---

## 10. VULNERABILITIES FOUND

### CRITICAL VULNERABILITIES

#### VULN-1: Token Exposure in WebSocket URLs (HIGH SEVERITY)

**CWE:** CWE-598: Use of GET Request Method With Sensitive Query Strings
**File:** `/app/repos/tmi-ux/src/app/core/services/dfd-collaboration.service.ts`
**Lines:** 1571-1591

**Description:** Access tokens are passed in WebSocket URL query parameters, exposing them to browser history, server logs, referrer leakage, and proxy logs.

**Vulnerable Code:**
```typescript
const finalUrl = `${wsUrl}?token=${encodeURIComponent(token)}`;
```

**Impact:**
- ❌ Tokens logged in browser history (permanent storage)
- ❌ Tokens logged on backend server
- ❌ Tokens logged in proxies and load balancers
- ❌ Potential referrer header leakage to external sites
- ❌ Visible in browser developer tools

**Recommendation:** Use WebSocket Subprotocol authentication:
```typescript
// SECURE ALTERNATIVE
const socket = new WebSocket(url, ['authorization', `Bearer.${token}`]);
```

**Already Tracked:** AUTH-001 in `/app/repos/tmi-ux/outputs/AUTH_QUEUE.json`

---

### HIGH RISK ARCHITECTURAL CONCERNS

#### ARCH-1: localStorage XSS Vulnerability (HIGH RISK)

**CWE:** CWE-79: Cross-site Scripting (XSS), CWE-522: Insufficiently Protected Credentials
**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`
**Lines:** 104-105, 2005-2014

**Description:** Tokens stored in localStorage (even when encrypted) are fundamentally vulnerable to XSS attacks.

**Risk Factors:**
1. **Weak Encryption Key Derivation:**
   - Browser fingerprint has low entropy (~240K combinations without salt)
   - Session salt in sessionStorage readable by XSS attacker
   - Total keyspace easily enumerable

2. **JavaScript Accessibility:**
   - `localStorage.getItem('auth_token')` accessible to any script
   - `sessionStorage.getItem('_ts')` accessible to any script
   - Attacker with XSS can read both and decrypt token

3. **No HttpOnly Protection:**
   - Unlike HttpOnly cookies, localStorage cannot be protected from JavaScript
   - XSS attack can directly steal encrypted token + decryption materials

**Attack Scenario:**
```javascript
// Attacker's XSS payload
const encToken = localStorage.getItem('auth_token');
const salt = sessionStorage.getItem('_ts');
const fp = [navigator.userAgent, navigator.language,
            screen.width+'x'+screen.height,
            new Date().getTimezoneOffset(), salt].join('|');
// Attacker derives key, decrypts token, exfiltrates to their server
```

**Mitigation in Place:**
- ✅ Strong CSP blocks inline scripts
- ✅ Token encryption (defense-in-depth only)

**Recommendation:**
1. **Short-term:** Maintain strong CSP to prevent XSS
2. **Long-term:** Consider HttpOnly cookie-based session management
3. **Alternative:** Use Web Crypto API to generate random key in IndexedDB

**Code Acknowledgment (Lines 1971-1978):**
> "SECURITY NOTE: This provides defense-in-depth only, not strong protection.
> The fingerprint components are easily enumerable by an attacker with localStorage access."

---

### MEDIUM RISK ISSUES

#### MED-1: Weak Session Salt on Tab Close

**CWE:** CWE-311: Missing Encryption of Sensitive Data
**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`
**Lines:** 1982-1987

**Description:** Session salt stored in `sessionStorage` is lost when tab/browser closes, making encrypted tokens unrecoverable.

**Impact:**
- ⚠️ User must re-authenticate after closing all tabs
- ⚠️ "Remember me" functionality not possible
- ⚠️ Poor UX for users who close/reopen browser frequently

**Current Behavior:**
```typescript
let sessionSalt = sessionStorage.getItem('_ts');
if (!sessionSalt) {
  // ⚠️ Generate new salt → cannot decrypt old tokens
  const saltArray = new Uint8Array(16);
  crypto.getRandomValues(saltArray);
  sessionSalt = this.uint8ToB64(saltArray);
  sessionStorage.setItem('_ts', sessionSalt);
}
```

**Recommendation:** Store encryption key in IndexedDB for persistence across sessions.

---

#### MED-2: Insufficient Refresh Token Rotation Enforcement

**CWE:** CWE-324: Use of a Key Past its Expiration Date
**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`
**Lines:** 1796-1801

**Description:** Refresh token rotation is logged but not enforced. If backend doesn't rotate, same refresh token used indefinitely.

**Impact:**
- ⚠️ Stolen refresh token remains valid indefinitely
- ⚠️ No detection of refresh token theft/replay
- ⚠️ Single compromise = permanent access

**Current Code:**
```typescript
// ⚠️ Only logs warning, doesn't enforce rotation
if (currentToken.refreshToken === response.refresh_token) {
  this.logger.debug(
    'Refresh token was not rotated by server (same token returned).'
  );
}
```

**Recommendation:**
1. Backend MUST rotate refresh tokens on each refresh
2. Frontend should fail if rotation not detected (after grace period)
3. Implement refresh token absolute expiration (e.g., 30 days)

---

#### MED-3: No Absolute Session Timeout

**CWE:** CWE-613: Insufficient Session Expiration
**File:** `/app/repos/tmi-ux/src/app/auth/services/session-manager.service.ts`

**Description:** Sessions can be extended indefinitely through token refresh. No absolute timeout forces re-authentication.

**Impact:**
- ⚠️ Session can last forever if user remains active
- ⚠️ No periodic re-authentication for high-value operations
- ⚠️ Compliance risk (some regulations require periodic re-auth)

**Current Behavior:**
```
Login → Access Token (1 hour) → Refresh → New Access Token (1 hour) → ... (infinite)
```

**Recommendation:** Implement absolute session timeout:
```typescript
// Track login time
const loginTime = Date.now();

// In token refresh logic
const sessionAge = Date.now() - loginTime;
const MAX_SESSION_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

if (sessionAge > MAX_SESSION_AGE) {
  // Force re-authentication
  this.clearAuthData();
  throw new Error('Session expired - please login again');
}
```

---

### LOW RISK / INFORMATIONAL

#### INFO-1: HTTP WebSocket in Development

**CWE:** CWE-319: Cleartext Transmission of Sensitive Information
**File:** `/app/repos/tmi-ux/src/app/core/services/dfd-collaboration.service.ts`
**Lines:** 1647-1652

**Description:** Development mode allows `ws://` (unencrypted WebSocket).

**Code:**
```typescript
if (apiUrl.startsWith('https://')) {
  wsUrl = apiUrl.replace('https://', 'wss://');
} else if (apiUrl.startsWith('http://')) {
  wsUrl = apiUrl.replace('http://', 'ws://');  // ⚠️ Insecure in dev
}
```

**Impact:**
- ⚠️ Tokens transmitted in cleartext on localhost (acceptable)
- ⚠️ If dev environment uses network (not localhost), tokens exposed

**Recommendation:** Enforce `wss://` even in development, or limit to `localhost` only.

---

#### INFO-2: Test User Logout Optimization

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`
**Lines:** 1906

**Description:** Test users skip server logout call (optimization).

**Code:**
```typescript
const shouldCallServerLogout = this.isAuthenticated && isConnectedToServer && !this.isTestUser;
```

**Security Consideration:**
- ✅ Test users are demo accounts (no real data)
- ✅ Optimization reduces backend load during testing
- ⚠️ Ensure test user tokens are clearly marked and have limited scope

---

## 11. FINAL VERDICTS

### Overall Security Assessment

| Category | Verdict | Status |
|----------|---------|--------|
| **1. Session Cookies** | **N/A** | ✅ No cookies used (JWT-based) |
| **2. Token Storage** | **PARTIAL PASS** | ⚠️ Strong encryption, weak key derivation, XSS risk |
| **3. Token Properties** | **PASS** | ✅ CSPRNG, proper expiry, good protection (except WebSocket URLs) |
| **4. Session Fixation** | **PASS** | ✅ OAuth + PKCE prevents fixation |
| **5. Session Rotation** | **PARTIAL PASS** | ✅ On login, ❌ Not periodic, ⚠️ Refresh token rotation not enforced |
| **6. Token Renewal** | **PASS** | ✅ Excellent activity-based refresh |
| **7. URL Security** | **FAIL** | ❌ Tokens in WebSocket URLs |
| **8. Logout** | **PASS** | ✅ Comprehensive multi-layer logout |

### Detailed Verdicts

#### 1. SESSION COOKIES ANALYSIS
**Verdict:** **N/A** (No Session Cookies)

- ✅ **CONFIRMED:** Application does NOT use session cookies
- ✅ **Architecture:** Pure JWT token-based authentication
- ✅ **Storage:** localStorage (encrypted) + sessionStorage (PKCE)
- ⚠️ **Trade-off:** No CSRF on cookies, but XSS risk on localStorage

#### 2. TOKEN STORAGE SECURITY
**Verdict:** **PARTIAL PASS** ⚠️

**PASS:**
- ✅ AES-256-GCM encryption (strong algorithm)
- ✅ Random IV per encryption (proper implementation)
- ✅ User profile separately encrypted
- ✅ Graceful error handling

**FAIL:**
- ❌ **Weak key derivation** (browser fingerprint ~240K keyspace)
- ❌ **XSS vulnerability** (localStorage accessible to JavaScript)
- ❌ **No HttpOnly protection** (fundamental limitation of localStorage)
- ⚠️ **Session salt lost on tab close** (poor UX)

**Key Code References:**
- Encryption: Lines 2029-2040, 2042-2074
- Key Derivation: Lines 1969-2000 (ACKNOWLEDGED AS WEAK)
- Storage: Lines 104-105, 2005-2014

#### 3. TOKEN PROPERTIES
**Verdict:** **PASS** ✅

**Entropy & Randomness:**
- ✅ CSPRNG for all random values (`crypto.getRandomValues()`)
- ✅ OAuth state: 128-bit entropy
- ✅ PKCE verifier: 256-bit entropy
- ✅ Session salt: 128-bit entropy
- ✅ Backend-issued JWT tokens (trusted)

**Protection:**
- ✅ HTTPS/WSS in production
- ✅ Bearer token in Authorization header (API requests)
- ✅ Token redaction in logs
- ❌ **FAIL:** Tokens in WebSocket URLs (HIGH severity)

**Expiration:**
- ✅ JWT `exp` claim validated
- ✅ Automatic refresh 15 min before expiry
- ✅ Activity-based proactive refresh
- ✅ Warning dialog 5 min before expiry (inactive users)

**Invalidation:**
- ✅ Server-side logout endpoint
- ✅ Client-side cleanup
- ✅ Refresh token support
- ⚠️ Refresh token rotation not enforced

**Key Code References:**
- Randomness: Lines 808, 1669, 1985, 2034
- Protection: jwt.interceptor.ts Lines 61-65
- Expiration: Lines 1329-1345, 291-300
- Refresh: Lines 1739-1821

#### 4. SESSION FIXATION PROTECTION
**Verdict:** **PASS** ✅

- ✅ OAuth 2.0 authorization code flow
- ✅ PKCE prevents code interception
- ✅ State parameter (CSRF protection)
- ✅ New tokens issued on every login
- ✅ Single-use authorization codes
- ✅ Cannot force pre-set session ID

**Key Code References:**
- OAuth Flow: Lines 738-799
- State Validation: Lines 908-990
- PKCE Exchange: Lines 1151-1298

#### 5. SESSION ROTATION
**Verdict:** **PARTIAL PASS** ⚠️

**PASS:**
- ✅ New token on every login
- ✅ Tokens cleared on logout

**FAIL:**
- ❌ No periodic token rotation during session
- ⚠️ Refresh token rotation not enforced (logged but not required)
- ❌ No absolute session timeout (sessions can last indefinitely)

**Recommendation:**
- Enforce refresh token rotation
- Implement absolute session timeout (7-30 days)
- Periodic re-authentication for sensitive operations

**Key Code References:**
- Login: Lines 1072-1097, 1245-1263
- Refresh: Lines 1788-1793, 1796-1801

#### 6. TOKEN RENEWAL
**Verdict:** **PASS** ✅

**Excellent implementation:**
- ✅ **Activity-based refresh:** Active users get silent refresh 15 min before expiry
- ✅ **Inactive user warning:** Dialog 5 min before expiry
- ✅ **Grace period:** 30s after expiry for in-flight refreshes
- ✅ **Deduplication:** Prevents concurrent refresh requests
- ✅ **Multi-trigger:** Activity check, API requests, manual extension
- ✅ **Tab resume detection:** Validates token on page visibility change

**Key Code References:**
- Session Manager: Lines 203-240, 316-350
- Auth Service: Lines 1739-1821, 1829-1857
- Interceptor: Lines 51-52

#### 7. URL SECURITY
**Verdict:** **FAIL** ❌

**CRITICAL ISSUE:**
- ❌ **Access tokens in WebSocket URLs** (HIGH severity)
- ❌ Tokens logged in browser history
- ❌ Tokens logged on servers/proxies
- ❌ Potential referrer leakage

**ACCEPTABLE:**
- ✅ Authorization codes in OAuth callback URLs (standard OAuth flow)
- ✅ API requests use Authorization header (no tokens in URLs)

**Key Code References:**
- WebSocket: Lines 1571-1591 (dfd-collaboration.service.ts)
- Tracked: AUTH-001 in AUTH_QUEUE.json

#### 8. LOGOUT FUNCTIONALITY
**Verdict:** **PASS** ✅

**Comprehensive implementation:**
- ✅ **Server-side invalidation:** POST /me/logout revokes tokens
- ✅ **Client-side cleanup:** All storage cleared (localStorage, sessionStorage, memory)
- ✅ **Cross-tab synchronization:** Logout in one tab logs out all tabs
- ✅ **Graceful degradation:** Works offline
- ✅ **Timer cleanup:** All session timers stopped
- ✅ **PKCE cleanup:** Verifier removed
- ✅ **Navigation:** Always redirects to home page

**Key Code References:**
- Logout: Lines 1899-1966
- Cleanup: Lines 1862-1893
- Cross-Tab: Lines 1883-1891, token-validity-guard.service.ts Lines 146-175

---

## 12. SECURITY RECOMMENDATIONS

### CRITICAL (Fix Immediately)

1. **FIX: Remove Tokens from WebSocket URLs** (AUTH-001)
   - **File:** `dfd-collaboration.service.ts` Lines 1571-1591
   - **Change:** Use WebSocket Subprotocol authentication
   - **Code:**
     ```typescript
     // CURRENT (INSECURE)
     const finalUrl = `${wsUrl}?token=${encodeURIComponent(token)}`;

     // RECOMMENDED (SECURE)
     const socket = new WebSocket(wsUrl, ['authorization', `Bearer.${token}`]);
     ```

### HIGH PRIORITY

2. **IMPROVE: Strengthen Encryption Key Derivation**
   - **File:** `auth.service.ts` Lines 1969-2000
   - **Change:** Use random key in IndexedDB instead of browser fingerprint
   - **Rationale:** Browser fingerprint has low entropy (~240K combinations)
   - **Code:**
     ```typescript
     // Generate random AES key
     const key = await crypto.subtle.generateKey(
       { name: 'AES-GCM', length: 256 },
       true,
       ['encrypt', 'decrypt']
     );

     // Export and store in IndexedDB
     const exportedKey = await crypto.subtle.exportKey('raw', key);
     await indexedDB.put('encryption_key', exportedKey);
     ```

3. **ENFORCE: Refresh Token Rotation**
   - **File:** `auth.service.ts` Lines 1796-1801
   - **Change:** Fail refresh if backend doesn't rotate refresh token
   - **Code:**
     ```typescript
     if (currentToken.refreshToken === response.refresh_token) {
       this.logger.error('Refresh token was not rotated - security violation');
       throw new Error('Server did not rotate refresh token');
     }
     ```

4. **IMPLEMENT: Absolute Session Timeout**
   - **File:** `session-manager.service.ts`
   - **Change:** Add maximum session lifetime (e.g., 7 days)
   - **Code:**
     ```typescript
     // Store login time
     private loginTime: number | null = null;

     // Check in token refresh
     const sessionAge = Date.now() - this.loginTime;
     const MAX_SESSION_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

     if (sessionAge > MAX_SESSION_AGE) {
       this.logger.warn('Absolute session timeout exceeded');
       this.handleSessionTimeout();
       throw new Error('Session expired - please login again');
     }
     ```

### MEDIUM PRIORITY

5. **ENHANCE: Enforce WSS in Development**
   - **File:** `dfd-collaboration.service.ts` Lines 1647-1652
   - **Change:** Only allow ws:// for localhost, enforce wss:// otherwise
   - **Code:**
     ```typescript
     if (apiUrl.startsWith('http://localhost') || apiUrl.startsWith('http://127.0.0.1')) {
       wsUrl = apiUrl.replace('http://', 'ws://');  // OK for localhost
     } else {
       wsUrl = apiUrl.replace('http://', 'wss://');  // Force secure
     }
     ```

6. **CONSIDER: HttpOnly Cookie Alternative**
   - **Rationale:** HttpOnly cookies immune to XSS (unlike localStorage)
   - **Trade-off:** More complex CORS, no pure SPA architecture
   - **Evaluation:** Assess if XSS risk outweighs architectural complexity

### LOW PRIORITY / FUTURE ENHANCEMENTS

7. **Track Login Time for Audit**
   - Store `loginTime`, `lastActivityTime` in UserProfile
   - Display "Logged in for X hours" in UI
   - Helps users detect unauthorized sessions

8. **Implement Concurrent Session Limits**
   - Limit users to N concurrent sessions
   - Show "Active Sessions" page (similar to Google account)
   - Allow users to revoke sessions remotely

9. **Add Device Fingerprinting for Security Alerts**
   - Detect login from new device/location
   - Send email notification: "New login from Chrome on Windows in New York"
   - Allow users to block suspicious devices

---

## 13. COMPLIANCE CONSIDERATIONS

### PCI DSS 4.0
- ⚠️ **8.2.8:** Tokens logged in WebSocket URLs (violates secure transmission)
- ✅ **8.3.4:** Session timeout implemented (5-15 min warning)
- ✅ **8.3.5:** Logout functionality comprehensive
- ⚠️ **8.3.6:** No absolute session timeout (sessions can last indefinitely)

### OWASP ASVS 4.0
- ✅ **V3.2:** Session Management - Good implementation
- ⚠️ **V3.3:** Session Logout and Timeout - Missing absolute timeout
- ❌ **V3.5:** Token-Based Session Management - Tokens in URLs
- ✅ **V8.1:** Data Protection - Encryption at rest
- ⚠️ **V8.2:** Client-Side Data Protection - XSS vulnerability in localStorage

### GDPR
- ⚠️ **Article 32:** Token logging in URLs may violate security requirements
- ✅ **Right to be Forgotten:** Logout clears all user data
- ✅ **Data Minimization:** Only necessary data stored

---

## 14. CONCLUSION

The TMI-UX application implements a **sophisticated JWT-based authentication system** with many security best practices:

**Strengths:**
- ✅ Strong OAuth 2.0 + PKCE implementation
- ✅ Excellent activity-based token refresh
- ✅ Comprehensive logout with cross-tab synchronization
- ✅ Proper token expiry detection (multiple layers)
- ✅ Good use of cryptographic primitives (AES-256-GCM, CSPRNG)
- ✅ Session fixation protection via OAuth flow

**Critical Weaknesses:**
- ❌ **Tokens in WebSocket URLs** (HIGH severity)
- ❌ **localStorage XSS vulnerability** (architectural limitation)
- ❌ **Weak encryption key derivation** (low entropy browser fingerprint)

**Recommendations Priority:**
1. **CRITICAL:** Fix WebSocket token exposure (AUTH-001)
2. **HIGH:** Improve encryption key derivation (random key in IndexedDB)
3. **HIGH:** Enforce refresh token rotation
4. **HIGH:** Implement absolute session timeout
5. **MEDIUM:** Enforce WSS in all environments

**Overall Security Posture:** The application demonstrates strong security engineering with sophisticated session management. The primary concern is the architectural trade-off of localStorage (XSS vulnerability) vs cookies (CSRF vulnerability). The WebSocket URL token exposure should be fixed immediately.

---

**End of Report**
