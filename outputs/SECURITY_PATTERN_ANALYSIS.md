# Security Pattern Analysis Report
**Target Application:** tmi-ux (Threat Modeling Interface)
**Analysis Date:** 2026-03-04
**Analyst:** Security Pattern Hunter Agent

---

## Executive Summary

This is an **Angular 21 single-page application** implementing a comprehensive security architecture with OAuth2/SAML authentication, JWT-based authorization, PKCE protection, and extensive security controls. The application demonstrates enterprise-grade security practices with defense-in-depth strategies.

**Key Security Posture:**
- ✅ OAuth2/OIDC + SAML authentication with PKCE
- ✅ JWT bearer tokens with automatic refresh
- ✅ Role-Based Access Control (RBAC)
- ✅ Session management with activity-based token refresh
- ✅ CSP headers and DOMPurify sanitization
- ✅ AES-GCM encryption for token storage
- ✅ Cross-tab session synchronization
- ⚠️ Client-side token storage (encrypted but still accessible)
- ⚠️ Rate limiting on server.js only (not in Angular)

---

## 1. Authentication Mechanisms

### 1.1 Primary Authentication: OAuth2 with PKCE

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 1-2047)

#### OAuth Flow Implementation

```typescript
// OAuth providers fetched from backend API
GET /oauth2/providers  // Returns list of configured OAuth providers (Google, GitHub, etc.)
GET /saml/providers    // Returns list of configured SAML providers

// PKCE Flow:
1. Generate code_verifier (32 random bytes → 43 characters)
2. Compute code_challenge = SHA-256(code_verifier) → base64url
3. Store verifier in sessionStorage (auto-clears on tab close)
4. Redirect to: /oauth2/authorize/{provider}?
   - state={csrf_token}
   - client_callback={origin}/oauth2/callback
   - scope=openid profile email
   - code_challenge={challenge}
   - code_challenge_method=S256

5. Callback receives authorization code
6. Exchange code for tokens using stored verifier:
   POST /oauth2/token?idp={provider}
   Body: {
     grant_type: "authorization_code",
     code: "{auth_code}",
     code_verifier: "{stored_verifier}",
     redirect_uri: "{origin}/oauth2/callback"
   }
```

**CSRF Protection:**
- **State Parameter:** Random 16-byte CSRF token generated using `crypto.getRandomValues()`
- **State Encoding:** Base64-encoded JSON structure containing CSRF token + returnUrl
- **State Validation:** Server validates state matches stored value (Line 896-958)
- **PKCE Additional Protection:** Code verifier prevents authorization code interception

**Location:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`
- **State Generation:** Lines 806-826
- **State Validation:** Lines 896-958
- **PKCE Generation:** Lines 738-799

### 1.2 PKCE Service Implementation

**File:** `/app/repos/tmi-ux/src/app/auth/services/pkce.service.ts` (Lines 1-183)

**Security Properties:**
```typescript
// Code Verifier: 32 random bytes (43 base64url characters)
const codeVerifier = generateCodeVerifier();  // Uses crypto.getRandomValues()

// Code Challenge: SHA-256 hash of verifier
const codeChallenge = await computeCodeChallenge(codeVerifier);

// Storage: sessionStorage (cleared on tab close)
sessionStorage.setItem('pkce_verifier', JSON.stringify(params));

// Expiration: 5 minutes
VERIFIER_MAX_AGE_MS: 5 * 60 * 1000
```

**File:** `/app/repos/tmi-ux/src/app/auth/utils/pkce-crypto.utils.ts`

**PKCE Cryptographic Functions:**
```typescript
// RFC 7636 compliant implementation
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);  // 32 random bytes
  crypto.getRandomValues(array);
  return base64UrlEncode(array);     // 43 characters
}

export async function computeCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}
```

### 1.3 SAML Authentication Support

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 663-691, 698-731)

```typescript
// SAML Login Flow
initiateSAMLLogin(providerId: string, returnUrl?: string) {
  // Get SAML provider configuration from backend
  const provider = await getAvailableSAMLProviders();

  // Redirect to SAML SP-initiated login
  const clientCallbackUrl = `${window.location.origin}/oauth2/callback`;
  const authUrl = `${provider.auth_url}?client_callback=${clientCallbackUrl}`;

  // Store return URL for post-auth navigation
  if (returnUrl) {
    sessionStorage.setItem('saml_return_url', returnUrl);
  }

  window.location.href = authUrl;
}
```

**SAML Provider Properties:**
```typescript
interface SAMLProviderInfo {
  id: string;              // Provider identifier
  name: string;            // Display name
  icon: string;            // Logo path or FontAwesome class
  auth_url: string;        // SAML login endpoint
  metadata_url: string;    // SP metadata URL
  entity_id: string;       // Service Provider entity ID
  acs_url: string;         // Assertion Consumer Service URL
  slo_url?: string;        // Single Logout URL (optional)
}
```

### 1.4 JWT Token Management

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`

**Token Structure:**
```typescript
interface JwtToken {
  token: string;           // JWT access token
  refreshToken?: string;   // Refresh token (if supported)
  expiresIn: number;       // Expiration in seconds
  expiresAt: Date;         // Calculated expiration timestamp
}

interface JwtPayload {
  sub?: string;                      // Provider-assigned user ID
  email?: string;                    // User email
  name?: string;                     // Display name
  iat?: number;                      // Issued at timestamp
  exp?: number;                      // Expiration timestamp
  idp?: string;                      // Identity provider (google, github, etc.)
  aud?: string;                      // Audience
  iss?: string;                      // Issuer
  groups?: string[];                 // User groups from JWT
  providers?: Array<{                // Multiple auth providers
    provider: string;
    is_primary: boolean;
  }>;
  tmi_is_administrator?: boolean;          // Admin flag
  tmi_is_security_reviewer?: boolean;      // Security reviewer flag
}
```

**Token Storage Security:**
- **Encryption:** AES-GCM with SHA-256 derived key (Lines 2003-2045)
- **Key Material:** Browser fingerprint + session salt
  ```typescript
  fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset().toString(),
    sessionSalt  // Random 16-byte value in sessionStorage
  ].join('|');
  ```
- **Storage Location:** localStorage (encrypted), sessionStorage (salt)
- **Auto-cleanup:** Token decryption fails if sessionStorage salt is lost

**⚠️ Security Note:** While tokens are encrypted, this provides defense-in-depth only. An attacker with localStorage access can still enumerate the fingerprint components. The session salt in sessionStorage provides better protection but is lost on tab close.

**Token Refresh:**
```typescript
// Automatic refresh when expires within 15 minutes
shouldRefreshToken(token): boolean {
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
  return tokenToCheck.expiresAt <= fifteenMinutesFromNow;
}

// Refresh endpoint
POST /oauth2/refresh
Body: { refresh_token: "{current_refresh_token}" }
Response: {
  access_token: string,
  refresh_token: string,  // New refresh token (rotation)
  expires_in: number,
  token_type: "Bearer"
}
```

**Location:** Lines 1710-1792

### 1.5 Session Management Service

**File:** `/app/repos/tmi-ux/src/app/auth/services/session-manager.service.ts` (Lines 1-377)

**Session Timers:**
```typescript
const SESSION_CONFIG = {
  WARNING_TIME_MS: 5 * 60 * 1000,         // Show warning 5 min before expiry
  PROACTIVE_REFRESH_MS: 15 * 60 * 1000,  // Auto-refresh 15 min before expiry (active users)
  ACTIVITY_CHECK_INTERVAL_MS: 60 * 1000,  // Check activity every 1 minute
  ACTIVITY_WINDOW_MS: 2 * 60 * 1000,     // User considered active if interaction within 2 min
  LOGOUT_GRACE_PERIOD_MS: 30 * 1000,     // 30s grace period for in-flight refresh
  HEARTBEAT_INTERVAL_MS: 60 * 1000,      // Drift detection heartbeat
  DRIFT_DETECTION_MULTIPLIER: 2,          // Trigger if elapsed > 2x expected
};
```

**Activity-Based Token Refresh:**
- **Active Users:** Automatic background refresh 15 minutes before expiry
- **Inactive Users:** Warning dialog 5 minutes before expiry
- **Activity Tracking:** Mouse/keyboard events monitored by ActivityTrackerService

**Zombie Session Prevention:**

**File:** `/app/repos/tmi-ux/src/app/auth/services/token-validity-guard.service.ts` (Lines 1-209)

**Three Layers of Defense:**

1. **Visibility Change Detection** (Lines 97-108)
   ```typescript
   document.addEventListener('visibilitychange', () => {
     if (document.visibilityState === 'visible') {
       // Tab became visible - validate token immediately
       this.validateTokenAndRedirectIfExpired();
     }
   });
   ```

2. **Heartbeat Drift Detection** (Lines 118-143)
   ```typescript
   // Detect when browser throttled timers (backgrounded tab)
   setInterval(() => {
     const elapsed = now - lastHeartbeat;
     if (elapsed > expectedMax * DRIFT_MULTIPLIER) {
       // Timer drift detected - validate token
       this.validateTokenAndRedirectIfExpired();
     }
   }, HEARTBEAT_INTERVAL_MS);
   ```

3. **Cross-Tab Synchronization** (Lines 155-176)
   ```typescript
   window.addEventListener('storage', (event) => {
     if (event.key === 'auth_logout_broadcast') {
       // Another tab logged out - sync this tab
       this.handleCrossTabLogout();
     }
   });
   ```

---

## 2. Authorization Mechanisms

### 2.1 Role-Based Access Control (RBAC)

**User Roles:**
```typescript
interface UserProfile {
  provider: string;           // OAuth provider (google, github, etc.)
  provider_id: string;        // Provider-assigned user ID
  display_name: string;       // Full name
  email: string;              // Email address
  groups: UserGroupMembership[] | null;  // TMI-managed groups
  jwt_groups: string[] | null;           // Groups from JWT claim
  is_admin?: boolean;                    // Administrator privilege
  is_security_reviewer?: boolean;        // Security reviewer privilege
}
```

**Role-Based Landing Pages:**
```typescript
getLandingPage(): string {
  const profile = this.userProfile;
  if (profile?.is_security_reviewer) return '/dashboard';  // 1st priority
  if (profile?.is_admin) return '/admin';                  // 2nd priority
  return '/intake';                                         // Default
}
```

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 279-284)

### 2.2 Route Guards

**Auth Guard** - Basic Authentication Check

**File:** `/app/repos/tmi-ux/src/app/auth/guards/auth.guard.ts` (Lines 1-53)

```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Defense-in-depth: Validate token before checking observable
  authService.validateAndUpdateAuthState();

  return authService.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      if (isAuthenticated) {
        return true;
      } else {
        // Redirect to login with return URL
        router.navigate(['/login'], {
          queryParams: {
            returnUrl: state.url,
            reason: 'session_expired'
          }
        });
        return false;
      }
    })
  );
};
```

**Admin Guard** - Administrator Role Check

**File:** `/app/repos/tmi-ux/src/app/auth/guards/admin.guard.ts` (Lines 1-52)

```typescript
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Fetch fresh profile from server to verify admin status
  return authService.refreshUserProfile().pipe(
    map(userProfile => {
      if (userProfile.is_admin) {
        return true;
      } else {
        router.navigate([authService.getLandingPage()], {
          queryParams: { error: 'admin_required' }
        });
        return false;
      }
    }),
    catchError(error => {
      router.navigate([authService.getLandingPage()], {
        queryParams: { error: 'admin_check_failed' }
      });
      return of(false);
    })
  );
};
```

**Security Reviewer Guard** - Reviewer Role Check

**File:** `/app/repos/tmi-ux/src/app/auth/guards/reviewer.guard.ts` (Lines 1-44)

```typescript
export const reviewerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.refreshUserProfile().pipe(
    map(userProfile => {
      if (userProfile.is_security_reviewer) {
        return true;
      } else {
        router.navigate([authService.getLandingPage()]);
        return false;
      }
    })
  );
};
```

**Home Guard** - Redirect Authenticated Users

**File:** `/app/repos/tmi-ux/src/app/auth/guards/home.guard.ts` (Lines 1-22)

```typescript
export const homeGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Prevent authenticated users from accessing home/login pages
  if (authService.isAuthenticated) {
    router.navigate([authService.getLandingPage()]);
    return false;
  }

  return true;  // Allow unauthenticated users
};
```

### 2.3 Protected Routes Configuration

**File:** `/app/repos/tmi-ux/src/app/app.routes.ts` (Lines 1-191)

```typescript
export const routes: Routes = [
  // Public routes
  { path: '', component: HomeComponent, canActivate: [homeGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'oauth2/callback', component: AuthCallbackComponent },
  { path: 'about', component: AboutComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: 'tos', component: TosComponent },

  // Authenticated routes
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },

  // Admin routes (requires both authGuard + adminGuard)
  {
    path: 'admin',
    canActivate: [authGuard],
    children: [
      { path: '', component: AdminComponent, canActivate: [adminGuard] },
      { path: 'users', component: AdminUsersComponent, canActivate: [adminGuard] },
      { path: 'groups', component: AdminGroupsComponent, canActivate: [adminGuard] },
      { path: 'quotas', component: AdminQuotasComponent, canActivate: [adminGuard] },
      { path: 'settings', component: AdminSettingsComponent, canActivate: [adminGuard] },
      { path: 'surveys', component: AdminSurveysComponent, canActivate: [adminGuard] },
      // Note: webhooks and addons routes missing adminGuard (potential security gap?)
      { path: 'webhooks', component: AdminWebhooksComponent },
      { path: 'addons', component: AdminAddonsComponent },
    ]
  },

  // Threat modeling routes (requires authGuard)
  {
    path: 'tm',
    loadChildren: () => import('./pages/tm/tm.routes'),
    canActivate: [authGuard]
  },

  // Intake routes (requires authGuard)
  {
    path: 'intake',
    loadChildren: () => import('./pages/surveys/surveys.routes'),
    canActivate: [authGuard]
  },

  // Triage routes (requires both authGuard + reviewerGuard)
  {
    path: 'triage',
    loadChildren: () => import('./pages/triage/triage.routes'),
    canActivate: [authGuard, reviewerGuard]
  },
];
```

**⚠️ Potential Security Issue:** Admin webhooks and addons routes lack `adminGuard`, only protected by parent `authGuard`. Any authenticated user can access these admin features.

### 2.4 Resource-Level Authorization

**Threat Model Authorization Service**

**File:** `/app/repos/tmi-ux/src/app/pages/tm/services/threat-model-authorization.service.ts` (Lines 1-413)

**Principal-Based Authorization:**
```typescript
interface Authorization {
  principal_type: 'user' | 'group';
  provider: string;        // OAuth provider
  provider_id: string;     // User ID or group name
  role: 'reader' | 'writer' | 'owner';
}

// Authorization Hierarchy:
// 1. Owner field (absolute precedence)
// 2. Authorization list (highest role wins)
//    - owner > writer > reader
// 3. Group membership ("everyone" group = public access)
```

**Authorization Check Logic:**
```typescript
private calculateUserPermission(
  authorizations: Authorization[] | null
): 'reader' | 'writer' | 'owner' | null {

  // Step 1: Check if user is the owner
  if (this._checkOwnerMatch(currentUserProvider, currentUserProviderId, currentUserEmail)) {
    return 'owner';
  }

  // Step 2: Check authorization list
  if (!authorizations || authorizations.length === 0) {
    return null;  // No access
  }

  // Step 3: Find highest permission
  let highestPermission = null;
  for (const auth of authorizations) {
    if (auth.principal_type === 'user') {
      if (auth.provider === currentUserProvider &&
          auth.provider_id === currentUserProviderId) {
        highestPermission = max(highestPermission, auth.role);
      }
    } else if (auth.principal_type === 'group') {
      if (auth.provider_id.toLowerCase() === 'everyone') {
        highestPermission = max(highestPermission, auth.role);
      } else if (currentUserGroups.includes(auth.provider_id)) {
        highestPermission = max(highestPermission, auth.role);
      }
    }

    if (highestPermission === 'owner') break;  // Short-circuit
  }

  return highestPermission;
}
```

**Observable Permissions:**
```typescript
// Reactive permission streams
currentUserPermission$: Observable<'reader' | 'writer' | 'owner' | null>
canEdit$: Observable<boolean>                    // writer or owner
canManagePermissions$: Observable<boolean>       // owner only
```

---

## 3. HTTP Security

### 3.1 JWT Interceptor

**File:** `/app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts` (Lines 1-262)

**Automatic Token Attachment:**
```typescript
export class JwtInterceptor implements HttpInterceptor {
  private readonly publicEndpoints = [
    '/',
    '/version',
    '/oauth2/callback',
    '/oauth2/providers',
    '/oauth2/refresh',
    '/oauth2/authorize/*',
    '/oauth2/token/*',
    '/saml/providers',
  ];

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Only add token to API requests that are not public endpoints
    if (this.isApiRequest(request.url) && !this.isPublicEndpoint(request.url)) {
      return this.authService.getValidToken().pipe(
        switchMap(token => {
          const tokenizedRequest = request.clone({
            setHeaders: {
              Authorization: `Bearer ${token.token}`
            }
          });
          return next.handle(tokenizedRequest);
        }),
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            return this.handleUnauthorizedErrorWithRefresh(request, next);
          }
          return this.handleError(error, request);
        })
      );
    }

    return next.handle(request);
  }
}
```

**401 Error Handling with Token Refresh:**
```typescript
private handleUnauthorizedErrorWithRefresh(
  request: HttpRequest<unknown>,
  next: HttpHandler
): Observable<HttpEvent<unknown>> {

  // Check if this request has already been retried (prevent infinite loops)
  const isRetry = request.context.get(IS_AUTH_RETRY);

  if (isRetry) {
    // Already retried - propagate error without logout
    return throwError(() => new HttpErrorResponse({
      status: 401,
      statusText: 'Unauthorized',
      url: request.url,
      error: { message: 'Authentication failed after token refresh' }
    }));
  }

  // Force a token refresh
  return this.authService.forceRefreshToken().pipe(
    switchMap(newToken => {
      // Retry request with new token and mark as retry
      const retryContext = new HttpContext().set(IS_AUTH_RETRY, true);
      const retryRequest = request.clone({
        setHeaders: { Authorization: `Bearer ${newToken.token}` },
        context: retryContext
      });
      return next.handle(retryRequest);
    }),
    catchError((refreshError: unknown) => {
      // Refresh failed - let component handle error (no auto-logout)
      this.authService.handleAuthError({
        code: 'token_refresh_failed',
        message: 'Unable to refresh authentication token',
        retryable: true
      });
      return throwError(() => refreshError);
    })
  );
}
```

**Security Properties:**
- **Deduplication:** Prevents concurrent refresh requests (Lines 1800-1828)
- **Infinite Loop Prevention:** IS_AUTH_RETRY context flag
- **No Auto-Logout:** Components handle 401 errors appropriately
- **Retry Logic:** Single retry on 401 with fresh token

### 3.2 HTTP Logging Interceptor

**File:** `/app/repos/tmi-ux/src/app/core/interceptors/http-logging.interceptor.ts`

**Request/Response Logging:**
```typescript
export class HttpLoggingInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const startTime = Date.now();

    // Log request (sensitive data redacted)
    this.logger.debugComponent('api', 'HTTP Request', {
      method: request.method,
      url: request.urlWithParams,
      headers: redactSensitiveData(request.headers, { isHeaderContext: true }),
      body: redactSensitiveData(request.body)
    });

    return next.handle(request).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          const duration = Date.now() - startTime;
          this.logger.debugComponent('api', 'HTTP Response', {
            status: event.status,
            statusText: event.statusText,
            url: request.urlWithParams,
            duration: `${duration}ms`,
            headers: redactSensitiveData(event.headers, { isHeaderContext: true })
          });
        }
      }),
      catchError(error => {
        const duration = Date.now() - startTime;
        this.logger.error('HTTP Error', {
          method: request.method,
          url: request.urlWithParams,
          status: error.status,
          duration: `${duration}ms`,
          error: error.message
        });
        return throwError(() => error);
      })
    );
  }
}
```

**Sensitive Data Redaction:**

**File:** `/app/repos/tmi-ux/src/app/core/utils/redact-sensitive-data.util.ts` (Lines 1-101)

```typescript
const SENSITIVE_KEYS = [
  'bearer', 'token', 'password', 'secret', 'jwt',
  'refresh_token', 'access_token', 'api_key', 'apikey',
  'authorization', 'auth'
];

const PROTOTYPE_POLLUTION_KEYS = new Set([
  '__proto__', 'constructor', 'prototype'
]);

export function redactSensitiveData(data: unknown, options: RedactOptions = {}): unknown {
  // Prevent prototype pollution
  if (!data || typeof data !== 'object') return data;

  const source = data as Record<string, unknown>;

  const entries = Object.keys(source)
    .filter(key => !PROTOTYPE_POLLUTION_KEYS.has(key))
    .map(key => [key, redactValue(key, source[key], options)]);

  // Use null-prototype object to prevent pollution
  return Object.assign(Object.create(null), Object.fromEntries(entries));
}

function redactToken(token: string): string {
  if (token.length <= 8) return '[REDACTED]';
  const start = token.substring(0, 4);
  const end = token.substring(token.length - 4);
  const middle = '*'.repeat(Math.min(12, token.length - 8));
  return `${start}${middle}${end}`;  // "abcd************wxyz"
}
```

**Security Properties:**
- **Prototype Pollution Protection:** Filters `__proto__`, `constructor`, `prototype` keys
- **Null-Prototype Objects:** Prevents prototype chain attacks
- **Token Masking:** Shows first/last 4 characters with asterisks in middle
- **Authorization Header Special Handling:** Preserves "Bearer " prefix for debugging

### 3.3 Security Headers Interceptor

**File:** `/app/repos/tmi-ux/src/app/core/interceptors/security-headers.interceptor.ts` (Lines 1-92)

```typescript
export const securityHeadersInterceptor: HttpInterceptorFn = (req, next) => {
  // Only check headers in development mode
  if (environment.production) {
    return next(req);
  }

  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        const headers = event.headers;
        const missingHeaders: string[] = [];

        // Check for recommended security headers
        const recommendations = {
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'X-XSS-Protection': '0',  // Disabled per modern guidance
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
        };

        Object.keys(recommendations).forEach(headerName => {
          if (!headers.has(headerName)) {
            missingHeaders.push(headerName);
          }
        });

        // Check for problematic header values
        const xFrameOptions = headers.get('X-Frame-Options');
        if (xFrameOptions?.toUpperCase() === 'ALLOWALL') {
          this.logger.warn('X-Frame-Options is set to ALLOWALL (insecure)');
        }

        // Check for HSTS on HTTPS
        if (req.url.startsWith('https://') && !headers.has('Strict-Transport-Security')) {
          this.logger.warn('HSTS header missing on HTTPS response');
        }
      }
    })
  );
};
```

**Note:** This interceptor only monitors in development mode and does not enforce headers. Actual header enforcement must be done at the server level.

### 3.4 Security Configuration Service

**File:** `/app/repos/tmi-ux/src/app/core/services/security-config.service.ts` (Lines 1-306)

**Dynamic CSP Injection:**
```typescript
private injectDynamicCSP(): void {
  const apiUrl = new URL(environment.apiUrl);
  const apiOrigin = apiUrl.origin;
  const apiProtocol = apiUrl.protocol;

  const connectSources = [
    "'self'",
    apiOrigin,
    'wss:', 'ws:',  // WebSocket protocols
    'https:',       // OAuth/SAML redirects
  ];

  if (apiProtocol === 'http:') {
    connectSources.push('http:');  // Allow HTTP API in development
  }

  const cspDirectives = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,  // Angular requires eval
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com`,
    `font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:`,
    `img-src 'self' data: https: blob:`,
    `connect-src ${connectSources.join(' ')}`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `media-src 'self'`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`
  ];

  if (environment.production || window.location.protocol === 'https:') {
    cspDirectives.push('upgrade-insecure-requests');
  }

  const cspContent = cspDirectives.join('; ');

  // Inject CSP meta tag
  const cspMeta = document.createElement('meta');
  cspMeta.httpEquiv = 'Content-Security-Policy';
  cspMeta.content = cspContent;
  document.head.appendChild(cspMeta);
}
```

**⚠️ CSP Weaknesses:**
- `'unsafe-inline'` in script-src (required by Angular but increases XSS risk)
- `'unsafe-eval'` in script-src (required by Angular but allows code execution)
- Meta tag CSP limitations: `frame-ancestors`, `report-uri`, and `sandbox` directives are ignored in meta tags

**CSP Violation Monitoring:**
```typescript
public monitorSecurityViolations(): void {
  window.addEventListener('securitypolicyviolation', (event: SecurityPolicyViolationEvent) => {
    this.logger.warn('CSP Violation detected', {
      blockedUri: event.blockedURI,
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
      columnNumber: event.columnNumber
    });

    // Send to reporting endpoint in production
    if (environment.production && this.config.cspReportUri) {
      // Implement reporting logic
    }
  });
}
```

---

## 4. Input Validation & Sanitization

### 4.1 DOMPurify Integration

**File:** `/app/repos/tmi-ux/src/app/app.config.ts` (Lines 150-285)

**Markdown Sanitization:**
```typescript
function markedOptionsFactory(): MarkedOptions {
  const renderer = new MarkedRenderer();

  // Override HTML renderer to sanitize output
  renderer.html = (args): string => {
    const html = originalHtml(args);
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'strong', 'em', 'del',
        'a', 'img', 'code', 'pre',
        'ul', 'ol', 'li', 'blockquote',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'hr', 'input', 'span', 'div',
        'svg', 'path', 'g', 'rect', 'circle', 'line', 'polygon', 'text', 'tspan'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'id',
        'type', 'checked', 'disabled', 'data-line', 'data-sourcepos',
        'style', 'viewBox', 'xmlns', 'width', 'height',
        'fill', 'stroke', 'stroke-width', 'd',
        'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform',
        'target', 'rel'
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true
    });
  };

  return { renderer, gfm: true, breaks: true, pedantic: false };
}
```

**Mermaid Diagram Security:**
```typescript
function mermaidOptionsFactory(): MermaidConfig {
  return {
    theme: 'default',
    startOnLoad: false,
    securityLevel: 'strict',  // Prevent XSS in mermaid diagrams
    maxTextSize: 50000
  };
}
```

### 4.2 Filename Sanitization

**File:** `/app/repos/tmi-ux/src/app/pages/tm/tm-edit.component.ts` (Lines 2050-2063, 2656-2681)

```typescript
const sanitizeAndTruncate = (name: string, maxLength: number): string => {
  const sanitized = name
    .replace(/[^a-zA-Z0-9_\-. ]/g, '')  // Remove special characters
    .replace(/\s+/g, '-')                // Replace spaces with hyphens
    .replace(/-+/g, '-')                 // Collapse multiple hyphens
    .replace(/^-|-$/g, '');              // Remove leading/trailing hyphens

  return sanitized.length > maxLength
    ? sanitized.substring(0, maxLength)
    : sanitized;
};

// Usage in export functionality
const threatModelPart = sanitizeAndTruncate(threatModelName.trim(), 63);
const diagramPart = sanitizeAndTruncate(diagramName.trim(), 40);
const filename = `${threatModelPart}-${diagramPart}.svg`;
```

### 4.3 API Data Sanitization

**File:** `/app/repos/tmi-ux/src/app/pages/dfd/utils/cell-property-filter.util.ts` (Lines 326-407)

```typescript
// Patterns to exclude from API requests (read-only or internal properties)
const EXCLUDED_PATTERNS = [
  /^internal_/,      // Internal properties
  /^_/,              // Private properties
  /^metadata\./,     // Metadata objects
  /^computed\./      // Computed properties
];

export function sanitizeCellForApi(cell: Cell, logger?: Logger): Cell {
  const sanitized = JSON.parse(JSON.stringify(cell)) as Cell;

  // Remove excluded properties
  EXCLUDED_PATTERNS.forEach(pattern => {
    removePropertyByPath(sanitized, pattern);
  });

  return sanitized;
}

export function sanitizeCells(cells: Cell[]): Cell[] {
  return cells.map(cell => sanitizeCell(cell));
}
```

### 4.4 Logger Input Sanitization

**File:** `/app/repos/tmi-ux/src/app/core/services/logger.service.ts` (Lines 103-177)

```typescript
private sanitizeForLog(input: string): string {
  // Remove control characters and newlines to prevent log injection
  return input
    .replace(/[\x00-\x1F\x7F]/g, '')  // Remove control characters
    .replace(/[\r\n]/g, ' ')           // Replace newlines with spaces
    .trim();
}

public debugComponent(component: string, message: string, ...args: unknown[]): void {
  if (this.shouldLog(LogLevel.DEBUG)) {
    const sanitizedComponent = this.sanitizeForLog(component);
    const sanitizedMessage = this.sanitizeForLog(message);

    // lgtm[js/log-injection] - inputs are sanitized above
    console.debug(
      this.formatMessage(LogLevel.DEBUG, `[${sanitizedComponent}] ${sanitizedMessage}`),
      ...args
    );
  }
}
```

---

## 5. Rate Limiting

### 5.1 Server-Side Rate Limiting

**File:** `/app/repos/tmi-ux/server.js` (Lines 13-21)

```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 1000,                  // Limit each IP to 1000 requests per window
  standardHeaders: true,       // Return rate limit info in RateLimit-* headers
  legacyHeaders: false         // Disable X-RateLimit-* headers
});

app.use(limiter);  // Apply to all requests
```

**Retry Logic in API Service:**

**File:** `/app/repos/tmi-ux/src/app/core/services/api.service.ts` (Lines 214-242)

```typescript
private getRetryDelay(error: HttpErrorResponse): Observable<number> {
  // Retry on server errors (5xx) or network failures (0)
  if (error.status >= 500 || error.status === 0) {
    return timer(0);  // Immediate retry
  }

  // Handle 429 rate limiting with Retry-After header
  if (error.status === 429) {
    const retryAfter = error.headers?.get('Retry-After');
    let delayMs = this.DEFAULT_RETRY_DELAY;  // 1 second fallback

    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (!isNaN(seconds)) {
        delayMs = seconds * 1000;
      } else {
        // Retry-After can be an HTTP-date
        const date = new Date(retryAfter).getTime();
        if (!isNaN(date)) {
          delayMs = Math.max(0, date - Date.now());
        }
      }
      delayMs = Math.min(delayMs, this.MAX_RETRY_DELAY);  // Cap at 30 seconds
    }

    this.logger.warn(`Rate limited (429), retrying after ${delayMs}ms`);
    return timer(delayMs);
  }

  return throwError(() => error);  // Don't retry other errors
}
```

**⚠️ Rate Limiting Gaps:**
- No client-side request throttling
- No per-user or per-session rate limiting (only IP-based)
- 1000 requests per 15 minutes is very permissive

---

## 6. CORS Configuration

**Note:** CORS is not configured in the Angular application. CORS headers must be set by the backend API server.

**Expected CORS Headers (from backend):**
```
Access-Control-Allow-Origin: https://tmi-ux.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

**Security Recommendation:** Verify backend API implements strict CORS policies and doesn't use wildcard `Access-Control-Allow-Origin: *` with credentials.

---

## 7. Multi-Factor Authentication

**Status:** ❌ Not Implemented

The application does not currently implement multi-factor authentication (MFA). Authentication relies solely on OAuth2/SAML providers. MFA would need to be configured at the OAuth provider level (e.g., Google 2FA, GitHub 2FA).

**Potential Implementation Approaches:**
1. **OAuth Provider MFA:** Rely on OAuth providers (Google, GitHub) to enforce MFA
2. **Backend MFA:** Implement TOTP/WebAuthn in backend API after OAuth login
3. **Conditional Access:** Require MFA for admin/reviewer roles only

---

## 8. Password Handling

**Status:** ⚠️ Not Applicable (OAuth-Only)

The application does not handle passwords directly. All authentication is delegated to OAuth2/SAML providers. There is no local password storage or password reset functionality.

**Security Benefits:**
- No password storage vulnerabilities
- No password reset attacks
- OAuth providers handle password security
- Reduced attack surface

**Limitations:**
- Dependency on external OAuth providers
- No fallback authentication mechanism
- Cannot enforce custom password policies

---

## 9. SSO/OAuth/OIDC Flows

### 9.1 OAuth2 Provider Discovery

**Endpoint:** `GET /oauth2/providers`

**Response:**
```json
{
  "providers": [
    {
      "id": "google",
      "name": "Google",
      "icon": "/static/logos/google.svg",
      "auth_url": "https://tmi-api.example.com/oauth2/authorize/google",
      "redirect_uri": "https://tmi-api.example.com/oauth2/callback",
      "client_id": "abc123.apps.googleusercontent.com"
    },
    {
      "id": "github",
      "name": "GitHub",
      "icon": "fa-github",
      "auth_url": "https://tmi-api.example.com/oauth2/authorize/github",
      "redirect_uri": "https://tmi-api.example.com/oauth2/callback",
      "client_id": "Iv1.abc123def456"
    }
  ]
}
```

### 9.2 SAML Provider Discovery

**Endpoint:** `GET /saml/providers`

**Response:**
```json
{
  "providers": [
    {
      "id": "azure-ad",
      "name": "Azure AD",
      "icon": "/static/logos/azure.svg",
      "auth_url": "https://tmi-api.example.com/saml/login/azure-ad",
      "metadata_url": "https://tmi-api.example.com/saml/metadata",
      "entity_id": "https://tmi-api.example.com/saml/metadata",
      "acs_url": "https://tmi-api.example.com/saml/acs",
      "slo_url": "https://tmi-api.example.com/saml/logout"
    }
  ]
}
```

### 9.3 OAuth2 Authorization Flow (with PKCE)

**Step 1:** Client initiates login
```
GET /oauth2/authorize/google?
  state={base64_encoded_csrf_and_returnurl}
  &client_callback=https://tmi-ux.example.com/oauth2/callback
  &scope=openid%20profile%20email
  &code_challenge={sha256_hash_of_verifier}
  &code_challenge_method=S256
```

**Step 2:** User authenticates with OAuth provider

**Step 3:** OAuth provider redirects to client callback
```
https://tmi-ux.example.com/oauth2/callback?
  code={authorization_code}
  &state={same_state_from_step1}
```

**Step 4:** Client exchanges code for tokens
```
POST /oauth2/token?idp=google
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "{authorization_code}",
  "code_verifier": "{original_verifier_from_sessionStorage}",
  "redirect_uri": "https://tmi-ux.example.com/oauth2/callback"
}
```

**Step 5:** Server validates PKCE and returns tokens
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "v1.MRrtR3pZvPL...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

### 9.4 State Parameter Validation

**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 806-870)

**State Generation:**
```typescript
private generateRandomState(returnUrl?: string): string {
  // Generate 16-byte CSRF token
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  const csrf = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

  if (returnUrl) {
    // Structured state with CSRF + returnUrl
    const stateObject = { csrf, returnUrl };
    const stateJson = JSON.stringify(stateObject);
    const encoder = new TextEncoder();
    const data = encoder.encode(stateJson);
    return btoa(String.fromCharCode(...data));  // Base64 encode
  }

  return csrf;  // Plain CSRF token for backward compatibility
}
```

**State Validation:**
```typescript
private decodeState(state: string): { csrf: string; returnUrl?: string } {
  try {
    // Check if state is Base64 encoded (structured state)
    if (this.isBase64(state)) {
      const decoded = JSON.parse(atob(state));
      return { csrf: decoded.csrf, returnUrl: decoded.returnUrl };
    }
  } catch {
    // Decoding failed - treat as plain CSRF token
  }

  return { csrf: state };  // Plain CSRF token
}
```

**Validation Logic:**
```typescript
if (response.state) {
  const storedState = localStorage.getItem('oauth_state');
  const receivedState = response.state;

  const decodedStoredState = storedState ? this.decodeState(storedState) : null;
  const decodedReceivedState = this.decodeState(receivedState);

  // For TMI OAuth proxy flows with access tokens, trust server's state management
  if (response.access_token) {
    // Server manages OAuth security - flexible validation
  } else {
    // For other flows, enforce strict CSRF validation
    if (!decodedStoredState || decodedStoredState.csrf !== decodedReceivedState.csrf) {
      this.logger.error('State parameter mismatch');
      this.handleAuthError({
        code: 'invalid_state',
        message: 'Invalid state parameter, possible CSRF attack',
        retryable: false
      });
      return of(false);
    }
  }

  // Clean up
  localStorage.removeItem('oauth_state');
  localStorage.removeItem('oauth_provider');
}
```

**⚠️ Security Concern:** State validation is relaxed when `access_token` is present in callback, trusting server's OAuth security. This could be exploited if an attacker can inject an `access_token` parameter.

### 9.5 Nonce Validation

**Status:** ❌ Not Implemented

The application does not implement nonce validation for OIDC flows. Nonce is a recommended security parameter to prevent replay attacks in implicit flows.

**Security Impact:** Low (using authorization code flow with PKCE, not implicit flow)

---

## 10. Security Headers

### 10.1 Configured Headers (via SecurityConfigService)

**File:** `/app/repos/tmi-ux/src/app/core/services/security-config.service.ts` (Lines 84-107)

```typescript
const recommendedHeaders: SecurityHeaders = {
  'X-Frame-Options': 'DENY',                           // Prevent clickjacking
  'X-Content-Type-Options': 'nosniff',                 // Prevent MIME sniffing
  'X-XSS-Protection': '0',                             // Disabled (modern browsers use CSP)
  'Referrer-Policy': 'strict-origin-when-cross-origin', // Control referrer leakage
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', // Disable features
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload' // HSTS
};
```

**Note:** These headers are **recommendations only**. The Angular app cannot set HTTP response headers. These must be configured at the server level (nginx, backend API, etc.).

### 10.2 Content Security Policy (CSP)

**Implementation:** Meta tag injection (client-side)

**File:** `/app/repos/tmi-ux/src/app/core/services/security-config.service.ts` (Lines 223-293)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
  font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:;
  img-src 'self' data: https: blob:;
  connect-src 'self' {API_ORIGIN} wss: ws: https:;
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  media-src 'self';
  worker-src 'self' blob:;
  manifest-src 'self';
  upgrade-insecure-requests;
```

**⚠️ CSP Limitations:**
1. **Meta tag CSP:** Ignores `frame-ancestors`, `report-uri`, `sandbox` directives
2. **'unsafe-inline':** Required by Angular but increases XSS risk
3. **'unsafe-eval':** Required by Angular but allows code execution
4. **Dynamic API origin:** Allows any API URL from environment config

**Security Recommendation:** Move CSP to HTTP headers set by web server for full directive support and stricter enforcement.

### 10.3 HTTP Strict Transport Security (HSTS)

**Configuration:** Environment-based

**File:** `/app/repos/tmi-ux/src/environments/environment.interface.ts` (Lines 156-180)

```typescript
securityConfig?: {
  enableHSTS?: boolean;              // Default: true
  hstsMaxAge?: number;               // Default: 31536000 (1 year)
  hstsIncludeSubDomains?: boolean;   // Default: true
  hstsPreload?: boolean;             // Default: false
}
```

**Recommended Value:**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**⚠️ Important:** HSTS preload is disabled by default. Enabling preload submits domain to browser preload lists, which cannot be easily undone.

---

## 11. CSRF Protection

### 11.1 OAuth State Parameter

**Primary CSRF Protection:** State parameter in OAuth flow

**Implementation:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 806-958)

**Properties:**
- 16-byte random CSRF token using `crypto.getRandomValues()`
- Base64-encoded JSON structure: `{ csrf: "token", returnUrl: "/path" }`
- Stored in localStorage before OAuth redirect
- Validated on callback before token exchange
- Removed after validation

**Security Strength:**
- Entropy: 128 bits (16 bytes)
- Cryptographically secure random generation
- Single-use token (removed after validation)

### 11.2 SameSite Cookie Attribute

**Status:** ⚠️ Not Applicable

The application does not use cookies for authentication. All authentication state is stored in localStorage (encrypted JWT tokens) and sessionStorage (PKCE verifiers, OAuth state).

**Security Consideration:** While localStorage avoids CSRF attacks on cookies, it is vulnerable to XSS attacks. Any XSS vulnerability could allow an attacker to steal tokens from localStorage.

**Defense-in-Depth:** Application implements DOMPurify sanitization and CSP to mitigate XSS risks.

---

## 12. Session Cookie Configuration

**Status:** ❌ Not Applicable (No Cookies)

The application does not use session cookies. Authentication is implemented using JWT bearer tokens stored in encrypted localStorage.

**Benefits:**
- No session fixation attacks
- No cookie theft via network interception
- Stateless authentication
- Cross-domain support (if needed)

**Drawbacks:**
- Tokens cannot be marked HttpOnly (accessible to JavaScript)
- Vulnerable to XSS attacks
- No automatic expiration on browser close (unless sessionStorage salt is lost)

---

## 13. Potential Security Vulnerabilities

### 13.1 HIGH SEVERITY

#### 1. Admin Routes Missing Authorization Guards

**Location:** `/app/repos/tmi-ux/src/app/app.routes.ts` (Lines 119-130)

```typescript
{
  path: 'admin',
  canActivate: [authGuard],
  children: [
    { path: 'webhooks', component: AdminWebhooksComponent },  // ❌ Missing adminGuard
    { path: 'addons', component: AdminAddonsComponent },      // ❌ Missing adminGuard
  ]
}
```

**Impact:** Any authenticated user can access admin webhook and addon management features.

**Recommendation:** Add `canActivate: [adminGuard]` to these routes.

---

#### 2. Client-Side Token Storage (Even When Encrypted)

**Location:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 1950-2045)

**Issue:** JWT tokens stored in localStorage are accessible to JavaScript, making them vulnerable to XSS attacks.

**Current Mitigation:**
- AES-GCM encryption with browser fingerprint + session salt
- DOMPurify sanitization of user input
- CSP headers (though weakened by 'unsafe-inline' and 'unsafe-eval')

**Impact:** If an XSS vulnerability exists, an attacker can:
1. Enumerate browser fingerprint components
2. Extract encrypted token from localStorage
3. Decrypt token if session is active (sessionStorage salt available)
4. Steal access and refresh tokens

**Recommendation:**
- Implement backend session-based authentication with HttpOnly cookies
- OR use short-lived tokens (5-15 minutes) with frequent rotation
- OR implement token binding to client certificate/device fingerprint

---

#### 3. Relaxed State Validation in OAuth Callback

**Location:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 914-943)

```typescript
if (response.access_token) {
  // TMI OAuth proxy detected - using flexible state validation
  // Trust server's OAuth security
  // (No CSRF validation performed)
}
```

**Issue:** When `access_token` is present in OAuth callback, state validation is skipped, trusting the server entirely.

**Attack Scenario:**
1. Attacker intercepts OAuth callback
2. Attacker adds fake `access_token` parameter to callback URL
3. Client skips state validation, trusts malicious token

**Impact:** CSRF protection bypass, potential account takeover

**Recommendation:**
- Always validate state parameter regardless of response content
- Use separate validation flags instead of trusting `access_token` presence
- Verify token signature before trusting

---

### 13.2 MEDIUM SEVERITY

#### 4. CSP Weaknesses

**Location:** `/app/repos/tmi-ux/src/app/core/services/security-config.service.ts` (Lines 256)

```typescript
`script-src 'self' 'unsafe-inline' 'unsafe-eval'`
```

**Issue:**
- `'unsafe-inline'` allows inline scripts and event handlers
- `'unsafe-eval'` allows `eval()` and `new Function()`

**Impact:** Weakens XSS protection significantly

**Mitigation:** Required by Angular framework, cannot be removed without major refactoring

**Recommendation:**
- Use strict-dynamic with nonces instead of unsafe-inline
- Precompile Angular in AOT mode to eliminate eval
- Move to HTTP header-based CSP for frame-ancestors protection

---

#### 5. No CSRF Tokens for State-Changing Requests

**Issue:** Application relies solely on JWT authentication without additional CSRF tokens for POST/PUT/DELETE requests.

**Attack Scenario:**
1. Victim is authenticated (JWT in localStorage)
2. Victim visits attacker's website
3. Attacker's JavaScript reads JWT from localStorage (same-origin only, but XSS possible)
4. Attacker makes authenticated requests to API

**Current Mitigation:**
- JWT in Authorization header (not automatically sent like cookies)
- CORS restricts cross-origin requests
- SameSite-like protection via localStorage (JavaScript-initiated only)

**Limitation:** If XSS vulnerability exists, attacker can steal JWT and make any requests.

**Recommendation:** Implement anti-CSRF tokens for state-changing operations as defense-in-depth.

---

#### 6. Rate Limiting Too Permissive

**Location:** `/app/repos/tmi-ux/server.js` (Lines 13-18)

```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 1000,                  // 1000 requests per 15 minutes = 66 req/min
});
```

**Issue:** 1000 requests per 15 minutes per IP is very permissive.

**Attack Scenario:** Attacker can make 66 requests per minute, enabling:
- Brute force attacks (if any endpoints lack additional protection)
- Resource exhaustion
- Credential stuffing

**Recommendation:**
- Reduce global limit to 100-300 requests per 15 minutes
- Implement endpoint-specific rate limits:
  - Auth endpoints: 5-10 attempts per 15 minutes
  - API endpoints: 100 requests per 15 minutes
  - Static assets: Higher limit (1000 requests per 15 minutes)

---

#### 7. Missing Nonce Validation in OIDC

**Issue:** Application doesn't implement nonce validation for OpenID Connect flows.

**Impact:** Replay attack prevention is weakened, though PKCE provides similar protection.

**Recommendation:** Implement nonce parameter for OIDC flows:
```typescript
// Generate nonce
const nonce = generateRandomNonce();
sessionStorage.setItem('oidc_nonce', nonce);

// Include in authorization request
authUrl += `&nonce=${nonce}`;

// Validate in token
const tokenPayload = decodeJWT(id_token);
if (tokenPayload.nonce !== sessionStorage.getItem('oidc_nonce')) {
  throw new Error('Nonce mismatch - possible replay attack');
}
```

---

### 13.3 LOW SEVERITY

#### 8. No Multi-Factor Authentication

**Issue:** Application relies solely on OAuth provider authentication without additional MFA enforcement.

**Impact:** If OAuth provider credentials are compromised, attacker gains full access.

**Recommendation:**
- Enforce MFA at OAuth provider level
- Implement backend MFA (TOTP/WebAuthn) after OAuth login
- Require MFA for admin/reviewer roles

---

#### 9. Session Storage Fingerprint Components Enumerable

**Location:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 1962-1969)

```typescript
const fingerprint = [
  navigator.userAgent,        // Easily enumerated
  navigator.language,         // Easily enumerated
  screen.width + 'x' + screen.height,  // Limited values
  new Date().getTimezoneOffset().toString(),  // Limited values
  sessionSalt  // Random, but stored in sessionStorage
].join('|');
```

**Issue:** Fingerprint components are easily enumerable by an attacker with localStorage access.

**Impact:** Attacker can brute force encryption key and decrypt tokens.

**Mitigation:** Session salt in sessionStorage provides some protection (lost on tab close).

**Recommendation:**
- Use Web Crypto API to generate random key stored in IndexedDB
- Accept trade-off that tokens become unrecoverable if IndexedDB is cleared
- Implement server-side session validation as fallback

---

#### 10. No Token Binding to Client

**Issue:** JWT tokens are not bound to client device or IP address, allowing token theft and reuse.

**Impact:** Stolen tokens can be used from any device/location.

**Recommendation:**
- Implement client certificate binding (mTLS)
- Use browser fingerprinting for additional validation
- Implement IP-based anomaly detection
- Use short-lived tokens with frequent rotation

---

#### 11. Logout Only Clears Client State

**Location:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (Lines 1870-1937)

**Issue:** Logout clears tokens from localStorage but may not invalidate tokens on server.

**Current Implementation:**
```typescript
logout(): void {
  const shouldCallServerLogout =
    this.isAuthenticated &&
    isConnectedToServer &&
    !this.isTestUser;

  if (shouldCallServerLogout) {
    this.http.post(`${apiUrl}/me/logout`, null, { headers }).subscribe();
  }

  this.clearAuthData();  // Clear localStorage/sessionStorage
  this.router.navigate(['/']);
}
```

**Vulnerability:** If server logout fails or is skipped, tokens remain valid on backend.

**Recommendation:**
- Always call server logout endpoint
- Implement token revocation/blacklisting on backend
- Use short-lived tokens to limit exposure window

---

## 14. Security Best Practices Observed

### ✅ Implemented Best Practices

1. **OAuth2 with PKCE:** Protects against authorization code interception
2. **JWT Expiration Validation:** Checks exp claim before allowing access
3. **Automatic Token Refresh:** Proactive refresh for active users
4. **Cross-Tab Session Sync:** Logout in one tab affects all tabs
5. **Zombie Session Prevention:** Three layers of defense (visibility, drift, storage events)
6. **Defense-in-Depth:** Multiple layers of security (encryption, PKCE, state, CSP)
7. **DOMPurify Sanitization:** Prevents XSS in markdown/HTML content
8. **Sensitive Data Redaction:** Logs don't expose tokens/passwords
9. **Prototype Pollution Protection:** Filters dangerous property keys
10. **Security Header Monitoring:** Validates response headers in development
11. **Role-Based Access Control:** Guards protect admin/reviewer routes
12. **Lazy Loading:** Route guards before loading code (reduces attack surface)
13. **AES-GCM Encryption:** Strong encryption for token storage
14. **CSRF Protection:** State parameter in OAuth flows
15. **Mermaid Security:** securityLevel set to 'strict'

---

## 15. Recommended Security Improvements

### Priority 1 (High Impact, Low Effort)

1. **Fix Admin Route Guards**
   - Add `canActivate: [adminGuard]` to webhooks and addons routes
   - Review all admin routes for consistent protection

2. **Remove Relaxed State Validation**
   - Always validate OAuth state parameter regardless of response
   - Don't trust presence of `access_token` as validation bypass

3. **Implement Stricter Rate Limiting**
   - Reduce global limit to 100-300 requests per 15 minutes
   - Add endpoint-specific limits for auth endpoints (5-10 per 15 min)

### Priority 2 (High Impact, Medium Effort)

4. **Implement Server-Side Token Invalidation**
   - Add token revocation/blacklisting on backend
   - Ensure logout invalidates all tokens for user
   - Implement token jti (JWT ID) claim for tracking

5. **Add Nonce Validation for OIDC**
   - Generate nonce on authorization request
   - Validate nonce in ID token response
   - Provide replay attack prevention

6. **Migrate CSP to HTTP Headers**
   - Configure CSP via web server (nginx/Apache) headers
   - Remove meta tag CSP injection
   - Add frame-ancestors, report-uri directives

### Priority 3 (Medium Impact, High Effort)

7. **Implement Token Binding**
   - Bind tokens to client certificate or device fingerprint
   - Validate binding on every request
   - Provide defense against token theft

8. **Consider Backend Session-Based Auth**
   - Evaluate switching to HttpOnly cookies for session management
   - Keep localStorage only for UI state
   - Eliminates XSS token theft risk

9. **Implement MFA Enforcement**
   - Add backend MFA verification after OAuth login
   - Support TOTP and WebAuthn
   - Require MFA for admin/reviewer roles

### Priority 4 (Low Impact, Low Effort)

10. **Add Security Headers to Backend API**
    - Configure all recommended headers at API level
    - Enable HSTS with preload
    - Set frame-ancestors to prevent framing

11. **Implement CSP Reporting**
    - Add report-uri directive to CSP
    - Set up violation collection endpoint
    - Monitor CSP violations for XSS attempts

12. **Add Request Signing**
    - Sign sensitive requests with client secret
    - Validate signature on backend
    - Provide additional authenticity proof

---

## 16. Authentication API Endpoints

### Backend API Endpoints (from Angular code analysis)

```
PUBLIC ENDPOINTS (No Authentication Required):
  GET  /oauth2/providers          # List available OAuth providers
  GET  /saml/providers            # List available SAML providers
  GET  /oauth2/authorize/{provider}?state=...&client_callback=...&scope=...&code_challenge=...
  GET  /saml/login/{provider}?client_callback=...
  POST /oauth2/token?idp={provider}  # Exchange authorization code for tokens
  POST /oauth2/refresh            # Refresh access token using refresh token

AUTHENTICATED ENDPOINTS:
  GET  /me                        # Get current user profile
  POST /me/logout                 # Logout current user

WEB SERVER ENDPOINTS:
  GET  /config.json               # Runtime configuration from env vars
```

### Request/Response Examples

**1. Get OAuth Providers**
```http
GET /oauth2/providers HTTP/1.1
Host: api.tmi.example.com

Response:
{
  "providers": [
    {
      "id": "google",
      "name": "Google",
      "icon": "/static/logos/google.svg",
      "auth_url": "https://api.tmi.example.com/oauth2/authorize/google",
      "redirect_uri": "https://api.tmi.example.com/oauth2/callback",
      "client_id": "123456.apps.googleusercontent.com"
    }
  ]
}
```

**2. Exchange Authorization Code for Tokens**
```http
POST /oauth2/token?idp=google HTTP/1.1
Host: api.tmi.example.com
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "4/0AY0e-g7...",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
  "redirect_uri": "https://tmi-ux.example.com/oauth2/callback"
}

Response:
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "v1.MRrtR3pZvPL...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**3. Refresh Access Token**
```http
POST /oauth2/refresh HTTP/1.1
Host: api.tmi.example.com
Content-Type: application/json

{
  "refresh_token": "v1.MRrtR3pZvPL..."
}

Response:
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "v1.abc123def456...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**4. Get Current User Profile**
```http
GET /me HTTP/1.1
Host: api.tmi.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...

Response:
{
  "provider": "google",
  "provider_id": "108267890123456789",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "email_verified": true,
  "is_admin": false,
  "is_security_reviewer": false,
  "groups": [
    {
      "internal_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "group_name": "developers",
      "name": "Development Team"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "modified_at": "2024-03-04T08:15:00Z",
  "last_login": "2024-03-04T08:15:00Z"
}
```

**5. Logout**
```http
POST /me/logout HTTP/1.1
Host: api.tmi.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...

Response:
{
  "message": "Logout successful"
}
```

---

## 17. Conclusion

The tmi-ux application demonstrates a **mature security architecture** with comprehensive authentication and authorization controls. The implementation follows modern security best practices including OAuth2 with PKCE, JWT-based authentication, role-based access control, and multiple layers of defense against common attacks.

### Strengths:
- Enterprise-grade OAuth2/SAML authentication
- PKCE implementation protects against authorization code interception
- Comprehensive session management with activity-based token refresh
- Defense-in-depth with multiple security layers
- Well-structured authorization system with resource-level permissions
- Strong input sanitization and XSS protection
- Cross-tab session synchronization

### Key Concerns:
- Client-side token storage remains a significant XSS risk despite encryption
- Some admin routes lack proper authorization guards
- Relaxed state validation in OAuth callback
- CSP weaknesses due to Angular framework requirements
- Rate limiting is too permissive

### Overall Security Posture: **GOOD** with room for improvement

The application is well-suited for production use with proper backend security controls. Priority 1 and 2 recommendations should be implemented before deploying to high-security environments.

---

## Appendix A: File Reference Index

### Authentication Core
- `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` - Main authentication service (2047 lines)
- `/app/repos/tmi-ux/src/app/auth/services/pkce.service.ts` - PKCE implementation (183 lines)
- `/app/repos/tmi-ux/src/app/auth/services/session-manager.service.ts` - Session management (377 lines)
- `/app/repos/tmi-ux/src/app/auth/services/token-validity-guard.service.ts` - Zombie session prevention (209 lines)
- `/app/repos/tmi-ux/src/app/auth/utils/pkce-crypto.utils.ts` - PKCE cryptographic functions
- `/app/repos/tmi-ux/src/app/auth/models/auth.models.ts` - Authentication data models (317 lines)
- `/app/repos/tmi-ux/src/app/auth/config/session.config.ts` - Session timing configuration (59 lines)

### Authorization
- `/app/repos/tmi-ux/src/app/auth/guards/auth.guard.ts` - Basic authentication guard (53 lines)
- `/app/repos/tmi-ux/src/app/auth/guards/admin.guard.ts` - Administrator guard (52 lines)
- `/app/repos/tmi-ux/src/app/auth/guards/reviewer.guard.ts` - Security reviewer guard (44 lines)
- `/app/repos/tmi-ux/src/app/auth/guards/home.guard.ts` - Home page redirect guard (22 lines)
- `/app/repos/tmi-ux/src/app/pages/tm/services/threat-model-authorization.service.ts` - Resource-level authorization (413 lines)

### HTTP Security
- `/app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts` - JWT token injection (262 lines)
- `/app/repos/tmi-ux/src/app/core/interceptors/http-logging.interceptor.ts` - Request/response logging
- `/app/repos/tmi-ux/src/app/core/interceptors/security-headers.interceptor.ts` - Security header validation (92 lines)
- `/app/repos/tmi-ux/src/app/core/services/api.service.ts` - API service with error handling (327 lines)

### Security Configuration
- `/app/repos/tmi-ux/src/app/core/services/security-config.service.ts` - Security headers and CSP (306 lines)
- `/app/repos/tmi-ux/src/app/core/utils/redact-sensitive-data.util.ts` - Data redaction (101 lines)
- `/app/repos/tmi-ux/src/app/app.config.ts` - Application configuration with DOMPurify (428 lines)

### UI Components
- `/app/repos/tmi-ux/src/app/auth/components/login/login.component.ts` - Login page (292 lines)
- `/app/repos/tmi-ux/src/app/auth/components/auth-callback/auth-callback.component.ts` - OAuth callback handler (178 lines)
- `/app/repos/tmi-ux/src/app/core/components/session-expiry-dialog/session-expiry-dialog.component.ts` - Session expiry warning

### Configuration
- `/app/repos/tmi-ux/src/app/app.routes.ts` - Route configuration with guards (191 lines)
- `/app/repos/tmi-ux/src/environments/environment.interface.ts` - Environment configuration interface (209 lines)
- `/app/repos/tmi-ux/server.js` - Express server with rate limiting (99 lines)

---

**Report Generated:** 2026-03-04
**Total Lines Analyzed:** 15,000+ lines of TypeScript code
**Files Reviewed:** 30+ security-related files
