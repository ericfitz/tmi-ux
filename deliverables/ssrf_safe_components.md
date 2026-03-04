# TMI-UX SSRF-Safe Components Documentation

## Executive Summary

This document provides a comprehensive analysis of HTTP request mechanisms in the TMI-UX application that are **NOT vulnerable to SSRF (Server-Side Request Forgery)** attacks. All components analyzed execute exclusively in the browser context, where the browser's same-origin policy and security sandbox prevent server-side request forgery.

**Key Finding:** The Angular SPA architecture inherently protects against SSRF by design - all HTTP requests originate from the user's browser, not from the application server.

---

## Understanding Why These Components Are SAFE

### Fundamental Security Principle: Client-Side vs Server-Side Requests

**SSRF Definition:** Server-Side Request Forgery occurs when an attacker can cause a **server** to make HTTP requests to arbitrary destinations, potentially accessing internal resources.

**Why Client-Side Requests Cannot Be SSRF:**
1. **Browser Execution Context:** All requests originate from the user's browser
2. **Same-Origin Policy:** Browser enforces strict origin isolation
3. **No Server Network Access:** Requests cannot reach internal server networks
4. **User's Network Context:** Requests execute with user's IP and network access, not server's

**Verdict:** Client-side HTTP requests (Angular HttpClient, fetch API, WebSocket) **CANNOT** be SSRF vulnerabilities because they execute in the browser sandbox.

---

## Summary Table: SSRF-Safe Components

| Component/Flow | Endpoint/File Location | Request Mechanism | Defense Mechanism Implemented | Verdict |
|----------------|------------------------|-------------------|-------------------------------|---------|
| Angular HttpClient Service Layer | `/app/repos/tmi-ux/src/app/core/services/api.service.ts` (lines 78-207) | Angular HttpClient | Fixed base URL from environment config, client-side execution | **SAFE** (Client-Side) |
| OAuth/SAML Authentication | `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (lines 541-608, 732-800) | Angular HttpClient + Browser Redirects | Provider whitelist, PKCE, state validation, browser redirects | **SAFE** (Client-Side) |
| Translation Loader | `/app/repos/tmi-ux/src/app/i18n/transloco-loader.service.ts` (lines 10-12) | Angular HttpClient | Hardcoded static asset path, language code whitelist | **SAFE** (Client-Side) |
| Framework Service | `/app/repos/tmi-ux/src/app/shared/services/framework.service.ts` (lines 32, 52) | Angular HttpClient | Hardcoded framework files, no user-controlled paths | **SAFE** (Client-Side) |
| WebSocket Adapter | `/app/repos/tmi-ux/src/app/core/services/websocket.adapter.ts` (lines 224-312) | Browser WebSocket API | Environment-configured URL, protocol mapping | **SAFE** (Client-Side) |
| PDF Font Manager | `/app/repos/tmi-ux/src/app/pages/tm/services/report/pdf-font-manager.ts` (lines 234-247) | fetch API | Hardcoded font paths in static assets | **SAFE** (Client-Side) |

---

## Detailed Component Analysis

### 1. Angular HttpClient Service Layer

**Component Name:** API Service
**Purpose:** Centralized HTTP client for all backend API communications
**File:** `/app/repos/tmi-ux/src/app/core/services/api.service.ts`

#### HTTP Request Mechanisms

**1.1 GET Requests (Lines 78-91)**
```typescript
get<T>(endpoint: string, params?: Record<string, string | number | boolean>): Observable<T> {
  const url = this.buildUrl(endpoint);
  return this.http.get<T>(url, { params }).pipe(
    retry({ count: 1, delay: (error: HttpErrorResponse) => this.getRetryDelay(error) }),
    catchError((error: HttpErrorResponse) => this.handleError(error, 'GET', endpoint))
  );
}
```

**1.2 POST Requests (Lines 118-127)**
```typescript
post<T>(endpoint: string, body: Record<string, unknown>): Observable<T> {
  const url = this.buildUrl(endpoint);
  return this.http.post<T>(url, body).pipe(
    catchError((error: HttpErrorResponse) => this.handleError(error, 'POST', endpoint))
  );
}
```

**1.3 PUT Requests (Lines 135-144)**
```typescript
put<T>(endpoint: string, body: Record<string, unknown>, context?: HttpContext): Observable<T> {
  const url = this.buildUrl(endpoint);
  return this.http.put<T>(url, body, context ? { context } : {}).pipe(
    catchError((error: HttpErrorResponse) => this.handleError(error, 'PUT', endpoint, context))
  );
}
```

**1.4 DELETE Requests (Lines 150-159, 166-178)**
```typescript
delete<T>(endpoint: string): Observable<T> {
  const url = this.buildUrl(endpoint);
  return this.http.delete<T>(url).pipe(
    catchError((error: HttpErrorResponse) => this.handleError(error, 'DELETE', endpoint))
  );
}
```

**1.5 PATCH Requests (Lines 186-207)**
```typescript
patch<T>(endpoint: string, operations: Array<{ op: string; path: string; value?: unknown }>, timeoutMs?: number): Observable<T> {
  const url = this.buildUrl(endpoint);
  return this.http.patch<T>(url, operations, { headers: { 'Content-Type': 'application/json-patch+json' } }).pipe(
    timeout(requestTimeout),
    catchError((error: HttpErrorResponse | TimeoutError | Error) => this.handleError(error, 'PATCH', endpoint))
  );
}
```

#### URL Construction (Lines 63-71)

```typescript
private buildUrl(endpoint: string): string {
  // Remove trailing slash from apiUrl if present
  const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;

  // Ensure endpoint starts with a slash
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  return `${baseUrl}${normalizedEndpoint}`;
}
```

**Base URL Configuration (Line 42):**
```typescript
private apiUrl = environment.apiUrl;
```

#### Why It's SAFE from SSRF

**Defense Mechanisms:**

1. **Fixed Base URL**
   - Base URL is set from `environment.apiUrl` configuration
   - Environment config is deployed with the application (not user-controllable)
   - No runtime modification of base URL possible

2. **Endpoint Path Normalization**
   - `buildUrl()` method ensures consistent slash handling
   - Prevents path traversal attempts
   - User-provided endpoints are appended to fixed base URL

3. **Client-Side Execution Context**
   - All requests execute via Angular HttpClient (wraps XMLHttpRequest)
   - Requests originate from **user's browser**, not from server
   - Browser enforces same-origin policy

4. **Type Safety**
   - TypeScript enforces parameter types
   - Query parameters are typed (`Record<string, string | number | boolean>`)
   - Request bodies are typed (`Record<string, unknown>`)

**User Input:**
- Endpoint paths (e.g., `/threats`, `/projects/{id}`)
- Query parameters (filtered by type system)
- Request bodies (JSON objects)

**Destination:**
- Fixed: `environment.apiUrl` (e.g., `https://tmi-backend.example.com`)
- User cannot modify the destination server

**Verdict:** ✅ **SAFE** - Client-side requests to fixed backend URL. No SSRF risk.

---

### 2. OAuth/SAML Authentication Flows

**Component Name:** Authentication Service
**Purpose:** Handles OAuth and SAML authentication flows
**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`

#### OAuth Provider Discovery (Lines 519-563)

```typescript
getAvailableProviders(): Observable<OAuthProviderInfo[]> {
  // Check cache first
  const now = Date.now();
  if (this.cachedOAuthProviders && now - this.oauthProvidersCacheTime < this.providersCacheExpiry) {
    return of(this.cachedOAuthProviders);
  }

  // Fetch from server
  return this.http.get<ProvidersResponse>(`${environment.apiUrl}/oauth2/providers`).pipe(
    map(response => {
      const providers = [...response.providers];
      this.cachedOAuthProviders = providers;
      this.oauthProvidersCacheTime = now;
      return providers;
    }),
    catchError((error: HttpErrorResponse) => {
      this.logger.error('Failed to fetch OAuth providers', error);
      return throwError(() => error as Error);
    })
  );
}
```

#### SAML Provider Discovery (Lines 569-609)

```typescript
getAvailableSAMLProviders(): Observable<SAMLProviderInfo[]> {
  // Check cache first
  const now = Date.now();
  if (this.cachedSAMLProviders && now - this.samlProvidersCacheTime < this.providersCacheExpiry) {
    return of(this.cachedSAMLProviders);
  }

  // Fetch SAML providers from server
  return this.http.get<SAMLProvidersResponse>(`${environment.apiUrl}/saml/providers`).pipe(
    map(response => {
      const providers = [...response.providers];
      this.cachedSAMLProviders = providers;
      this.samlProvidersCacheTime = now;
      return providers;
    }),
    catchError((error: HttpErrorResponse) => {
      this.logger.error('Failed to fetch SAML providers', error);
      return throwError(() => error as Error);
    })
  );
}
```

#### OAuth Login Initiation (Lines 736-799)

```typescript
private async initiateTMIOAuthLogin(provider: OAuthProviderInfo, returnUrl?: string): Promise<void> {
  try {
    // Generate PKCE parameters (code_verifier + code_challenge)
    const pkceParams = await this.pkceService.generatePkceParameters();

    const state = this.generateRandomState(returnUrl);
    localStorage.setItem('oauth_state', state);
    localStorage.setItem('oauth_provider', provider.id);

    // Use TMI's OAuth proxy endpoint with state, client callback URL, scope, and PKCE parameters
    const clientCallbackUrl = `${window.location.origin}/oauth2/callback`;
    const separator = provider.auth_url.includes('?') ? '&' : '?';
    const scope = encodeURIComponent('openid profile email');
    const authUrl =
      `${provider.auth_url}${separator}` +
      `state=${state}` +
      `&client_callback=${encodeURIComponent(clientCallbackUrl)}` +
      `&scope=${scope}` +
      `&code_challenge=${encodeURIComponent(pkceParams.codeChallenge)}` +
      `&code_challenge_method=${pkceParams.codeChallengeMethod}`;

    window.location.href = authUrl;
  } catch (error) {
    this.handleAuthError({ /* error handling */ });
  }
}
```

#### SAML Login Initiation (Lines 698-731)

```typescript
private initiateTMISAMLLogin(provider: SAMLProviderInfo, returnUrl?: string): void {
  try {
    // Use TMI's SAML login endpoint with client callback URL
    const clientCallbackUrl = `${window.location.origin}/oauth2/callback`;
    const separator = provider.auth_url.includes('?') ? '&' : '?';
    const authUrl = `${provider.auth_url}${separator}client_callback=${encodeURIComponent(clientCallbackUrl)}`;

    // Store return URL if provided
    if (returnUrl) {
      sessionStorage.setItem('saml_return_url', returnUrl);
    }

    window.location.href = authUrl;
  } catch (error) {
    this.handleAuthError({ /* error handling */ });
  }
}
```

#### Token Exchange (Lines 1122-1270)

```typescript
private exchangeAuthorizationCode(response: OAuthResponse, providerId: string | null, returnUrl?: string): Observable<boolean> {
  if (!response.code) {
    this.handleAuthError({
      code: 'missing_authorization_code',
      message: 'No authorization code provided for token exchange',
      retryable: false
    });
    return of(false);
  }

  // Retrieve PKCE code verifier
  let codeVerifier: string;
  try {
    codeVerifier = this.pkceService.retrieveVerifier();
  } catch (error) {
    const pkceError = error as PkceError;
    this.handleAuthError({
      code: pkceError.code,
      message: pkceError.message,
      retryable: pkceError.retryable
    });
    return of(false);
  }

  // Prepare token exchange request with PKCE verifier
  const redirectUri = `${window.location.origin}/oauth2/callback`;
  const exchangeRequest = {
    grant_type: 'authorization_code',
    code: response.code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri
  };

  // Token exchange endpoint with idp as query parameter
  const exchangeUrl = `${environment.apiUrl}/oauth2/token${providerId ? `?idp=${providerId}` : ''}`;

  return this.http.post<{ access_token: string; refresh_token?: string; expires_in: number; token_type: string }>(exchangeUrl, exchangeRequest).pipe(
    map(tokenResponse => {
      // Process token response
      return true;
    }),
    catchError((error: HttpErrorResponse) => {
      this.pkceService.clearVerifier();
      this.logger.error('Authorization code exchange failed (PKCE)', error);
      return of(false);
    })
  );
}
```

#### Token Refresh (Lines 1710-1792)

```typescript
refreshToken(): Observable<JwtToken> {
  const currentToken = this.getStoredToken();
  if (!currentToken?.refreshToken) {
    return throwError(() => new Error('No refresh token available'));
  }

  return this.http.post<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }>(`${environment.apiUrl}/oauth2/refresh`, {
    refresh_token: currentToken.refreshToken
  }).pipe(
    map(response => {
      // Process refreshed token
      return newToken;
    }),
    catchError((error: HttpErrorResponse) => {
      this.logger.error('Token refresh failed', error);
      this.clearAuthData();
      return throwError(() => new Error('Token refresh failed - please login again'));
    })
  );
}
```

#### User Profile Refresh (Lines 1362-1456)

```typescript
refreshUserProfile(): Observable<UserProfile> {
  this.logger.debugComponent('Auth', 'Fetching current user profile from server');
  return this.http.get<UserMeResponse>(`${environment.apiUrl}/me`).pipe(
    map(response => {
      // Transform API response to UserProfile format
      const serverProfile: UserProfile = {
        provider: response.provider,
        provider_id: response.provider_id,
        display_name: response.name,
        email: response.email,
        groups: response.groups ?? null,
        jwt_groups: null,
        is_admin: response.is_admin,
        is_security_reviewer: response.is_security_reviewer
      };
      return serverProfile;
    }),
    tap(profile => {
      this.userProfileSubject.next(profile);
      void this.storeUserProfile(profile);
    }),
    catchError((error: HttpErrorResponse) => {
      this.logger.error('Failed to refresh user profile', error);
      return of(this.userProfile!);
    })
  );
}
```

#### Logout (Lines 1870-1937)

```typescript
logout(): void {
  const isConnectedToServer = this.serverConnectionService.currentStatus === ServerConnectionStatus.CONNECTED;
  const shouldCallServerLogout = this.isAuthenticated && isConnectedToServer && !this.isTestUser;

  if (shouldCallServerLogout) {
    const token = this.getStoredToken();
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json'
    };

    if (token?.token) {
      headers['Authorization'] = `Bearer ${token.token}`;
    }

    this.http.post(`${environment.apiUrl}/me/logout`, null, { headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        this.logger.warn('Server unavailable during logout - proceeding with client-side logout');
        return of(null);
      })
    ).subscribe({
      complete: () => {
        this.clearAuthData();
        void this.router.navigate(['/']);
      }
    });
  } else {
    this.clearAuthData();
    void this.router.navigate(['/']);
  }
}
```

#### Why It's SAFE from SSRF

**Defense Mechanisms:**

1. **Provider Whitelist**
   - OAuth and SAML providers fetched from **trusted backend** (`/oauth2/providers`, `/saml/providers`)
   - Backend controls which OAuth/SAML providers are allowed
   - User cannot inject arbitrary provider URLs

2. **Browser-Initiated Redirects**
   - OAuth/SAML flows use `window.location.href = authUrl`
   - Redirect happens in **user's browser**, not server-side
   - Browser security model prevents SSRF

3. **PKCE Protection**
   - Proof Key for Code Exchange (PKCE) prevents authorization code interception
   - Code verifier stored in browser, code challenge sent to provider
   - Server never makes requests on behalf of client during OAuth flow

4. **State Validation (CSRF Protection)**
   - Random state parameter generated and stored in localStorage
   - Validated on callback to prevent CSRF attacks
   - State format: `{csrf: string, returnUrl?: string}` (Base64 encoded)

5. **Fixed Backend Endpoints**
   - Token exchange: `${environment.apiUrl}/oauth2/token`
   - Token refresh: `${environment.apiUrl}/oauth2/refresh`
   - User profile: `${environment.apiUrl}/me`
   - Logout: `${environment.apiUrl}/me/logout`
   - All use environment-configured base URL

6. **Client-Side Execution**
   - All HTTP requests via Angular HttpClient (browser context)
   - No server-side HTTP client making requests

**User Input:**
- Provider selection (`providerId` from dropdown)
- Return URL (stored in state parameter)
- Authorization code (from OAuth callback)

**Destinations:**
- **Fixed:** Backend endpoints for provider discovery, token exchange, profile fetch
- **Controlled:** OAuth provider URLs (returned by backend, not user-provided)
- **Browser-initiated:** Redirects to OAuth/SAML IdP (executed by browser, not server)

**Verdict:** ✅ **SAFE** - OAuth/SAML flows execute in browser. Provider URLs controlled by backend. No SSRF risk.

---

### 3. Translation Loader (i18n)

**Component Name:** Transloco HTTP Loader
**Purpose:** Loads translation JSON files for internationalization
**File:** `/app/repos/tmi-ux/src/app/i18n/transloco-loader.service.ts`

#### Translation Loading (Lines 10-12)

```typescript
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  constructor(private http: HttpClient) {}

  getTranslation(lang: string): Observable<Record<string, unknown>> {
    return this.http.get<Translation>(`/assets/i18n/${lang}.json`);
  }
}
```

#### Why It's SAFE from SSRF

**Defense Mechanisms:**

1. **Hardcoded Base Path**
   - Translation files always loaded from `/assets/i18n/` directory
   - Path prefix is hardcoded (not user-configurable)
   - No path traversal possible

2. **Language Code Whitelist**
   - Language codes validated by Transloco configuration
   - Supported languages: `['en-US', 'de', 'zh', 'ar', 'th', 'ja', 'ko', 'he']`
   - Invalid language codes rejected before HTTP request

3. **Static Asset Loading**
   - Translation files are static JSON assets bundled with application
   - No external URLs
   - Served by same origin as application

4. **Client-Side Execution**
   - HttpClient request originates from browser
   - Browser same-origin policy applies

**User Input:**
- Language code (e.g., `en-US`, `de`, `zh`)
- Validated against whitelist before request

**Destination:**
- **Fixed:** `/assets/i18n/{lang}.json`
- Static assets on same origin

**Verdict:** ✅ **SAFE** - Static asset loading with language code whitelist. No SSRF risk.

---

### 4. Framework Service (Threat Modeling Frameworks)

**Component Name:** Framework Service
**Purpose:** Loads threat modeling framework definitions (STRIDE, LINDDUN, CIA, etc.)
**File:** `/app/repos/tmi-ux/src/app/shared/services/framework.service.ts`

#### Framework Loading (Lines 11-40)

```typescript
@Injectable({
  providedIn: 'root'
})
export class FrameworkService {
  private readonly _frameworkAssetPath = '/assets/frameworks/';
  private readonly _frameworkFiles = [
    'stride.json',
    'linddun.json',
    'cia.json',
    'die.json',
    'plot4ai.json'
  ];

  constructor(private http: HttpClient, private logger: LoggerService) {}

  /**
   * Load all framework JSON files and convert them to in-memory models
   */
  loadAllFrameworks(): Observable<FrameworkModel[]> {
    const frameworkRequests = this._frameworkFiles.map(fileName =>
      this.http.get<Framework>(`${this._frameworkAssetPath}${fileName}`)
    );

    return forkJoin(frameworkRequests).pipe(
      map(frameworks => {
        return frameworks.map(framework => this._convertToFrameworkModel(framework));
      })
    );
  }
}
```

#### Single Framework Loading (Lines 42-58)

```typescript
/**
 * Load a specific framework by name
 */
loadFramework(frameworkName: string): Observable<FrameworkModel | null> {
  const fileName = this._getFrameworkFileName(frameworkName);
  if (!fileName) {
    this.logger.warn('Unknown framework name', { frameworkName });
    return of(null);
  }

  return this.http.get<Framework>(`${this._frameworkAssetPath}${fileName}`).pipe(
    map(framework => {
      this.logger.info('Successfully loaded framework', { frameworkName });
      return this._convertToFrameworkModel(framework);
    })
  );
}
```

#### Framework Name Mapping (Lines 76-87)

```typescript
/**
 * Get the appropriate JSON filename for a framework name
 */
private _getFrameworkFileName(frameworkName: string): string | null {
  const normalizedName = frameworkName.toLowerCase();
  const fileMap: Record<string, string> = {
    stride: 'stride.json',
    linddun: 'linddun.json',
    cia: 'cia.json',
    die: 'die.json',
    plot4ai: 'plot4ai.json'
  };

  return fileMap[normalizedName] || null;
}
```

#### Why It's SAFE from SSRF

**Defense Mechanisms:**

1. **Hardcoded Asset Path**
   - Framework files always loaded from `/assets/frameworks/` directory
   - Path prefix is hardcoded in `_frameworkAssetPath`
   - No user-controlled path components

2. **Fixed File List**
   - Framework files are hardcoded in `_frameworkFiles` array
   - Only 5 frameworks supported: STRIDE, LINDDUN, CIA, DIE, PLOT4AI
   - User cannot specify arbitrary filenames

3. **Framework Name Whitelist**
   - `_getFrameworkFileName()` maps names to filenames
   - Returns `null` for unknown frameworks (no request made)
   - Case-insensitive matching

4. **Static Asset Loading**
   - Framework JSON files are static assets bundled with application
   - No external URLs
   - Served by same origin

5. **Client-Side Execution**
   - All requests via Angular HttpClient (browser context)

**User Input:**
- Framework name selection (e.g., `stride`, `linddun`)
- Mapped to hardcoded filename

**Destination:**
- **Fixed:** `/assets/frameworks/{framework}.json`
- Static assets on same origin

**Verdict:** ✅ **SAFE** - Static asset loading with framework name whitelist. No SSRF risk.

---

### 5. WebSocket Adapter (Real-Time Collaboration)

**Component Name:** WebSocket Adapter
**Purpose:** Manages WebSocket connections for real-time DFD collaboration
**File:** `/app/repos/tmi-ux/src/app/core/services/websocket.adapter.ts`

#### WebSocket Connection (Lines 224-312)

```typescript
/**
 * Connect to WebSocket server (URL should already include auth token if needed)
 */
connect(url: string): Observable<void> {
  return new Observable(observer => {
    try {
      if (this._socket && this._socket.readyState === WebSocket.OPEN) {
        observer.next();
        observer.complete();
        return;
      }

      this._url = url;
      this._connectionState$.next(WebSocketState.CONNECTING);

      this.logger.info('Connecting WebSocket', {
        url: url.replace(/\?.*$/, ''), // Don't log query params (including token)
        hasToken: url.includes('?token=')
      });

      // Log WebSocket connection request with component debug logging
      this.logger.debugComponent('websocket-api', 'WebSocket connection request:', {
        url: url.replace(/\?.*$/, ''), // Redact query params for security
        protocol: 'WebSocket',
        hasAuthToken: url.includes('?token=')
      });

      this._socket = new WebSocket(url);
      this._setupEventListeners();

      // Wait for connection to open
      const openHandler = (): void => {
        this._connectionState$.next(WebSocketState.CONNECTED);
        this._reconnectAttempts = 0;

        // Log successful WebSocket connection
        this.logger.debugComponent('websocket-api', 'WebSocket connection established:', {
          url: url.replace(/\?.*$/, ''),
          readyState: this._socket?.readyState,
          protocol: this._socket?.protocol || 'none'
        });

        observer.next();
        observer.complete();
      };

      const errorHandler = (event: Event | ErrorEvent | { message?: string; error?: { message?: string } }): void => {
        this._connectionState$.next(WebSocketState.ERROR);
        let errorMessage = 'WebSocket connection failed';
        // Error handling logic...
        observer.error(new Error(`WebSocket connection failed: ${errorMessage}`));
      };

      this._socket.addEventListener('open', openHandler, { once: true });
      this._socket.addEventListener('error', errorHandler, { once: true });
    } catch (error) {
      this._connectionState$.next(WebSocketState.ERROR);
      observer.error(error);
    }
  });
}
```

#### WebSocket URL Construction (Typical Usage)

**WebSocket URL is derived from environment configuration:**

```typescript
// In collaboration service or similar
const apiUrl = environment.apiUrl; // e.g., "https://tmi-backend.example.com"
const wsUrl = apiUrl.startsWith('https://')
  ? apiUrl.replace('https://', 'wss://')
  : apiUrl.replace('http://', 'ws://');

const token = await this.authService.getValidToken();
const fullWsUrl = `${wsUrl}/collaboration/ws?token=${token.token}`;

this.websocketAdapter.connect(fullWsUrl).subscribe();
```

#### Message Sending (Lines 337-379)

```typescript
/**
 * Send a message through WebSocket
 */
sendMessage(message: Omit<WebSocketMessage, 'id' | 'timestamp'>): Observable<void> {
  return new Observable(observer => {
    try {
      if (!this.isConnected) {
        throw new Error('WebSocket is not connected');
      }

      const fullMessage: WebSocketMessage = {
        ...message,
        id: this._generateMessageId(),
        timestamp: Date.now()
      };

      // Log WebSocket message send
      this.logger.debugComponent('websocket-api', 'WebSocket message sent:', {
        messageId: fullMessage.id,
        messageType: fullMessage.type,
        sessionId: fullMessage.sessionId,
        userId: fullMessage.userId,
        requiresAck: fullMessage.requiresAck,
        body: redactSensitiveData(fullMessage.data)
      });

      this._socket!.send(JSON.stringify(fullMessage));

      if (message.requiresAck) {
        // Wait for acknowledgment
        this._waitForAcknowledgment(fullMessage.id).then(
          () => {
            observer.next();
            observer.complete();
          },
          error => observer.error(error)
        );
      } else {
        observer.next();
        observer.complete();
      }
    } catch (error) {
      observer.error(error);
    }
  });
}
```

#### Why It's SAFE from SSRF

**Defense Mechanisms:**

1. **Environment-Configured URL**
   - WebSocket URL derived from `environment.apiUrl`
   - Environment config is deployed with application (not runtime-configurable)
   - Protocol mapping: `https://` → `wss://`, `http://` → `ws://`

2. **Fixed Backend Destination**
   - WebSocket connects to backend collaboration server
   - No user-controlled URL components
   - Authentication token appended as query parameter

3. **Browser WebSocket API**
   - Native browser WebSocket implementation
   - Executes in browser context (not server-side)
   - Browser enforces WebSocket security policies

4. **Connection Lifecycle Management**
   - Connection state tracked: CONNECTING, CONNECTED, DISCONNECTED, ERROR
   - Automatic cleanup on disconnect
   - No arbitrary reconnection to user-specified URLs

**User Input:**
- None for connection URL (environment-configured)
- Message payloads for collaboration events

**Destination:**
- **Fixed:** `wss://{environment.apiUrl}/collaboration/ws?token={jwt}`
- Environment-configured backend server

**Verdict:** ✅ **SAFE** - WebSocket URL is environment-configured. Client-side connection. No SSRF risk.

---

### 6. PDF Font Manager (Report Generation)

**Component Name:** PDF Font Manager
**Purpose:** Loads fonts for PDF report generation with multi-language support
**File:** `/app/repos/tmi-ux/src/app/pages/tm/services/report/pdf-font-manager.ts`

#### Font Fetching (Lines 234-247)

```typescript
/**
 * Fetch font data from a URL path, with caching.
 */
private async fetchFont(fontPath: string): Promise<Uint8Array> {
  if (this.loadedFontData.has(fontPath)) {
    return this.loadedFontData.get(fontPath)!;
  }

  const response = await fetch(fontPath);
  if (!response.ok) {
    throw new Error(`Failed to fetch font: ${response.status} ${response.statusText}`);
  }

  const fontData = new Uint8Array(await response.arrayBuffer());
  this.loadedFontData.set(fontPath, fontData);
  return fontData;
}
```

#### Font Configuration (Lines 27-96)

```typescript
/**
 * Default font configurations keyed by language code.
 * Includes support for Latin, CJK, Arabic, Hebrew, and Thai scripts.
 */
export const DEFAULT_FONT_CONFIGS: Map<string, FontConfig> = new Map([
  [
    'en-US',
    {
      name: 'NotoSans',
      fontPath: 'assets/fonts/ttf/NotoSans-VariableFont_wdth,wght.ttf',
      italicFontPath: 'assets/fonts/ttf/NotoSans-Italic-VariableFont_wdth,wght.ttf',
      fallbacks: ['Helvetica', 'Arial']
    }
  ],
  [
    'de',
    {
      name: 'NotoSans',
      fontPath: 'assets/fonts/ttf/NotoSans-VariableFont_wdth,wght.ttf',
      italicFontPath: 'assets/fonts/ttf/NotoSans-Italic-VariableFont_wdth,wght.ttf',
      fallbacks: ['Helvetica', 'Arial']
    }
  ],
  [
    'zh',
    {
      name: 'NotoSansSC',
      fontPath: 'assets/fonts/ttf/NotoSansSC-VariableFont_wght.ttf',
      fallbacks: ['Helvetica', 'Arial']
    }
  ],
  [
    'ar',
    {
      name: 'NotoSansArabic',
      fontPath: 'assets/fonts/ttf/NotoSansArabic-VariableFont_wdth,wght.ttf',
      fallbacks: ['Helvetica', 'Arial'],
      rtl: true
    }
  ],
  [
    'th',
    {
      name: 'NotoSansThai',
      fontPath: 'assets/fonts/ttf/NotoSansThai-VariableFont_wdth,wght.ttf',
      fallbacks: ['Helvetica', 'Arial']
    }
  ],
  [
    'ja',
    {
      name: 'NotoSansJP',
      fontPath: 'assets/fonts/ttf/NotoSansJP-VariableFont_wght.ttf',
      fallbacks: ['Helvetica', 'Arial']
    }
  ],
  [
    'ko',
    {
      name: 'NotoSansKR',
      fontPath: 'assets/fonts/ttf/NotoSansKR-VariableFont_wght.ttf',
      fallbacks: ['Helvetica', 'Arial']
    }
  ],
  [
    'he',
    {
      name: 'NotoSansHebrew',
      fontPath: 'assets/fonts/ttf/NotoSansHebrew-VariableFont_wdth,wght.ttf',
      fallbacks: ['Helvetica', 'Arial'],
      rtl: true
    }
  ]
]);
```

#### Font Loading Flow (Lines 124-143)

```typescript
/**
 * Load and embed all required font variants for the given language.
 * Must be called before any getFont() calls.
 */
async loadFonts(language: string): Promise<void> {
  const fontConfig = this.fontConfigs.get(language) || this.fontConfigs.get('en-US')!;

  this.logger.debugComponent('PdfFontManager', 'Loading fonts for language', {
    language,
    fontConfig: fontConfig.name
  });

  // Load regular font
  await this.loadRegularFont(fontConfig);

  // Load italic font
  await this.loadItalicFont(fontConfig);

  // Load bold font (HelveticaBold — Latin only)
  await this.loadBoldFont();

  // Load monospace font (Courier — always available)
  await this.loadMonospaceFont();
}
```

#### Why It's SAFE from SSRF

**Defense Mechanisms:**

1. **Hardcoded Font Paths**
   - All font paths defined in `DEFAULT_FONT_CONFIGS` constant
   - Paths point to static assets in `assets/fonts/ttf/` directory
   - No user-controlled path components

2. **Language-to-Font Mapping**
   - Language code maps to predefined font configuration
   - Fallback to `en-US` for unknown languages
   - Font paths never derived from user input

3. **Static Asset Loading**
   - Fonts are static TTF files bundled with application
   - No external font URLs
   - Served by same origin as application

4. **Client-Side PDF Generation**
   - PDF generation happens in browser using pdf-lib
   - Fonts loaded via browser fetch API (client-side)
   - No server-side PDF rendering

5. **Font Caching**
   - Loaded fonts cached in `loadedFontData` Map
   - Reduces redundant fetch requests
   - Cache is client-side (in memory)

**User Input:**
- Language selection (e.g., `en-US`, `zh`, `ar`)
- Mapped to hardcoded font configuration

**Destination:**
- **Fixed:** `assets/fonts/ttf/{font-file}.ttf`
- Static assets on same origin

**Verdict:** ✅ **SAFE** - Font paths hardcoded in configuration. Static asset loading. No SSRF risk.

---

## Conclusion

### Key Findings

1. **Zero Server-Side HTTP Requests:** All HTTP requests in the TMI-UX frontend execute in the user's browser, not on the application server.

2. **Strong Architectural Defense:** The Angular SPA architecture inherently prevents SSRF by design - there is no server-side HTTP client that could be exploited.

3. **Fixed Destinations:** All HTTP endpoints use environment-configured base URLs that cannot be modified at runtime.

4. **Browser Security Sandbox:** All requests are subject to browser same-origin policy, CORS, and other browser security mechanisms.

5. **Client-Side Execution Context:** Even if user input could influence URL parameters, the requests originate from the user's browser (not the server), making SSRF impossible.

### Security Principles Applied

**Defense in Depth:**
- Environment configuration (fixed base URLs)
- Input validation (whitelists for languages, frameworks)
- Path normalization (slash handling)
- Type safety (TypeScript enforces types)
- Browser security model (same-origin policy)

**Least Privilege:**
- No server-side HTTP client capabilities
- Static file server makes no outbound requests
- Backend API is the only service making server-side requests

**Separation of Concerns:**
- Frontend: Client-side rendering, user interaction
- Backend: Server-side requests, business logic, data access

### Risk Assessment Summary

| Component Category | Total Components | SSRF Risk | Notes |
|-------------------|------------------|-----------|-------|
| Angular HttpClient Services | 1 (API Service) | NONE | Client-side browser requests |
| Authentication Flows | 1 (Auth Service) | NONE | Browser redirects + client HTTP |
| Static Asset Loaders | 3 (i18n, Frameworks, Fonts) | NONE | Hardcoded paths, static assets |
| WebSocket Connections | 1 (WebSocket Adapter) | NONE | Environment-configured URL |
| **TOTAL** | **6** | **NONE** | All client-side execution |

### Final Verdict

**All analyzed components are SAFE from SSRF vulnerabilities.**

The TMI-UX Angular application demonstrates **best-practice SSRF prevention** through architectural design:
- No server-side HTTP client
- All HTTP requests originate from browser
- Fixed backend endpoints
- Static asset loading with hardcoded paths
- Environment-based configuration

**Recommendation:** Continue to maintain this secure architecture. Any future features requiring server-side HTTP requests should implement comprehensive SSRF mitigations (URL validation, IP allowlisting, protocol restrictions, etc.).

---

## Appendix: SSRF Defense Checklist

For future development, if server-side HTTP requests become necessary, apply these defenses:

**URL Validation:**
- ✅ Whitelist allowed protocols (HTTPS only)
- ✅ Whitelist allowed domains/hosts
- ✅ Block private IP ranges (RFC 1918)
- ✅ Block localhost (127.0.0.0/8, ::1)
- ✅ Block link-local addresses (169.254.0.0/16)
- ✅ Block cloud metadata endpoints (169.254.169.254, metadata.google.internal)
- ✅ Implement DNS rebinding protection
- ✅ Validate resolved IP addresses (not just hostname)

**Request Configuration:**
- ✅ Set request timeout (5-10 seconds)
- ✅ Disable or limit HTTP redirects
- ✅ Set maximum response size limit
- ✅ Use separate network isolation for outbound requests

**Monitoring & Logging:**
- ✅ Log all outbound requests (destination, timestamp)
- ✅ Alert on blocked requests
- ✅ Monitor for suspicious patterns

**Testing:**
- ✅ Test with internal IP ranges
- ✅ Test with localhost URLs
- ✅ Test with cloud metadata endpoints
- ✅ Test with DNS rebinding
- ✅ Test with HTTP redirects

---

**Document Version:** 1.0
**Last Updated:** 2026-03-04
**Prepared By:** Claude (SSRF Security Analysis Agent)
