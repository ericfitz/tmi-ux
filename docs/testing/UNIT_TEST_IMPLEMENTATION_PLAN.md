# Unit Test Implementation Plan

**Generated:** 2025-12-12
**Status:** Planning
**Coverage Goal:** 100% of services tested

## Executive Summary

This document outlines the implementation plan for unit tests across all services in the TMI-UX project that currently lack test coverage. Of 70 total services, 30 (42.9%) have tests, leaving 40 services without coverage.

## Test Framework & Standards

### Technology Stack
- **Test Framework:** Vitest (NOT Jasmine or Jest)
- **Async Pattern:** Promises with `async/await` and `.toPromise()` (NO `done()` callbacks)
- **Test Environment:** jsdom with Angular compiler
- **Test Organization:** Co-located `.spec.ts` files alongside source files

### Testing Patterns

#### Standard Test Structure
```typescript
// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Execute all tests using: "pnpm run test"
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ServiceUnderTest } from './service-under-test.service';
import { createTypedMockLoggerService, type MockLoggerService } from '@testing/mocks';

describe('ServiceUnderTest', () => {
  let service: ServiceUnderTest;
  let mockDependency: MockDependency;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDependency = createTypedMock();
    service = new ServiceUnderTest(mockDependency as unknown as Dependency);
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  // Additional test suites...
});
```

#### Key Patterns from Existing Tests
1. **Service Initialization:** Always test service creation
2. **Mock Dependencies:** Use typed mocks from `src/testing/mocks`
3. **Observable Testing:** Subscribe and assert, use `.toPromise()` for async
4. **Error Handling:** Test both success and error paths
5. **State Management:** Test observable emissions and state changes
6. **API Calls:** Verify correct endpoint, params, and response handling

## Services Requiring Tests (40 total)

### Priority 1: Core Services (10 services)

Critical application-wide services that need immediate test coverage.

#### 1. addon.service.ts
**Location:** `src/app/core/services/addon.service.ts`
**Dependencies:** ApiService, LoggerService
**Test Focus:**
- API endpoint calls for addon operations
- Response transformation and caching
- Error handling for addon failures

**Estimated Complexity:** Medium
**Test File:** `src/app/core/services/addon.service.spec.ts`

#### 2. administrator.service.ts
**Location:** `src/app/core/services/administrator.service.ts`
**Dependencies:** ApiService, LoggerService
**Test Focus:**
- Admin operations (likely CRUD)
- Permission validation
- Error handling for unauthorized access

**Estimated Complexity:** Medium
**Test File:** `src/app/core/services/administrator.service.spec.ts`

#### 3. collaboration-session.service.ts
**Location:** `src/app/core/services/collaboration-session.service.ts`
**Dependencies:** WebSocketService, LoggerService
**Test Focus:**
- Session lifecycle (create, join, leave)
- State management observables
- WebSocket event handling
- User presence tracking

**Estimated Complexity:** High
**Test File:** `src/app/core/services/collaboration-session.service.spec.ts`

#### 4. dfd-collaboration.service.ts
**Location:** `src/app/core/services/dfd-collaboration.service.ts`
**Dependencies:** WebSocketService, CollaborationSessionService, LoggerService
**Test Focus:**
- DFD-specific collaboration events
- Operation broadcasting
- Remote operation handling
- Cursor position sharing

**Estimated Complexity:** High
**Test File:** `src/app/core/services/dfd-collaboration.service.spec.ts`

#### 5. dialog-direction.service.ts
**Location:** `src/app/core/services/dialog-direction.service.ts`
**Dependencies:** Minimal (utility service)
**Test Focus:**
- RTL/LTR direction detection
- Direction override functionality
- Observable state changes

**Estimated Complexity:** Low
**Test File:** `src/app/core/services/dialog-direction.service.spec.ts`

#### 6. operator.service.ts
**Location:** `src/app/core/services/operator.service.ts`
**Dependencies:** ApiService, LoggerService
**Test Focus:**
- Operator information retrieval
- Configuration management
- Error handling

**Estimated Complexity:** Low
**Test File:** `src/app/core/services/operator.service.spec.ts`

#### 7. quota.service.ts
**Location:** `src/app/core/services/quota.service.ts`
**Dependencies:** ApiService, LoggerService
**Test Focus:**
- Quota checking and enforcement
- Usage tracking
- Limit exceeded handling
- Observable state for quota updates

**Estimated Complexity:** Medium
**Test File:** `src/app/core/services/quota.service.spec.ts`

#### 8. server-connection.service.ts
**Location:** `src/app/core/services/server-connection.service.ts`
**Dependencies:** HttpClient, LoggerService
**Test Focus:**
- Connection status monitoring
- Heartbeat/polling mechanism
- Reconnection logic
- Status observable emissions

**Estimated Complexity:** High
**Test File:** `src/app/core/services/server-connection.service.spec.ts`

#### 9. theme.service.ts
**Location:** `src/app/core/services/theme.service.ts`
**Dependencies:** Document, LocalStorage
**Test Focus:**
- Theme switching (light/dark/auto)
- Persistence to localStorage
- CSS class application
- System preference detection
- Observable state changes

**Estimated Complexity:** Medium
**Test File:** `src/app/core/services/theme.service.spec.ts`

#### 10. webhook.service.ts
**Location:** `src/app/core/services/webhook.service.ts`
**Dependencies:** ApiService, LoggerService
**Test Focus:**
- Webhook CRUD operations
- Validation and testing
- Event triggering
- Error handling

**Estimated Complexity:** Medium
**Test File:** `src/app/core/services/webhook.service.spec.ts`

---

### Priority 2: Threat Model Services (8 services)

Services handling threat model import, authorization, and reporting.

#### 11. threat-model-authorization.service.ts
**Location:** `src/app/pages/tm/services/threat-model-authorization.service.ts`
**Dependencies:** ApiService, LoggerService
**Test Focus:**
- Permission checks (Owner/Writer/Reader)
- Authorization state observables
- Permission updates
- Error handling for forbidden access

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/tm/services/threat-model-authorization.service.spec.ts`

#### 12. threat-model-report.service.ts
**Location:** `src/app/pages/tm/services/threat-model-report.service.ts`
**Dependencies:** ApiService, LoggerService
**Test Focus:**
- Report generation (PDF, CSV, etc.)
- Template selection
- Data transformation
- Download handling

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/tm/services/threat-model-report.service.spec.ts`

#### 13. id-translation.service.ts
**Location:** `src/app/pages/tm/services/import/id-translation.service.ts`
**Dependencies:** LoggerService
**Test Focus:**
- ID mapping creation
- Translation lookups
- Collision handling
- State management

**Estimated Complexity:** Low
**Test File:** `src/app/pages/tm/services/import/id-translation.service.spec.ts`

#### 14. import-orchestrator.service.ts
**Location:** `src/app/pages/tm/services/import/import-orchestrator.service.ts`
**Dependencies:** Multiple import services, LoggerService
**Test Focus:**
- Import workflow orchestration
- Step sequencing
- Error recovery
- Progress tracking
- Rollback on failure

**Estimated Complexity:** High
**Test File:** `src/app/pages/tm/services/import/import-orchestrator.service.spec.ts`

#### 15. readonly-field-filter.service.ts
**Location:** `src/app/pages/tm/services/import/readonly-field-filter.service.ts`
**Dependencies:** Minimal
**Test Focus:**
- Field filtering logic
- Read-only field detection
- Data transformation

**Estimated Complexity:** Low
**Test File:** `src/app/pages/tm/services/import/readonly-field-filter.service.spec.ts`

#### 16. reference-rewriter.service.ts
**Location:** `src/app/pages/tm/services/import/reference-rewriter.service.ts`
**Dependencies:** IdTranslationService, LoggerService
**Test Focus:**
- Reference updating
- Foreign key rewriting
- Invalid reference handling

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/tm/services/import/reference-rewriter.service.spec.ts`

#### 17. authorization-prepare.service.ts
**Location:** `src/app/pages/tm/services/providers/authorization-prepare.service.ts`
**Dependencies:** ApiService, LoggerService
**Test Focus:**
- Authorization data preparation
- Provider-specific formatting
- Validation

**Estimated Complexity:** Low
**Test File:** `src/app/pages/tm/services/providers/authorization-prepare.service.spec.ts`

#### 18. provider-adapter.service.ts
**Location:** `src/app/pages/tm/services/providers/provider-adapter.service.ts`
**Dependencies:** ApiService, LoggerService
**Test Focus:**
- Provider abstraction
- Data transformation between formats
- Provider-specific operations

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/tm/services/providers/provider-adapter.service.spec.ts`

---

### Priority 3: DFD Application Services (11 services)

Core DFD diagram services for state management and operations.

#### 19. app-diagram.service.ts
**Location:** `src/app/pages/dfd/application/services/app-diagram.service.ts`
**Dependencies:** Multiple DFD services, LoggerService
**Test Focus:**
- Diagram CRUD operations
- State synchronization
- Observable emissions
- Error handling

**Estimated Complexity:** High
**Test File:** `src/app/pages/dfd/application/services/app-diagram.service.spec.ts`

#### 20. app-diagram-loading.service.ts
**Location:** `src/app/pages/dfd/application/services/app-diagram-loading.service.ts`
**Dependencies:** ApiService, GraphAdapter, LoggerService
**Test Focus:**
- Diagram loading from API
- Deserialization
- Error handling
- Loading state management

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/dfd/application/services/app-diagram-loading.service.spec.ts`

#### 21. app-diagram-operation-broadcaster.service.ts
**Location:** `src/app/pages/dfd/application/services/app-diagram-operation-broadcaster.service.ts`
**Dependencies:** WebSocketService, LoggerService
**Test Focus:**
- Operation broadcasting to collaborators
- Message formatting
- Error handling
- Debouncing/throttling

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/dfd/application/services/app-diagram-operation-broadcaster.service.spec.ts`

#### 22. app-diagram-resync.service.ts
**Location:** `src/app/pages/dfd/application/services/app-diagram-resync.service.ts`
**Dependencies:** ApiService, StateService, LoggerService
**Test Focus:**
- Resynchronization triggers
- Conflict resolution
- State merging
- Error recovery

**Estimated Complexity:** High
**Test File:** `src/app/pages/dfd/application/services/app-diagram-resync.service.spec.ts`

#### 23. app-event-handlers.service.ts
**Location:** `src/app/pages/dfd/application/services/app-event-handlers.service.ts`
**Dependencies:** X6 Graph, StateService, LoggerService
**Test Focus:**
- Graph event subscription
- Event delegation
- Handler registration
- Cleanup on destroy

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/dfd/application/services/app-event-handlers.service.spec.ts`

#### 24. app-export.service.ts
**Location:** `src/app/pages/dfd/application/services/app-export.service.ts`
**Dependencies:** X6 Graph, LoggerService
**Test Focus:**
- PNG/SVG/PDF export
- Image quality settings
- Download handling
- Error handling

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/dfd/application/services/app-export.service.spec.ts`

#### 25. app-history.service.ts
**Location:** `src/app/pages/dfd/application/services/app-history.service.ts`
**Dependencies:** X6 Graph, LoggerService
**Test Focus:**
- Undo/redo functionality
- History stack management
- State snapshots
- Operation grouping

**Estimated Complexity:** High
**Test File:** `src/app/pages/dfd/application/services/app-history.service.spec.ts`

#### 26. app-operation-rejection-handler.service.ts
**Location:** `src/app/pages/dfd/application/services/app-operation-rejection-handler.service.ts`
**Dependencies:** StateService, NotificationService, LoggerService
**Test Focus:**
- Operation rejection handling
- Rollback logic
- User notification
- Conflict resolution

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/dfd/application/services/app-operation-rejection-handler.service.spec.ts`

#### 27. app-operation-state-manager.service.ts
**Location:** `src/app/pages/dfd/application/services/app-operation-state-manager.service.ts`
**Dependencies:** LoggerService
**Test Focus:**
- Operation state tracking
- Pending operations management
- State transitions
- Observable emissions

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/dfd/application/services/app-operation-state-manager.service.spec.ts`

#### 28. app-state.service.ts
**Location:** `src/app/pages/dfd/application/services/app-state.service.ts`
**Dependencies:** LoggerService
**Test Focus:**
- Centralized state management
- State observables
- State updates
- State validation

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/dfd/application/services/app-state.service.spec.ts`

#### 29. app-svg-optimization.service.ts
**Location:** `src/app/pages/dfd/application/services/app-svg-optimization.service.ts`
**Dependencies:** LoggerService
**Test Focus:**
- SVG minification
- Attribute optimization
- Performance metrics
- Error handling

**Estimated Complexity:** Low
**Test File:** `src/app/pages/dfd/application/services/app-svg-optimization.service.spec.ts`

---

### Priority 4: DFD Presentation Services (5 services)

UI-layer services for cursor, selection, and tooltips.

#### 30. ui-presenter-coordinator.service.ts
**Location:** `src/app/pages/dfd/presentation/services/ui-presenter-coordinator.service.ts`
**Dependencies:** Other UI presenter services, LoggerService
**Test Focus:**
- Presenter orchestration
- Event coordination
- State synchronization

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/dfd/presentation/services/ui-presenter-coordinator.service.spec.ts`

#### 31. ui-presenter-cursor.service.ts
**Location:** `src/app/pages/dfd/presentation/services/ui-presenter-cursor.service.ts`
**Dependencies:** X6 Graph, LoggerService
**Test Focus:**
- Cursor position tracking
- Remote cursor rendering
- User identification
- Position updates

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/dfd/presentation/services/ui-presenter-cursor.service.spec.ts`

#### 32. ui-presenter-cursor-display.service.ts
**Location:** `src/app/pages/dfd/presentation/services/ui-presenter-cursor-display.service.ts`
**Dependencies:** DOM, LoggerService
**Test Focus:**
- Cursor visual rendering
- DOM manipulation
- Animation handling
- Cleanup

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/dfd/presentation/services/ui-presenter-cursor-display.service.spec.ts`

#### 33. ui-presenter-selection.service.ts
**Location:** `src/app/pages/dfd/presentation/services/ui-presenter-selection.service.ts`
**Dependencies:** X6 Graph, LoggerService
**Test Focus:**
- Selection state management
- Multi-selection handling
- Visual feedback
- Observable emissions

**Estimated Complexity:** Medium
**Test File:** `src/app/pages/dfd/presentation/services/ui-presenter-selection.service.spec.ts`

#### 34. ui-tooltip.service.ts
**Location:** `src/app/pages/dfd/presentation/services/ui-tooltip.service.ts`
**Dependencies:** DOM, LoggerService
**Test Focus:**
- Tooltip display/hide
- Positioning logic
- Content formatting
- Timing control

**Estimated Complexity:** Low
**Test File:** `src/app/pages/dfd/presentation/services/ui-tooltip.service.spec.ts`

---

### Priority 5: Shared Services (4 services)

Reusable services across the application.

#### 35. cell-data-extraction.service.ts
**Location:** `src/app/shared/services/cell-data-extraction.service.ts`
**Dependencies:** Minimal
**Test Focus:**
- Data extraction from X6 cells
- Type conversion
- Validation
- Error handling

**Estimated Complexity:** Low
**Test File:** `src/app/shared/services/cell-data-extraction.service.spec.ts`

#### 36. form-validation.service.ts
**Location:** `src/app/shared/services/form-validation.service.ts`
**Dependencies:** Angular Forms
**Test Focus:**
- Custom validators
- Validation messages
- Async validation
- Form state management

**Estimated Complexity:** Medium
**Test File:** `src/app/shared/services/form-validation.service.spec.ts`

#### 37. framework.service.ts
**Location:** `src/app/shared/services/framework.service.ts`
**Dependencies:** ApiService, LoggerService
**Test Focus:**
- Framework CRUD operations
- Framework selection
- Observable state
- Error handling

**Estimated Complexity:** Low
**Test File:** `src/app/shared/services/framework.service.spec.ts`

#### 38. notification.service.ts
**Location:** `src/app/shared/services/notification.service.ts`
**Dependencies:** MatSnackBar, LoggerService
**Test Focus:**
- Notification display
- Duration handling
- Action callbacks
- Queue management

**Estimated Complexity:** Low
**Test File:** `src/app/shared/services/notification.service.spec.ts`

---

### Priority 6: I18N Services (2 services)

Internationalization services.

#### 39. language.service.ts
**Location:** `src/app/i18n/language.service.ts`
**Dependencies:** TranslocoService, LoggerService
**Test Focus:**
- Language switching
- Persistence
- Available languages
- Observable state changes

**Estimated Complexity:** Low
**Test File:** `src/app/i18n/language.service.spec.ts`

#### 40. transloco-loader.service.ts
**Location:** `src/app/i18n/transloco-loader.service.ts`
**Dependencies:** HttpClient
**Test Focus:**
- Translation file loading
- Caching
- Error handling
- Fallback behavior

**Estimated Complexity:** Low
**Test File:** `src/app/i18n/transloco-loader.service.spec.ts`

---

## Implementation Strategy

### Phase 1: Foundation (Week 1)
**Goal:** Establish patterns and complete Priority 1 Core Services

- [ ] Create mock helpers for commonly used dependencies
- [ ] Implement tests for `dialog-direction.service.ts` (simplest)
- [ ] Implement tests for `operator.service.ts`
- [ ] Implement tests for `addon.service.ts`
- [ ] Implement tests for `administrator.service.ts`
- [ ] Implement tests for `quota.service.ts`
- [ ] Implement tests for `webhook.service.ts`
- [ ] Implement tests for `theme.service.ts`
- [ ] Implement tests for `server-connection.service.ts`
- [ ] Implement tests for `collaboration-session.service.ts`
- [ ] Implement tests for `dfd-collaboration.service.ts`

**Success Criteria:** All 10 core services tested, patterns documented

### Phase 2: Feature Services (Week 2)
**Goal:** Complete Priority 2 (TM) and Priority 5 (Shared) services

**Threat Model Services:**
- [ ] `id-translation.service.ts`
- [ ] `readonly-field-filter.service.ts`
- [ ] `authorization-prepare.service.ts`
- [ ] `reference-rewriter.service.ts`
- [ ] `provider-adapter.service.ts`
- [ ] `threat-model-authorization.service.ts`
- [ ] `threat-model-report.service.ts`
- [ ] `import-orchestrator.service.ts`

**Shared Services:**
- [ ] `cell-data-extraction.service.ts`
- [ ] `framework.service.ts`
- [ ] `notification.service.ts`
- [ ] `form-validation.service.ts`

**Success Criteria:** 12 services tested, 70% overall coverage

### Phase 3: DFD Services (Week 3)
**Goal:** Complete Priority 3 (DFD Application) and Priority 4 (DFD Presentation)

**DFD Application:**
- [ ] `app-svg-optimization.service.ts`
- [ ] `app-diagram-loading.service.ts`
- [ ] `app-diagram-operation-broadcaster.service.ts`
- [ ] `app-operation-state-manager.service.ts`
- [ ] `app-event-handlers.service.ts`
- [ ] `app-export.service.ts`
- [ ] `app-operation-rejection-handler.service.ts`
- [ ] `app-state.service.ts`
- [ ] `app-diagram-resync.service.ts`
- [ ] `app-history.service.ts`
- [ ] `app-diagram.service.ts`

**DFD Presentation:**
- [ ] `ui-tooltip.service.ts`
- [ ] `ui-presenter-cursor-display.service.ts`
- [ ] `ui-presenter-cursor.service.ts`
- [ ] `ui-presenter-selection.service.ts`
- [ ] `ui-presenter-coordinator.service.ts`

**Success Criteria:** 16 services tested, 90% overall coverage

### Phase 4: I18N & Finalization (Week 4)
**Goal:** Complete remaining services and achieve 100% coverage

- [ ] `language.service.ts`
- [ ] `transloco-loader.service.ts`
- [ ] Review and refactor tests for consistency
- [ ] Document testing patterns
- [ ] Generate coverage report

**Success Criteria:** 100% service test coverage achieved

## Testing Guidelines

### Required Test Coverage

Each service test should include:

1. **Service Initialization**
   - Service creation
   - Initial state validation
   - Observable initialization

2. **Public Methods**
   - Success cases with valid inputs
   - Error cases with invalid inputs
   - Edge cases (null, undefined, empty)
   - Observable emissions

3. **State Management**
   - State transitions
   - Observable updates
   - Side effects

4. **Error Handling**
   - API errors
   - Validation errors
   - Network errors
   - Recovery mechanisms

5. **Integration Points**
   - Dependency interactions
   - Event handling
   - WebSocket messages (if applicable)

### Async Testing Patterns

**Preferred Pattern (Promise-based):**
```typescript
it('should handle async operation', async () => {
  mockService.get.mockReturnValue(of(mockData));

  const result = await service.fetchData().toPromise();

  expect(result).toEqual(mockData);
  expect(mockService.get).toHaveBeenCalled();
});
```

**Alternative (Subscribe):**
```typescript
it('should handle async operation', () => {
  mockService.get.mockReturnValue(of(mockData));

  service.fetchData().subscribe(result => {
    expect(result).toEqual(mockData);
    expect(mockService.get).toHaveBeenCalled();
  });
});
```

**Error Testing:**
```typescript
it('should handle errors', async () => {
  const error = new Error('Test error');
  mockService.get.mockReturnValue(throwError(() => error));

  try {
    await service.fetchData().toPromise();
    fail('Should have thrown error');
  } catch (err) {
    expect(err).toBe(error);
    expect(mockLogger.error).toHaveBeenCalled();
  }
});
```

### Mock Service Creation

Use typed mocks from `src/testing/mocks`:

```typescript
import {
  createTypedMockLoggerService,
  createTypedMockHttpClient,
  createTypedMockRouter,
  type MockLoggerService,
  type MockHttpClient,
  type MockRouter,
} from '@testing/mocks';

let mockLogger: MockLoggerService;
let mockHttp: MockHttpClient;
let mockRouter: MockRouter;

beforeEach(() => {
  vi.clearAllMocks();
  mockLogger = createTypedMockLoggerService();
  mockHttp = createTypedMockHttpClient(defaultResponse);
  mockRouter = createTypedMockRouter('/current-url');
});
```

## Metrics & Success Criteria

### Current State
- **Total Services:** 70
- **Services with Tests:** 30 (42.9%)
- **Services without Tests:** 40 (57.1%)

### Target State
- **Total Services:** 70
- **Services with Tests:** 70 (100%)
- **Services without Tests:** 0 (0%)

### Coverage by Module

| Module | Current | Target | Gap |
|--------|---------|--------|-----|
| Core Services | 8/18 (44.4%) | 18/18 (100%) | 10 |
| Auth Services | 3/3 (100%) | 3/3 (100%) | 0 ✓ |
| TM Services | 2/10 (20%) | 10/10 (100%) | 8 |
| TM Validation | 1/1 (100%) | 1/1 (100%) | 0 ✓ |
| DFD Application | 6/17 (35.3%) | 17/17 (100%) | 11 |
| DFD Infrastructure | 10/10 (100%) | 10/10 (100%) | 0 ✓ |
| DFD Presentation | 0/5 (0%) | 5/5 (100%) | 5 |
| Shared Services | 0/4 (0%) | 4/4 (100%) | 4 |
| I18N Services | 0/2 (0%) | 2/2 (100%) | 2 |

## Risk Assessment

### High Risk Services
Services with complex logic or critical functionality:
- `collaboration-session.service.ts` - Real-time collaboration
- `dfd-collaboration.service.ts` - Diagram collaboration
- `server-connection.service.ts` - Connection management
- `import-orchestrator.service.ts` - Complex workflow
- `app-diagram-resync.service.ts` - Conflict resolution
- `app-history.service.ts` - Undo/redo implementation

### Medium Risk Services
Services with moderate complexity:
- Most application layer services
- State management services
- API interaction services

### Low Risk Services
Simple utility services:
- `dialog-direction.service.ts`
- `cell-data-extraction.service.ts`
- `ui-tooltip.service.ts`
- I18N services

## Maintenance Plan

### Ongoing Requirements
1. All new services MUST have tests before merge
2. Test coverage reports run on every PR
3. Minimum 80% line coverage per service
4. Regular test suite execution in CI/CD

### Documentation Updates
- Update this plan as services are completed
- Document new testing patterns discovered
- Maintain mock service documentation
- Keep testing guide current

## References

- [Architecture Guide](../reference/architecture/overview.md)
- [Service Provisioning Standards](../reference/architecture/service-provisioning.md)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Utilities](../../src/testing/README.md)

---

**Last Updated:** 2025-12-12
**Next Review:** After Phase 1 completion
