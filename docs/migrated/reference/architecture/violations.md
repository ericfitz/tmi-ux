# Architecture Violations - RESOLVED

> **Status: ALL RESOLVED** - This document is retained for historical reference.
>
> The violations documented here were identified in September 2025 and have since been resolved.
> The resolution followed the planned approach of introducing interfaces in the core layer.

This document tracked architecture violations that were identified by ESLint architecture validation rules. All violations have been resolved by implementing the interface pattern described in the resolution plan.

## Resolution Summary

The following violations were resolved by creating interfaces in `src/app/core/interfaces/`:

| Violation | Status | Resolution |
|-----------|--------|------------|
| ApiService → AuthService | RESOLVED | Uses `IAuthService` from `core/interfaces` |
| DfdCollaborationService → AuthService | RESOLVED | Uses `IAuthService` from `core/interfaces` |
| DfdCollaborationService → ThreatModelService | RESOLVED | Uses `IThreatModelService` from `core/interfaces` |

### Interfaces Created

- `core/interfaces/auth.interface.ts` - Defines `IAuthService` with token and user profile methods
- `core/interfaces/threat-model.interface.ts` - Defines `IThreatModelService` with collaboration session methods
- `core/interfaces/index.ts` - Exports interfaces and injection tokens (`AUTH_SERVICE`, `THREAT_MODEL_SERVICE`)

### Current Implementation

**ApiService** (`src/app/core/services/api.service.ts`):
```typescript
import { AUTH_SERVICE, IAuthService } from '../interfaces';

constructor(
  @Inject(AUTH_SERVICE) private authService: IAuthService,
  // ...
) {}
```

**DfdCollaborationService** (`src/app/core/services/dfd-collaboration.service.ts`):
```typescript
import {
  IAuthService,
  IThreatModelService,
  AUTH_SERVICE,
  THREAT_MODEL_SERVICE,
} from '../interfaces';

constructor(
  @Inject(AUTH_SERVICE) private _authService: IAuthService,
  @Inject(THREAT_MODEL_SERVICE) private _threatModelService: IThreatModelService,
  // ...
) {}
```

---

## Historical Record

The sections below document the original violations for historical reference.

### Original Violation 1: ApiService → AuthService

**Files:**

- `src/app/core/services/api.service.ts`
- `src/app/core/services/api.service.spec.ts`

**Violation:** Core service importing from auth feature module

**Impact:** Created circular dependency potential and violated clean architecture

**Resolution Applied:** ApiService now depends on `IAuthService` interface via dependency injection.

### Original Violation 2: DfdCollaborationService → AuthService & ThreatModelService

**File:** `src/app/core/services/dfd-collaboration.service.ts`

**Violations:**

- Imports AuthService from auth feature
- Imports ThreatModelService from pages/tm feature

**Impact:** Core service had direct dependencies on two feature modules

**Resolution Applied:** DfdCollaborationService now depends on `IAuthService` and `IThreatModelService` interfaces via dependency injection.

## Original Resolution Plan (Completed)

The resolution followed these phases:

### Phase 1: Create Interfaces (COMPLETED)

Created interfaces in `core/interfaces/`:

```typescript
// core/interfaces/auth.interface.ts
export interface IAuthService {
  readonly userProfile: IUserProfile | null;
  readonly userEmail: string;
  readonly providerId: string;
  readonly userIdp: string;
  readonly userGroups: string[];
  getStoredToken(): IJwtToken | null;
  getValidToken(): Observable<IJwtToken>;
  refreshUserProfile(): Observable<UserProfile>;
  logout(): void;
}

// core/interfaces/threat-model.interface.ts
export interface IThreatModelService {
  getDiagramCollaborationSession(threatModelId: string, diagramId: string): Observable<CollaborationSession | null>;
  createDiagramCollaborationSession(threatModelId: string, diagramId: string): Observable<CollaborationSession>;
  startDiagramCollaborationSession(threatModelId: string, diagramId: string): Observable<CollaborationSession>;
  startOrJoinDiagramCollaborationSession(threatModelId: string, diagramId: string): Observable<{ session: CollaborationSession; isNewSession: boolean }>;
  endDiagramCollaborationSession(threatModelId: string, diagramId: string): Observable<void>;
}
```

### Phase 2: Implement Interfaces (COMPLETED)

Feature services implement the interfaces:

- AuthService implements IAuthService
- ThreatModelService implements IThreatModelService

### Phase 3: Update Core Services (COMPLETED)

Core services depend on interfaces via injection tokens.

### Phase 4: Wire Dependencies (COMPLETED)

Providers configured in `app.config.ts`.

## Tracking

- **Created:** 2025-09-05
- **Resolved:** Prior to 2026-01-25 (verified)
- **Priority:** Medium (was)
- **Estimated Effort:** 4-6 hours
- **Actual Effort:** Completed as part of normal development
- **Breaking Change:** No (interfaces were additive)
