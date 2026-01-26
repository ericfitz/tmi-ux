# Unit Test Implementation Plan - Executive Summary

> **MIGRATED**: This document has been migrated to the wiki. See the [Testing](https://github.com/ericfitz/tmi/wiki/Testing#tmi-ux-testing-utilities) page for current information.
>
> **Migration Date:** 2026-01-25
> **Note:** The original plan (dated 2025-12-12) has been largely executed. Coverage improved from 42.9% to 91.7%. See wiki for current status.

**Date:** 2025-12-12
**Status:** Largely Complete (see wiki for current status)
**Estimated Duration:** 4 weeks

## Overview

This document summarizes the comprehensive plan to achieve 100% unit test coverage for all services in the TMI-UX project.

## Current State

| Metric | Value |
|--------|-------|
| Total Services | 70 |
| Services with Tests | 30 (42.9%) |
| **Services Needing Tests** | **40 (57.1%)** |

### Coverage by Module

```
✓ Auth Services:            100% (3/3)   - COMPLETE
✓ TM Validation:            100% (1/1)   - COMPLETE
✓ DFD Infrastructure:       100% (10/10) - COMPLETE
  Core Services:            44.4% (8/18)  - 10 services needed
  TM Services:              20.0% (2/10)  - 8 services needed
  DFD Application:          35.3% (6/17)  - 11 services needed
  DFD Presentation:         0%    (0/5)   - 5 services needed
  Shared Services:          0%    (0/4)   - 4 services needed
  I18N Services:            0%    (0/2)   - 2 services needed
```

## 40 Services Requiring Tests

### Priority 1: Core Services (10)
Critical application-wide services:
1. `addon.service.ts` - Addon management
2. `administrator.service.ts` - Admin operations
3. `collaboration-session.service.ts` - Session lifecycle ⚠️ HIGH COMPLEXITY
4. `dfd-collaboration.service.ts` - DFD collaboration ⚠️ HIGH COMPLEXITY
5. `dialog-direction.service.ts` - RTL/LTR direction
6. `operator.service.ts` - Operator info
7. `quota.service.ts` - Quota management
8. `server-connection.service.ts` - Connection monitoring ⚠️ HIGH COMPLEXITY
9. `theme.service.ts` - Theme switching
10. `webhook.service.ts` - Webhook operations

### Priority 2: Threat Model Services (8)
Import, authorization, and reporting:
11. `threat-model-authorization.service.ts` - Permission checks
12. `threat-model-report.service.ts` - Report generation
13. `id-translation.service.ts` - ID mapping (import)
14. `import-orchestrator.service.ts` - Import workflow ⚠️ HIGH COMPLEXITY
15. `readonly-field-filter.service.ts` - Field filtering (import)
16. `reference-rewriter.service.ts` - Reference updates (import)
17. `authorization-prepare.service.ts` - Auth data prep (providers)
18. `provider-adapter.service.ts` - Provider abstraction (providers)

### Priority 3: DFD Application Services (11)
Core DFD diagram services:
19. `app-diagram.service.ts` - Diagram CRUD ⚠️ HIGH COMPLEXITY
20. `app-diagram-loading.service.ts` - Diagram loading
21. `app-diagram-operation-broadcaster.service.ts` - Operation broadcast
22. `app-diagram-resync.service.ts` - Resynchronization ⚠️ HIGH COMPLEXITY
23. `app-event-handlers.service.ts` - Event handling
24. `app-export.service.ts` - Export (PNG/SVG/PDF)
25. `app-history.service.ts` - Undo/redo ⚠️ HIGH COMPLEXITY
26. `app-operation-rejection-handler.service.ts` - Rejection handling
27. `app-operation-state-manager.service.ts` - Operation state
28. `app-state.service.ts` - State management
29. `app-svg-optimization.service.ts` - SVG optimization

### Priority 4: DFD Presentation Services (5)
UI-layer services:
30. `ui-presenter-coordinator.service.ts` - Presenter orchestration
31. `ui-presenter-cursor.service.ts` - Cursor tracking
32. `ui-presenter-cursor-display.service.ts` - Cursor rendering
33. `ui-presenter-selection.service.ts` - Selection management
34. `ui-tooltip.service.ts` - Tooltip display

### Priority 5: Shared Services (4)
Reusable utilities:
35. `cell-data-extraction.service.ts` - X6 cell data extraction
36. `form-validation.service.ts` - Custom validators
37. `framework.service.ts` - Framework CRUD
38. `notification.service.ts` - Notification display

### Priority 6: I18N Services (2)
Internationalization:
39. `language.service.ts` - Language switching
40. `transloco-loader.service.ts` - Translation loading

## Implementation Phases

### Phase 1: Foundation (Week 1) - 10 services
**Focus:** Core Services + establish patterns
- Complete all Priority 1 core services
- Document testing patterns
- Create additional mock helpers as needed

**Deliverable:** 10 services tested (56% total coverage)

### Phase 2: Feature Services (Week 2) - 12 services
**Focus:** Threat Model + Shared Services
- Complete all Priority 2 TM services (8)
- Complete all Priority 5 shared services (4)

**Deliverable:** 22 services tested (73% total coverage)

### Phase 3: DFD Services (Week 3) - 16 services
**Focus:** DFD Application + Presentation
- Complete all Priority 3 DFD application services (11)
- Complete all Priority 4 DFD presentation services (5)

**Deliverable:** 38 services tested (97% total coverage)

### Phase 4: Finalization (Week 4) - 2 services
**Focus:** I18N + review
- Complete Priority 6 I18N services (2)
- Review all tests for consistency
- Generate final coverage report
- Update documentation

**Deliverable:** 40 services tested (100% coverage achieved) ✓

## Testing Standards

### Framework
- **Vitest** (NOT Jasmine or Jest)
- **Async Patterns:** Promises with `async/await` or `.toPromise()` (NO `done()` callbacks)
- **Mocks:** Typed mocks from `src/testing/mocks`

### Required Coverage Per Service
Each service test must include:
1. ✓ Service initialization
2. ✓ All public methods (success + error paths)
3. ✓ Observable state changes
4. ✓ Error handling
5. ✓ Edge cases (null, undefined, empty)

### Example Test Structure
```typescript
// This project uses vitest for all unit tests, with native vitest syntax
import '@angular/compiler';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';

describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: MockDependency;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDependency = createTypedMock();
    service = new ServiceName(mockDependency as unknown as Dependency);
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('publicMethod()', () => {
    it('should handle success case', async () => {
      mockDependency.method.mockReturnValue(of(mockData));

      const result = await service.publicMethod().toPromise();

      expect(result).toEqual(mockData);
      expect(mockDependency.method).toHaveBeenCalled();
    });

    it('should handle error case', async () => {
      const error = new Error('Test error');
      mockDependency.method.mockReturnValue(throwError(() => error));

      try {
        await service.publicMethod().toPromise();
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBe(error);
      }
    });
  });
});
```

## Risk Mitigation

### High-Complexity Services (6)
These services require extra attention:
- `collaboration-session.service.ts` - Real-time state
- `dfd-collaboration.service.ts` - WebSocket events
- `server-connection.service.ts` - Connection lifecycle
- `import-orchestrator.service.ts` - Multi-step workflow
- `app-diagram-resync.service.ts` - Conflict resolution
- `app-history.service.ts` - Undo/redo stack

**Mitigation:**
- Schedule in Phase 1 to establish patterns early
- Allocate extra time for test development
- Consider integration tests for complex workflows

## Success Criteria

### Quantitative
- [ ] 100% of services have unit tests (70/70)
- [ ] Minimum 80% line coverage per service
- [ ] All tests pass in CI/CD pipeline
- [ ] Zero test failures or skipped tests

### Qualitative
- [ ] Consistent testing patterns across all services
- [ ] Clear test descriptions and structure
- [ ] Maintainable and readable test code
- [ ] Comprehensive error case coverage
- [ ] Documentation updated

## Next Steps

1. **Review Plan:** Stakeholder review and approval
2. **Begin Phase 1:** Start with `dialog-direction.service.ts` (simplest)
3. **Establish Patterns:** Document patterns from first few services
4. **Execute Plan:** Follow 4-phase implementation schedule
5. **Track Progress:** Update plan after each service completion
6. **Final Review:** Conduct coverage analysis and documentation update

## Resources

- **Detailed Plan:** [UNIT_TEST_IMPLEMENTATION_PLAN.md](./UNIT_TEST_IMPLEMENTATION_PLAN.md)
- **Architecture:** [Architecture Guide](../reference/architecture/overview.md)
- **Existing Tests:** See `src/app/core/services/*.spec.ts` for examples
- **Mocks:** `src/testing/mocks/` for reusable test utilities
- **Vitest Docs:** https://vitest.dev/

## Questions or Concerns?

Before implementation, consider:
- Is the 4-week timeline realistic?
- Are there any services that should be prioritized differently?
- Do we have all necessary mock utilities?
- Should we implement tests incrementally (PR per service) or in batches?

---

**Last Updated:** 2025-12-12
**Plan Author:** Claude Code
**Next Review:** After Phase 1 completion (Week 1)
