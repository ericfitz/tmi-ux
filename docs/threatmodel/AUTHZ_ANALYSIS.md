# TMI-UX Authorization Architecture Analysis

**Analysis Date:** 2026-03-05  
**Application:** TMI-UX Angular Application  
**Scope:** Network-accessible routes and endpoints only

---

## Executive Summary

The TMI-UX Angular application implements a **multi-layered authorization system** with the following characteristics:

- **Authentication Layer:** JWT-based authentication with OAuth2/SAML flows
- **Role-Based Access Control (RBAC):** Admin and Security Reviewer roles
- **Resource-Level Authorization:** Owner/Writer/Reader permissions for threat models
- **Defense-in-Depth:** Route guards, resolvers, HTTP interceptors, and component-level checks

**Critical Finding:** Authorization is primarily enforced on the **frontend only** with minimal backend validation enforcement visible. All authorization decisions rely on JWT token claims and cached user profiles, which creates potential bypass opportunities if the backend does not perform equivalent validation.

---

## 1. Guard Directory

### 1.1 Authentication Guard (`authGuard`)
**Location:** `/app/repos/tmi-ux/src/app/auth/guards/auth.guard.ts`

**Purpose:** Protects routes requiring user authentication

**Implementation:**
```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  // Defense-in-depth: Synchronous token expiry check (lines 28-32)
  authService.validateAndUpdateAuthState();

  return authService.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      if (isAuthenticated) {
        return true;
      } else {
        void router.navigate(['/login'], {
          queryParams: {
            returnUrl: state.url,
            reason: 'session_expired',
          },
        });
        return false;
      }
    }),
  );
};
```

**Key Characteristics:**
- **Validation Method:** Checks `isAuthenticated$` BehaviorSubject from AuthService
- **Token Validation:** Synchronous token expiry check via `validateAndUpdateAuthState()` (line 32)
- **On Failure:** Redirects to `/login` with `returnUrl` and `reason=session_expired`
- **Critical Lines:** 32 (token validation), 34-51 (observable check)

**Weaknesses:**
- Relies on client-side token expiry validation
- BehaviorSubject state can become stale if token expires while page is active
- No server-side validation at guard level (relies on HTTP interceptor)

---

### 1.2 Admin Guard (`adminGuard`)
**Location:** `/app/repos/tmi-ux/src/app/auth/guards/admin.guard.ts`

**Purpose:** Protects routes requiring administrator privileges

**Implementation:**
```typescript
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  return authService.refreshUserProfile().pipe(
    map(userProfile => {
      if (userProfile.is_admin) {
        logger.info('Admin access granted');
        return true;
      } else {
        logger.warn('Admin access denied: User is not an administrator');
        void router.navigate([authService.getLandingPage()], {
          queryParams: {
            error: 'admin_required',
          },
        });
        return false;
      }
    }),
    catchError(error => {
      logger.error('Failed to verify admin status', error);
      void router.navigate([authService.getLandingPage()], {
        queryParams: {
          error: 'admin_check_failed',
        },
      });
      return of(false);
    }),
  );
};
```

**Key Characteristics:**
- **Validation Method:** Fresh API call to `GET /users/me` via `refreshUserProfile()` (line 26)
- **Role Check:** Verifies `is_admin` field from server response (line 28)
- **On Failure:** Redirects to landing page with `error=admin_required` or `error=admin_check_failed`
- **Critical Lines:** 26 (API call), 28 (role check)

**Strengths:**
- Performs fresh server-side validation on every route activation
- Does not rely on cached JWT claims
- Default deny on error

**Weaknesses:**
- Additional network round-trip on every admin route navigation
- Race condition: User could navigate to admin route, then admin status revoked server-side before API call completes

---

### 1.3 Security Reviewer Guard (`reviewerGuard`)
**Location:** `/app/repos/tmi-ux/src/app/auth/guards/reviewer.guard.ts`

**Purpose:** Protects routes requiring security reviewer privileges

**Implementation:**
```typescript
export const reviewerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  return authService.refreshUserProfile().pipe(
    map(userProfile => {
      if (userProfile.is_security_reviewer) {
        logger.info('Security reviewer access granted');
        return true;
      } else {
        logger.warn('Security reviewer access denied: User is not a security reviewer');
        void router.navigate([authService.getLandingPage()]);
        return false;
      }
    }),
    catchError(error => {
      logger.error('Failed to verify security reviewer status', error);
      void router.navigate([authService.getLandingPage()]);
      return of(false);
    }),
  );
};
```

**Key Characteristics:**
- **Validation Method:** Fresh API call to `GET /users/me` via `refreshUserProfile()` (line 26)
- **Role Check:** Verifies `is_security_reviewer` field from server response (line 28)
- **On Failure:** Redirects to landing page
- **Critical Lines:** 26 (API call), 28 (role check)

**Identical to adminGuard in structure, different only in role checked**

---

### 1.4 Home Guard (`homeGuard`)
**Location:** `/app/repos/tmi-ux/src/app/auth/guards/home.guard.ts`

**Purpose:** Redirects authenticated users away from home page to their landing page

**Implementation:**
```typescript
export const homeGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  // If user is authenticated, redirect to their role-based landing page
  if (authService.isAuthenticated) {
    logger.debugComponent('HomeGuard', 'User is authenticated, redirecting to landing page');
    void router.navigate([authService.getLandingPage()]);
    return false;
  }

  // Allow access to home page for unauthenticated users
  return true;
};
```

**Key Characteristics:**
- **Validation Method:** Checks `authService.isAuthenticated` synchronous property (line 13)
- **On Success:** Redirects to role-based landing page
- **Critical Lines:** 13 (authentication check), 15 (redirect)

**Weakness:**
- Uses synchronous `isAuthenticated` property instead of observable
- No token expiry validation at this guard level

---

## 2. Route Protection Mapping

### 2.1 Application Routes (`/app/repos/tmi-ux/src/app/app.routes.ts`)

| Route Pattern | Guards Applied | Protected Resource |
|--------------|----------------|-------------------|
| `/` | `homeGuard` | Home page (redirects if authenticated) |
| `/login` | None | Login page (public) |
| `/oauth2/callback` | None | OAuth callback (public) |
| `/unauthorized` | None | Unauthorized page (public) |
| `/about` | None | About page (public) |
| `/tos` | None | Terms of Service (public) |
| `/privacy` | None | Privacy Policy (public) |
| `/dashboard` | `authGuard` | Threat model dashboard |
| `/admin` | `authGuard` | Admin parent route |
| `/admin/*` (all children) | `authGuard`, `adminGuard` | Admin section (users, groups, quotas, webhooks, addons, settings, surveys) |
| `/tm/*` | `authGuard` | Threat model pages |
| `/intake/*` | `authGuard` | Survey intake (respondent experience) |
| `/triage/*` | `authGuard`, `reviewerGuard` | Triage section (security reviewer) |

**Critical Finding:** The `/tm` route applies `authGuard` to the parent but resource-level authorization is delegated to the resolver and component level.

---

### 2.2 Threat Model Routes (`/app/repos/tmi-ux/src/app/pages/tm/tm.routes.ts`)

| Route Pattern | Resolver | Notes |
|--------------|----------|-------|
| `/tm/:id` | `threatModelResolver` | Threat model editor |
| `/tm/:id/threat/:threatId` | `threatModelResolver` | Threat detail page |
| `/tm/:id/note/:noteId` | `threatModelResolver` | Note detail page |
| `/tm/:id/dfd/:dfdId` | `threatModelResolver` | Data flow diagram editor |

**All threat model routes inherit `authGuard` from parent and use `threatModelResolver` for resource-level authorization.**

---

## 3. Authorization Decision Points

### 3.1 Route Guards (Pre-Navigation)
**Location:** Applied via `canActivate` array in route configuration  
**Decision Type:** Role-based (admin, reviewer) and authentication state  
**Enforcement:** Client-side Angular router navigation prevention

### 3.2 Route Resolvers (Pre-Component Initialization)
**Location:** `/app/repos/tmi-ux/src/app/pages/tm/resolvers/threat-model.resolver.ts`  
**Decision Type:** Resource-level authorization (threat model access)

**Implementation:**
```typescript
export const threatModelResolver: ResolveFn<ThreatModel | null> = (
  route,
  state,
): Observable<ThreatModel | null> => {
  const threatModelService = inject(ThreatModelService);
  const authorizationService = inject(ThreatModelAuthorizationService);
  const logger = inject(LoggerService);
  const router = inject(Router);

  const threatModelId = route.paramMap.get('id');
  
  // Load threat model with forced refresh (line 56)
  return threatModelService.getThreatModelById(threatModelId, forceRefresh).pipe(
    tap(threatModel => {
      if (threatModel) {
        const userPermission = authorizationService.getCurrentUserPermission();
        logger.info('User permission determined', {
          threatModelId: threatModel.id,
          permission: userPermission,
        });
      }
    }),
    catchError((error: unknown) => {
      const httpError = error as { status?: number };
      
      if (httpError.status === 403) {
        // Navigate to dashboard with access_denied error (lines 79-84)
        void router.navigate(['/dashboard'], {
          queryParams: {
            error: 'access_denied',
            threat_model_id: threatModelId,
          },
        });
      } else if (httpError.status === 401) {
        // Navigate to dashboard with auth_required error (lines 92-97)
      }
      
      return EMPTY; // Prevents route activation
    }),
  );
};
```

**Key Points:**
- Resolver fetches threat model from backend via `ThreatModelService.getThreatModelById()` (line 56)
- Backend returns 403 if user lacks permission → resolver redirects to dashboard
- Backend returns 401 if authentication fails → JWT interceptor attempts token refresh
- Resolver sets authorization state in `ThreatModelAuthorizationService` (done inside service method)
- **Critical Lines:** 56 (API call), 73-106 (error handling)

**Enforcement:** Combination of backend API response and client-side navigation prevention

---

### 3.3 HTTP Interceptor (Request/Response)
**Location:** `/app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts`

**Registered in:** `/app/repos/tmi-ux/src/app/app.config.ts` (lines 345-355)

**Interceptor Order:**
1. `JwtInterceptor` - Adds Authorization header (line 347)
2. `HttpLoggingInterceptor` - Logs requests/responses (line 352)

**JWT Interceptor Implementation:**
```typescript
intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
  // Only add token to requests to our API that are not public endpoints (line 49)
  if (this.isApiRequest(request.url) && !this.isPublicEndpoint(request.url)) {
    return this.authService.getValidToken().pipe(
      switchMap(token => {
        const tokenizedRequest = request.clone({
          setHeaders: {
            Authorization: `Bearer ${token.token}`,
          },
        });
        
        return next.handle(tokenizedRequest).pipe();
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return this.handleUnauthorizedErrorWithRefresh(request, next);
        }
        return this.handleError(error, request);
      }),
    );
  }
  
  // For public endpoints or non-API requests, just pass through
  return next.handle(request).pipe(
    catchError((error: HttpErrorResponse) => this.handleError(error, request))
  );
}
```

**Public Endpoints (no auth required, lines 25-34):**
- `/`
- `/version`
- `/oauth2/callback`
- `/oauth2/providers`
- `/oauth2/refresh`
- `/oauth2/authorize/*`
- `/oauth2/token/*`
- `/saml/providers`

**401 Handling (lines 164-231):**
1. On 401 response, checks if request already has `IS_AUTH_RETRY` context flag
2. If not retried yet, calls `authService.forceRefreshToken()` to get new token
3. Clones request with new token and sets `IS_AUTH_RETRY` flag to prevent infinite loops
4. Retries request with new token
5. If retry also fails with 401, propagates error without logout

**Critical Lines:**
- 49 (public endpoint check)
- 51 (token retrieval)
- 61-65 (Authorization header injection)
- 105 (401 error handling)
- 200 (forced token refresh)
- 205 (retry with IS_AUTH_RETRY context)

**Enforcement:** Automatic token attachment and refresh, but **does not validate user roles or permissions** - relies entirely on backend to reject unauthorized requests

---

### 3.4 Component-Level Checks
**Example:** `/app/repos/tmi-ux/src/app/pages/tm/tm-edit.component.ts`

**Authorization Properties:**
```typescript
canEdit = false;
canManagePermissions = false;
```

**Subscription to Authorization Service (lines 624-633):**
```typescript
this.authorizationService.canEdit$.subscribe(canEdit => {
  this.canEdit = canEdit;
});

this.authorizationService.canManagePermissions$.subscribe(canManage => {
  this.canManagePermissions = canManage;
});
```

**Usage in Methods (examples):**
```typescript
// Line 903 - Delete threat
if (!this.threatModel || !this.canEdit) return;

// Line 942 - Delete document
if (!this.threatModel || !this.canEdit) return;

// Line 1255 - Edit threat
if (!this.canEdit) {
  // Show read-only message
}

// Line 1407 - Edit note
if (!this.canEdit) {
  // Show read-only message
}
```

**Enforcement:** UI-level only - disables buttons, shows read-only messages, returns early from methods. **Does not prevent API calls if bypassed.**

---

## 4. Role Extraction and Validation

### 4.1 JWT Token Structure

**JWT Payload Interface (lines 56-72 of `auth.service.ts`):**
```typescript
interface JwtPayload {
  sub?: string;        // Provider-assigned user ID (maps to provider_id)
  email?: string;
  name?: string;       // Display name (maps to display_name)
  iat?: number;        // Issued at (timestamp)
  exp?: number;        // Expiration (timestamp)
  idp?: string;        // OAuth provider (e.g., "google", "github")
  aud?: string;        // Audience
  iss?: string;        // Issuer
  groups?: string[];   // User group memberships
  providers?: Array<{
    provider: string;
    is_primary: boolean;
  }>;
  tmi_is_administrator?: boolean;       // Admin role flag
  tmi_is_security_reviewer?: boolean;   // Reviewer role flag
}
```

**Key Claims:**
- `tmi_is_administrator` - Admin role (used by adminGuard)
- `tmi_is_security_reviewer` - Security reviewer role (used by reviewerGuard)
- `groups` - Group memberships (used by threat model authorization)
- `exp` - Token expiration (validated client-side)

---

### 4.2 Role Extraction from JWT

**Admin Role Check (lines 264-266):**
```typescript
get isAdmin(): boolean {
  return this.userProfile?.is_admin === true;
}
```

**Security Reviewer Role Check (lines 268-270):**
```typescript
get isSecurityReviewer(): boolean {
  return this.userProfile?.is_security_reviewer === true;
}
```

**Groups Extraction (lines 234-248):**
```typescript
get userGroups(): string[] {
  const token = this.getStoredToken();
  if (!token) {
    return [];
  }
  
  try {
    const payload = token.token.split('.')[1];
    const decodedPayload = JSON.parse(atob(payload)) as JwtPayload;
    return decodedPayload.groups || [];
  } catch (error) {
    this.logger.warn('Could not decode token to get groups', error);
    return [];
  }
}
```

**Critical:** All role checks rely on `userProfile` which is populated from:
1. JWT token claims (lines 1376-1377 in `extractUserProfileFromToken`)
2. Fresh API call to `/me` endpoint (lines 1391-1485 in `refreshUserProfile`)

---

### 4.3 User Profile Storage and Refresh

**User Profile Storage:** 
- **Location:** localStorage (key: `user_profile`)
- **Encryption:** AES-GCM encrypted using JWT access token as key material (lines 1601-1614)
- **Decryption:** Requires valid access token to decrypt (lines 1621-1661)

**Profile Refresh Flow:**
```typescript
refreshUserProfile(): Observable<UserProfile> {
  return this.http.get<UserMeResponse>(`${environment.apiUrl}/me`).pipe(
    map(response => {
      // Transform API response to UserProfile format
      const serverProfile: UserProfile = {
        provider: response.provider,
        provider_id: response.provider_id,
        display_name: response.name,
        email: response.email,
        groups: response.groups ?? null,
        is_admin: response.is_admin,
        is_security_reviewer: response.is_security_reviewer,
      };
      
      // Merge with JWT-derived profile (lines 1432-1447)
      const mergedProfile = {
        // Identity fields: always use JWT values (authoritative source)
        provider: currentProfile.provider,
        provider_id: currentProfile.provider_id,
        
        // Server-verified fields: prefer server values
        is_admin: serverProfile.is_admin,
        is_security_reviewer: serverProfile.is_security_reviewer,
      };
      
      return mergedProfile;
    }),
    tap(profile => {
      // Update cached profile
      this.userProfileSubject.next(profile);
      void this.storeUserProfile(profile);
    }),
  );
}
```

**Critical Lines:**
- 1393 (GET /me API call)
- 1444 (is_admin from server)
- 1445-1446 (is_security_reviewer from server)
- 1473 (update BehaviorSubject)
- 1474 (update localStorage)

**Refresh Triggers:**
1. After successful login (line 1113)
2. On admin guard activation (line 26 of admin.guard.ts)
3. On reviewer guard activation (line 26 of reviewer.guard.ts)

**Staleness Risk:**
- Profile cached in BehaviorSubject and localStorage
- Only refreshed when explicitly called (guards) or after login
- Between refreshes, uses stale cached values

---

## 5. Resource-Level Authorization

### 5.1 Threat Model Authorization Service

**Location:** `/app/repos/tmi-ux/src/app/pages/tm/services/threat-model-authorization.service.ts`

**Permission Model:**
- **Owner:** Full control (read, write, manage permissions, delete)
- **Writer:** Can edit threat model content
- **Reader:** Read-only access

**Authorization State Management:**
```typescript
private _authorizationSubject = new BehaviorSubject<Authorization[] | null>(null);
private _currentOwner: User | null = null;
private _currentThreatModelId: string | null = null;
```

**Public Observables:**
```typescript
get currentUserPermission$(): Observable<'reader' | 'writer' | 'owner' | null>
get canEdit$(): Observable<boolean>
get canManagePermissions$(): Observable<boolean>
```

---

### 5.2 Permission Calculation Algorithm

**Method:** `calculateUserPermission()` (lines 172-221)

**Algorithm Flow:**
1. **Extract Current User Identity** (lines 175-183)
   - Get `provider` from JWT `idp` claim
   - Get `provider_id` from JWT `sub` claim
   - Get `email` from JWT
   - Get `groups` from JWT

2. **Check Owner Match** (lines 186-188)
   - Call `_checkOwnerMatch()` to compare current user against threat model owner field
   - If match, return `'owner'` immediately

3. **Check Authorization List** (lines 191-200)
   - If not owner, check authorization entries array
   - If no entries, return `null` (no access)

4. **Find Highest Permission** (lines 204-209)
   - Call `_findHighestPermission()` to scan authorization entries
   - Return highest matching permission level

**Critical Lines:**
- 175-178 (identity extraction)
- 186 (owner check)
- 204 (authorization list scan)

---

### 5.3 Owner Matching Logic

**Method:** `_checkOwnerMatch()` (lines 227-295)

**Matching Algorithm:**
1. **Primary Match:** `(provider, provider_id)` composite key (lines 252-253)
   ```typescript
   const providerMatches = this._currentOwner.provider === currentUserProvider;
   const providerIdMatches = this._currentOwner.provider_id === currentUserProviderId;
   ```

2. **Fallback Match:** Email comparison if primary fails (lines 256-260)
   ```typescript
   const emailFallbackMatches =
     !providerIdMatches &&
     !!this._currentOwner.email &&
     !!currentUserEmail &&
     this._currentOwner.provider_id === currentUserEmail;
   ```
   **Note:** This fallback handles a **backend bug** where `owner.provider_id` sometimes contains email instead of OAuth provider ID (line 279)

3. **Return:** `true` if either primary or fallback matches (line 294)

**Critical Lines:**
- 252-253 (primary match)
- 256-260 (email fallback)
- 278-286 (email fallback warning log)

---

### 5.4 Authorization List Matching

**Method:** `_findHighestPermission()` (lines 301-329)

**Permission Ranking:**
```typescript
const ROLE_RANK: Record<string, number> = { 
  reader: 1, 
  writer: 2, 
  owner: 3 
};
```

**Matching Algorithm:**
1. **Iterate Authorization Entries** (line 310)
2. **For Each Entry:**
   - Call `_matchAuthorizationEntry()` to check match (lines 311-316)
   - If matched, compare rank with current highest (lines 320-323)
   - Update highest if this entry ranks higher
   - **Early Return:** If `owner` permission found, return immediately (line 325)

**Critical Lines:**
- 307 (role ranking)
- 311 (entry matching)
- 320-322 (rank comparison)
- 325 (early return on owner)

---

### 5.5 Authorization Entry Matching

**Method:** `_matchAuthorizationEntry()` (lines 335-375)

**Entry Types:**
1. **User Principal** (`principal_type: 'user'`, lines 341-353)
   - Match on `(provider, provider_id)` composite key
   - Return entry's `role` if matched

2. **Group Principal** (`principal_type: 'group'`, lines 354-372)
   - **Special Case:** `provider_id.toLowerCase() === 'everyone'` matches all users (lines 355-361)
   - **Group Membership:** Check if current user's groups include entry's `provider_id` (lines 364-370)

**Critical Lines:**
- 342 (user principal provider match)
- 355 (everyone group special case)
- 364 (group membership check)

---

### 5.6 Authorization Data Source

**Set via:** `ThreatModelService.getThreatModelById()` → calls `authorizationService.setAuthorization()`

**Backend Response Structure (inferred):**
```typescript
interface ThreatModel {
  id: string;
  owner: User;  // Principal-based user object
  authorization: Authorization[] | null;
  // ... other fields
}

interface User {
  provider: string;        // OAuth provider (e.g., "google")
  provider_id: string;     // Provider-assigned ID
  email?: string;
  // ... other fields
}

interface Authorization {
  principal_type: 'user' | 'group';
  provider: string;
  provider_id: string;
  role: 'reader' | 'writer' | 'owner';
}
```

**Critical:** Authorization data comes from backend API response, but **permission calculation happens entirely client-side**. No subsequent server-side validation of permissions before operations.

---

## 6. Authorization Bypass Opportunities

### 6.1 Frontend-Only Authorization Checks

**Vulnerability:** Component-level authorization checks (`canEdit`, `canManagePermissions`) are purely UI-level and easily bypassed.

**Bypass Method:**
1. Open browser DevTools
2. Set `component.canEdit = true` in console
3. UI becomes editable
4. API calls execute without frontend prevention

**Impact:** **HIGH** if backend does not independently validate permissions

**Example Locations:**
- `/app/repos/tmi-ux/src/app/pages/tm/tm-edit.component.ts` lines 903, 942, 989, 1255, 1407, etc.

**Evidence:**
```typescript
// Line 903 - Delete threat
if (!this.threatModel || !this.canEdit) return;
// ⚠️ Early return only - if bypassed, API call proceeds
```

**Recommendation:** Backend MUST validate all write operations against authorization rules. Frontend checks are for UX only.

---

### 6.2 Stale Token/Role Information

**Vulnerability:** User roles cached in localStorage and BehaviorSubject, only refreshed on specific triggers.

**Staleness Windows:**
1. **After Login:** Profile refreshed (line 1113 of auth.service.ts)
2. **Admin Route:** Profile refreshed by adminGuard (line 26 of admin.guard.ts)
3. **Reviewer Route:** Profile refreshed by reviewerGuard (line 26 of reviewer.guard.ts)
4. **Between Windows:** Uses cached profile from localStorage

**Bypass Scenario:**
1. User granted admin role at T=0
2. User logs in at T=1, profile cached with `is_admin: true`
3. Admin role revoked server-side at T=2
4. User navigates to `/dashboard` at T=3 (no admin guard, no refresh)
5. User navigates to non-admin route at T=4 (no refresh)
6. User still has `is_admin: true` in cached profile until next admin guard activation or re-login

**Impact:** **MEDIUM** - User retains stale admin status in UI but backend should reject admin operations

**Affected Routes:**
- `/dashboard` - Uses `authGuard` only (no profile refresh)
- `/tm/*` - Uses `authGuard` only (no profile refresh for role checks)
- `/intake/*` - Uses `authGuard` only (no profile refresh)

**Recommendation:** 
- Implement periodic profile refresh (e.g., every 5 minutes)
- OR add `refreshUserProfile()` call to `authGuard`
- Backend MUST validate roles on every admin operation regardless of frontend state

---

### 6.3 Race Conditions in Guard Execution

**Vulnerability:** Guards execute asynchronously - user could navigate faster than guard resolution

**Scenario 1: Token Expiry During Guard Execution**
1. User initiates navigation to `/admin` at T=0
2. `authGuard` checks token validity at T=1 (valid, exp=T+10s)
3. `adminGuard` starts profile refresh API call at T=2
4. Token expires at T=10
5. Profile refresh API completes at T=11 with 401 (expired token)
6. JWT interceptor attempts token refresh (may fail if refresh token also expired)

**Mitigation in Code:**
- `authGuard` performs synchronous token expiry check before consulting observable (line 32)
- JWT interceptor retries with refreshed token on 401 (lines 164-231)
- Token validity guard monitors visibility changes and timer drift (token-validity-guard.service.ts)

**Scenario 2: Role Revocation During Guard Execution**
1. User initiates navigation to `/admin` at T=0
2. `authGuard` passes at T=1 (authenticated)
3. Admin role revoked server-side at T=2
4. `adminGuard` API call completes at T=3 (still has admin role from before revocation)
5. User gains access despite revocation

**Impact:** **LOW** - Very narrow time window, backend should still enforce

---

### 6.4 Resource Authorization Bypass via Direct API Calls

**Vulnerability:** `ThreatModelAuthorizationService` calculates permissions client-side but does not validate before every API call.

**Example: Delete Threat**
`ThreatModelService.deleteThreat()` (lines 993-999):
```typescript
deleteThreat(threatModelId: string, threatId: string): Observable<boolean> {
  return this.apiService.delete(`threat_models/${threatModelId}/threats/${threatId}`).pipe(
    map(() => true),
    tap(() => {
      const cached = this._cachedThreatModels.get(threatModelId);
      if (cached?.threats) {
        // Update cache
      }
    }),
  );
}
```

**No authorization check before API call!** Only component checks `canEdit` (line 903 of tm-edit.component.ts)

**Bypass Method:**
1. Inject `ThreatModelService` via DevTools
2. Call `threatModelService.deleteThreat('tm-123', 'threat-456')`
3. API request executes without frontend permission check

**Impact:** **CRITICAL** if backend does not validate threat model write permissions

**Affected Operations:**
- `deleteThreat()` (line 993)
- `deleteDocument()` (line 1061)
- `deleteDiagram()` (line 1324)
- `deleteNote()` (line 1599)
- `deleteAsset()` (line 1715)
- `updateThreatModel()`, `updateThreat()`, `createThreat()`, etc. (similar pattern throughout)

**Recommendation:** Backend MUST check threat model authorization on EVERY write operation.

---

### 6.5 JWT Token Manipulation

**Vulnerability:** JWT tokens validated client-side only, no signature verification in browser.

**Client-Side JWT Handling:**
- Token stored encrypted in localStorage (lines 2005-2014 of auth.service.ts)
- Token decrypted using browser fingerprint as key (lines 1980-2000)
- Token payload decoded with `atob()` and `JSON.parse()` (lines 202, 222, 242, etc.)

**No Client-Side Signature Verification:**
```typescript
// Line 202 - Extract provider ID
const payload = token.token.split('.')[1];
const decodedPayload = JSON.parse(atob(payload)) as JwtPayload;
return decodedPayload.sub || '';
```

**Bypass Scenario:**
1. Attacker obtains valid JWT token
2. Decodes payload (base64)
3. Modifies `tmi_is_administrator: true`
4. Re-encodes payload
5. Creates new token with forged payload (invalid signature but frontend doesn't verify)
6. Injects forged token into localStorage

**Frontend Impact:**
- `authService.isAdmin` returns `true` (line 265)
- `adminGuard` calls `refreshUserProfile()` which makes API call with forged token
- Backend MUST reject forged token based on invalid signature

**Mitigation:**
- Frontend encryption (AES-GCM) prevents casual localStorage inspection but NOT forgery by determined attacker
- Frontend DOES NOT and CANNOT verify JWT signatures (requires private key)
- Backend MUST verify JWT signature on every request

**Impact:** **LOW** if backend properly validates JWT signatures, **CRITICAL** if backend trusts token claims without validation

---

### 6.6 Cross-Tab Logout Synchronization

**Vulnerability:** Cross-tab logout relies on localStorage events which can be blocked or delayed

**Implementation (lines 1883-1890 of auth.service.ts):**
```typescript
// Broadcast logout to other browser tabs
try {
  localStorage.setItem('auth_logout_broadcast', Date.now().toString());
  localStorage.removeItem('auth_logout_broadcast');
} catch {
  // Ignore storage errors (e.g., private browsing mode)
}
```

**Listening Side (lines 156-164 of token-validity-guard.service.ts):**
```typescript
this.storageEventHandler = (event: StorageEvent) => {
  if (event.key === 'auth_logout_broadcast') {
    this.logger.info('Received logout broadcast from another tab');
    this.ngZone.run(() => {
      this.handleCrossTabLogout();
    });
    return;
  }
};
```

**Bypass Scenario:**
1. User opens Tab A and Tab B
2. User logs out in Tab A
3. Tab A broadcasts logout via localStorage
4. Tab B's storage event listener is blocked by browser (private browsing mode, storage quota exceeded, etc.)
5. Tab B remains "authenticated" with stale state

**Mitigation in Code:**
- Tab B's token will eventually expire (validated on visibility change, heartbeat, or next API call)
- Token validity guard monitors visibility changes (lines 97-108)

**Impact:** **LOW** - Narrow window before token expiry or next validation

---

### 6.7 Missing Route Guards

**Audit Result:** All authenticated routes have appropriate guards

**Protected Routes:**
- `/dashboard` → `authGuard` ✓
- `/admin/*` → `authGuard` + `adminGuard` ✓
- `/tm/*` → `authGuard` + `threatModelResolver` ✓
- `/intake/*` → `authGuard` ✓
- `/triage/*` → `authGuard` + `reviewerGuard` ✓

**Public Routes (intentionally unguarded):**
- `/`, `/login`, `/oauth2/callback`, `/unauthorized`, `/about`, `/tos`, `/privacy` ✓

**No bypass opportunities identified in route guard coverage.**

---

## 7. Token Refresh and Session Management

### 7.1 Token Expiry Validation

**Client-Side Validation:** `isTokenValid()` (lines 291-300 of auth.service.ts)
```typescript
private isTokenValid(token?: JwtToken | null): boolean {
  const tokenToCheck = token || this.getStoredToken();
  if (!tokenToCheck) {
    return false;
  }
  
  const now = new Date();
  return tokenToCheck.expiresAt > now;
}
```

**Triggers:**
1. `authGuard` calls `validateAndUpdateAuthState()` before every route activation (line 32 of auth.guard.ts)
2. `TokenValidityGuardService` validates on:
   - Visibility change (tab becomes visible, line 102)
   - Timer drift detection (heartbeat exceeds expected interval, line 135)
   - Storage event (cross-tab logout, line 170)

**Critical:** Client-side clock manipulation could bypass expiry validation, but backend will still reject expired tokens

---

### 7.2 Token Refresh Flow

**Automatic Refresh:** `getValidToken()` (lines 354-385 of auth.service.ts)

**Refresh Triggers:**
1. Token expires within 15 minutes (line 345)
2. 401 response from API (JWT interceptor, line 200)

**Refresh Process:**
1. Check if token needs refresh (line 395)
2. Call `refreshToken()` → `POST /oauth2/refresh` with `refresh_token` (lines 1755-1762)
3. Backend returns new `access_token` and `refresh_token` (line 1765)
4. Store new token (line 415, 1807)
5. Update BehaviorSubject (line 1532)

**Refresh Token Rotation:**
- Backend SHOULD return new refresh token (line 1796)
- If same refresh token returned, warning logged (line 1797)

**Forced Refresh on 401:**
- JWT interceptor detects 401 (line 105)
- Calls `forceRefreshToken()` (line 200)
- Deduplicates concurrent refresh requests via `refreshInProgress$` observable (lines 1831-1856)

**Critical Lines:**
- 345 (15-minute refresh window)
- 1755-1762 (refresh API call)
- 200 (forced refresh on 401)
- 1831-1856 (deduplication)

---

### 7.3 Session Expiry Handling

**Token Storage:**
- **Location:** localStorage (key: `auth_token`)
- **Encryption:** AES-GCM with browser fingerprint as key (lines 2005-2014)
- **Expiry:** Stored as `expiresAt` Date object (line 299)

**Expiry Detection:**
1. **Proactive Checks:**
   - `authGuard` before route activation (line 32)
   - Visibility change handler (line 102 of token-validity-guard.service.ts)
   - Heartbeat drift detection (line 135)

2. **Reactive Checks:**
   - 401 response from API triggers forced refresh (line 200 of jwt.interceptor.ts)

**Expiry Actions:**
1. `validateAndUpdateAuthState()` detects expired token (line 324 of auth.service.ts)
2. Clears auth data via `clearAuthData()` (line 329)
3. Updates `isAuthenticatedSubject` to `false` (line 1865)
4. `authGuard` redirects to `/login` with `returnUrl` (lines 42-47)

**Critical Lines:**
- 324 (expiry detection)
- 329 (clear auth data)
- 1865 (update auth state)

---

## 8. Authorization Flow Diagrams

### 8.1 Initial Login Flow

```
[User] → [Login Page]
   ↓
[OAuth Provider] → [TMI Backend /oauth2/authorize]
   ↓
[TMI Backend] ← [Provider Callback]
   ↓
[TMI Backend] → [JWT Token Generation]
   ↓
[Frontend /oauth2/callback] ← [access_token, refresh_token]
   ↓
[AuthService.handleOAuthCallback()]
   ↓
[Extract user profile from JWT] → tmi_is_administrator, tmi_is_security_reviewer
   ↓
[Store token (encrypted)] → localStorage['auth_token']
   ↓
[Store profile (encrypted)] → localStorage['user_profile']
   ↓
[Update BehaviorSubjects] → isAuthenticated$ = true, userProfile$ = {...}
   ↓
[Fetch fresh profile] → GET /me
   ↓
[Merge JWT + server profile] → Update cached profile with is_admin, is_security_reviewer
   ↓
[Navigate to landing page] → /dashboard (reviewer) or /admin (admin) or /intake (user)
```

---

### 8.2 Admin Route Access Flow

```
[User] → Navigate to /admin/users
   ↓
[Router] → authGuard
   ↓
[authGuard.validateAndUpdateAuthState()] → Check token expiry
   ↓
[authGuard checks isAuthenticated$]
   ├─ false → Redirect to /login?returnUrl=/admin/users
   └─ true → Allow navigation
       ↓
   [Router] → adminGuard
       ↓
   [adminGuard.refreshUserProfile()] → GET /me
       ↓
   [Backend validates JWT signature] → Returns user profile
       ↓
   [Check userProfile.is_admin]
       ├─ false → Redirect to /dashboard?error=admin_required
       └─ true → Allow navigation
           ↓
       [Component loads]
```

---

### 8.3 Threat Model Access Flow

```
[User] → Navigate to /tm/tm-123
   ↓
[Router] → authGuard
   ↓
[authGuard.validateAndUpdateAuthState()] → Check token expiry
   ↓
[authGuard checks isAuthenticated$]
   ├─ false → Redirect to /login?returnUrl=/tm/tm-123
   └─ true → Allow navigation
       ↓
   [Router] → threatModelResolver
       ↓
   [threatModelResolver] → ThreatModelService.getThreatModelById('tm-123')
       ↓
   [ThreatModelService] → GET /threat_models/tm-123 (with Authorization: Bearer <token>)
       ↓
   [Backend validates JWT and checks authorization]
       ├─ 401 → JWT interceptor → Forced token refresh → Retry
       ├─ 403 → Resolver redirects to /dashboard?error=access_denied
       └─ 200 → Return threat model with owner + authorization array
           ↓
       [ThreatModelService.setAuthorization()] → Updates ThreatModelAuthorizationService
           ↓
       [ThreatModelAuthorizationService.calculateUserPermission()]
           ↓
       [Check owner field] → (provider, provider_id) match?
           ├─ Match → permission = 'owner'
           └─ No match → Check authorization array
               ↓
           [Scan authorization entries]
               ├─ User principal match → permission = entry.role
               ├─ Group 'everyone' → permission = entry.role
               ├─ Group membership match → permission = entry.role
               └─ No match → permission = null
                   ↓
       [Update canEdit$, canManagePermissions$ observables]
           ↓
       [Component subscribes to observables]
           ↓
       [Component enables/disables UI based on permissions]
```

---

### 8.4 API Call with Authorization Header

```
[Component] → ThreatModelService.deleteThreat('tm-123', 'threat-456')
   ↓
[ThreatModelService] → ApiService.delete('/threat_models/tm-123/threats/threat-456')
   ↓
[HTTP Request] → JWT Interceptor
   ↓
[JwtInterceptor.intercept()]
   ↓
[Check if public endpoint]
   ├─ Yes → Pass through without token
   └─ No → authService.getValidToken()
       ↓
   [Check token expiry]
       ├─ Expired → refreshToken() → POST /oauth2/refresh
       └─ Valid → Return token
           ↓
   [Clone request + add header] → Authorization: Bearer <token>
       ↓
   [Send request to backend]
       ↓
   [Backend validates JWT signature]
       ↓
   [Backend checks threat model authorization]
       ├─ User not authorized → 403 Forbidden
       ├─ Token invalid → 401 Unauthorized → JWT interceptor forced refresh → Retry
       └─ Authorized → 200 OK → Delete threat
           ↓
       [Response] → ThreatModelService
           ↓
       [Update cache] → Remove threat from _cachedThreatModels
           ↓
       [Return success] → Component
```

---

## 9. Identified Weaknesses Summary

| # | Weakness | Severity | Location | Mitigation |
|---|----------|----------|----------|------------|
| 1 | Frontend-only authorization checks | **HIGH** | Component methods (tm-edit.component.ts lines 903, 942, etc.) | Backend MUST validate all write operations |
| 2 | Stale role information | **MEDIUM** | AuthService user profile caching | Add periodic profile refresh or refresh on authGuard |
| 3 | No service-level authorization checks | **CRITICAL** | ThreatModelService CRUD methods (lines 993, 1061, etc.) | Backend MUST validate permissions on every operation |
| 4 | Race conditions in guard execution | **LOW** | Guard async resolution | Backend enforcement is primary defense |
| 5 | Client-side JWT decoding without signature verification | **LOW** | AuthService (lines 202, 222, etc.) | Backend MUST verify JWT signatures |
| 6 | Cross-tab logout synchronization gaps | **LOW** | Token validity guard (line 158) | Token expiry provides fallback defense |
| 7 | Authorization calculation entirely client-side | **HIGH** | ThreatModelAuthorizationService.calculateUserPermission() | Backend MUST recalculate permissions on every request |

---

## 10. Authorization Bypass Candidates

### 10.1 High-Probability Bypasses

**1. Component-Level Authorization Bypass**
- **Method:** Modify `canEdit` or `canManagePermissions` in browser console
- **Access Gained:** UI becomes editable, API calls execute
- **Success Depends On:** Whether backend validates permissions
- **Test:** Set `component.canEdit = true` in DevTools, attempt delete operation

**2. Service Method Direct Invocation**
- **Method:** Inject `ThreatModelService` in console, call CRUD methods directly
- **Access Gained:** Bypass component-level checks entirely
- **Success Depends On:** Whether backend validates permissions
- **Test:** 
  ```javascript
  const service = ng.probe(document.querySelector('app-root')).injector.get('ThreatModelService');
  service.deleteThreat('tm-123', 'threat-456').subscribe(console.log);
  ```

**3. Authorization State Manipulation**
- **Method:** Modify `ThreatModelAuthorizationService._authorizationSubject` to grant owner permission
- **Access Gained:** UI enables owner-level operations
- **Success Depends On:** Whether backend validates permissions
- **Test:**
  ```javascript
  const authzService = ng.probe(document.querySelector('app-root')).injector.get('ThreatModelAuthorizationService');
  authzService._authorizationSubject.next([
    {principal_type: 'user', provider: 'google', provider_id: 'attacker-id', role: 'owner'}
  ]);
  ```

---

### 10.2 Medium-Probability Bypasses

**4. Stale Admin Status Exploitation**
- **Method:** User granted admin, logs in, admin revoked, continues using cached admin status
- **Access Gained:** Admin UI remains accessible until next admin guard activation
- **Success Depends On:** Whether backend validates admin role on operations
- **Window:** Between admin revocation and next navigation to admin route

**5. JWT Token Forgery**
- **Method:** Modify JWT payload to set `tmi_is_administrator: true`, inject into localStorage
- **Access Gained:** Frontend treats user as admin
- **Success Depends On:** Whether backend validates JWT signature (should fail)
- **Likelihood:** LOW if backend properly validates signatures

---

### 10.3 Low-Probability Bypasses

**6. Race Condition in Token Refresh**
- **Method:** Rapidly navigate during token expiry window
- **Access Gained:** Brief access to route before token validation completes
- **Window:** Milliseconds between navigation start and guard resolution
- **Likelihood:** Very low, requires precise timing

**7. Cross-Tab Logout Evasion**
- **Method:** Block localStorage events to prevent cross-tab logout synchronization
- **Access Gained:** Remain "authenticated" in one tab after logging out in another
- **Window:** Until token expiry or next validation
- **Mitigation:** Token expiry eventually enforces logout

---

## 11. Recommendations

### 11.1 Critical Fixes

1. **Backend Authorization Enforcement**
   - Every API endpoint MUST validate user permissions independently
   - Do NOT trust frontend authorization state
   - Implement middleware/interceptors for consistent enforcement

2. **Service-Level Authorization Checks**
   - Add authorization validation in ThreatModelService before API calls
   - Example:
     ```typescript
     deleteThreat(threatModelId: string, threatId: string): Observable<boolean> {
       if (!this.authorizationService.canEdit()) {
         return throwError(() => new Error('Insufficient permissions'));
       }
       return this.apiService.delete(`threat_models/${threatModelId}/threats/${threatId}`);
     }
     ```

### 11.2 High-Priority Improvements

3. **Periodic Profile Refresh**
   - Refresh user profile every 5 minutes to prevent stale role information
   - OR add profile refresh to `authGuard` for all protected routes

4. **Authorization State Validation**
   - Add backend API call to validate current user's permission on threat model before sensitive operations
   - Example: Add `GET /threat_models/:id/permissions/me` endpoint

### 11.3 Medium-Priority Enhancements

5. **JWT Token Binding**
   - Consider binding JWT tokens to browser fingerprint or device ID
   - Prevents token theft and reuse from different contexts

6. **Authorization Audit Logging**
   - Log all authorization decisions (grants and denials) server-side
   - Include user identity, resource, operation, timestamp

7. **Token Refresh Limits**
   - Implement refresh token rotation with max refresh count
   - Expire refresh tokens after extended inactivity

---

## 12. Conclusion

The TMI-UX Angular application implements a comprehensive authorization architecture with multiple layers of defense:

- **Route Guards:** Prevent navigation to protected routes
- **Role-Based Access Control:** Admin and Security Reviewer roles
- **Resource-Level Authorization:** Owner/Writer/Reader permissions for threat models
- **Token Management:** JWT with automatic refresh and expiry handling

**However, the primary weakness is reliance on frontend enforcement:**
- Component-level checks can be bypassed via DevTools
- Service methods lack authorization validation before API calls
- Authorization calculations happen client-side without backend re-validation

**The security posture depends entirely on backend API enforcement.** If the backend properly validates:
- JWT signatures
- User roles (admin, reviewer)
- Resource permissions (threat model authorization)

Then the frontend authorization system provides excellent **defense-in-depth** and **user experience** but NOT primary security.

**If the backend trusts frontend state or fails to validate permissions, the application is vulnerable to complete authorization bypass.**

---

## Appendix A: File Locations

| Component | File Path |
|-----------|-----------|
| **Guards** | |
| authGuard | `/app/repos/tmi-ux/src/app/auth/guards/auth.guard.ts` |
| adminGuard | `/app/repos/tmi-ux/src/app/auth/guards/admin.guard.ts` |
| reviewerGuard | `/app/repos/tmi-ux/src/app/auth/guards/reviewer.guard.ts` |
| homeGuard | `/app/repos/tmi-ux/src/app/auth/guards/home.guard.ts` |
| **Services** | |
| AuthService | `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` |
| ThreatModelAuthorizationService | `/app/repos/tmi-ux/src/app/pages/tm/services/threat-model-authorization.service.ts` |
| ThreatModelService | `/app/repos/tmi-ux/src/app/pages/tm/services/threat-model.service.ts` |
| TokenValidityGuardService | `/app/repos/tmi-ux/src/app/auth/services/token-validity-guard.service.ts` |
| **Interceptors** | |
| JwtInterceptor | `/app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts` |
| HttpLoggingInterceptor | `/app/repos/tmi-ux/src/app/core/interceptors/http-logging.interceptor.ts` |
| SecurityHeadersInterceptor | `/app/repos/tmi-ux/src/app/core/interceptors/security-headers.interceptor.ts` |
| **Resolvers** | |
| threatModelResolver | `/app/repos/tmi-ux/src/app/pages/tm/resolvers/threat-model.resolver.ts` |
| **Routes** | |
| App Routes | `/app/repos/tmi-ux/src/app/app.routes.ts` |
| Threat Model Routes | `/app/repos/tmi-ux/src/app/pages/tm/tm.routes.ts` |
| Triage Routes | `/app/repos/tmi-ux/src/app/pages/triage/triage.routes.ts` |
| Survey Routes | `/app/repos/tmi-ux/src/app/pages/surveys/surveys.routes.ts` |
| Dashboard Routes | `/app/repos/tmi-ux/src/app/pages/dashboard/dashboard.routes.ts` |
| **Configuration** | |
| App Config | `/app/repos/tmi-ux/src/app/app.config.ts` |

---

## Appendix B: Key Code References

### B.1 JWT Token Structure
**File:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts`  
**Lines:** 56-72

### B.2 Admin Role Validation
**File:** `/app/repos/tmi-ux/src/app/auth/guards/admin.guard.ts`  
**Lines:** 26-39

### B.3 Threat Model Permission Calculation
**File:** `/app/repos/tmi-ux/src/app/pages/tm/services/threat-model-authorization.service.ts`  
**Lines:** 172-221

### B.4 Token Refresh on 401
**File:** `/app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts`  
**Lines:** 164-231

### B.5 Component Authorization Check
**File:** `/app/repos/tmi-ux/src/app/pages/tm/tm-edit.component.ts`  
**Lines:** 624-633, 903, 942, 989, 1255, 1407

---

**End of Report**
