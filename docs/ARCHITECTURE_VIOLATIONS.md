# Known Architecture Violations

This document tracks known architecture violations that need to be addressed. These violations were identified by our ESLint architecture validation rules.

## Core Services Importing from Features

### 1. ApiService → AuthService
**Files:**
- `src/app/core/services/api.service.ts`
- `src/app/core/services/api.service.spec.ts`

**Violation:** Core service importing from auth feature module

**Impact:** Creates circular dependency potential and violates clean architecture

**Solution:**
1. Create an interface in `core/interfaces/auth-token-provider.interface.ts`
2. Have AuthService implement this interface
3. Update ApiService to depend on the interface

### 2. DfdCollaborationService → AuthService & ThreatModelService
**File:** `src/app/core/services/dfd-collaboration.service.ts`

**Violations:**
- Imports AuthService from auth feature
- Imports ThreatModelService from pages/tm feature

**Impact:** Core service has direct dependencies on two feature modules

**Solution:**
1. Create interfaces for required functionality:
   - `core/interfaces/user-provider.interface.ts`
   - `core/interfaces/threat-model-provider.interface.ts`
2. Have feature services implement these interfaces
3. Update DfdCollaborationService to use interfaces

## Resolution Plan

### Phase 1: Create Interfaces
```typescript
// core/interfaces/auth-token-provider.interface.ts
export interface AuthTokenProvider {
  getAccessToken(): string | null;
  isAuthenticated(): boolean;
}

// core/interfaces/user-provider.interface.ts
export interface UserProvider {
  getCurrentUser(): Observable<User | null>;
}

// core/interfaces/threat-model-provider.interface.ts
export interface ThreatModelProvider {
  getThreatModel(id: string): Observable<ThreatModel>;
}
```

### Phase 2: Implement Interfaces
Update feature services to implement the interfaces:
- AuthService implements AuthTokenProvider and UserProvider
- ThreatModelService implements ThreatModelProvider

### Phase 3: Update Core Services
Update core services to depend on interfaces instead of concrete implementations:
- Inject using @Optional() decorator
- Handle cases where provider might not be available

### Phase 4: Wire Dependencies
Configure providers at the appropriate level (app.config.ts or component providers)

## Temporary Workaround

Until these violations are resolved, you can disable the ESLint rule for specific files:

```javascript
// eslint-disable-next-line no-restricted-imports
import { AuthService } from '../../auth/services/auth.service';
```

## Tracking

- **Created:** 2025-09-05
- **Priority:** Medium
- **Estimated Effort:** 4-6 hours
- **Breaking Change:** No (interfaces are additive)