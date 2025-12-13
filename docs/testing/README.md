# Testing Documentation

This directory contains comprehensive documentation for testing in the TMI-UX project.

## Quick Links

- **[Unit Test Implementation Plan](./UNIT_TEST_IMPLEMENTATION_PLAN.md)** - Detailed plan for all 40 services needing tests
- **[Executive Summary](./UNIT_TEST_PLAN_SUMMARY.md)** - High-level overview and timeline
- **[Implementation Checklist](./UNIT_TEST_CHECKLIST.md)** - Quick reference for implementing tests

## Current Test Coverage

**As of 2025-12-12:**

| Category | Coverage | Status |
|----------|----------|--------|
| **Overall** | 30/70 (42.9%) | 🟨 In Progress |
| Auth Services | 3/3 (100%) | ✅ Complete |
| TM Validation | 1/1 (100%) | ✅ Complete |
| DFD Infrastructure | 10/10 (100%) | ✅ Complete |
| Core Services | 8/18 (44.4%) | 🟨 In Progress |
| TM Services | 2/10 (20%) | 🔴 Needs Work |
| DFD Application | 6/17 (35.3%) | 🟨 In Progress |
| DFD Presentation | 0/5 (0%) | 🔴 Needs Work |
| Shared Services | 0/4 (0%) | 🔴 Needs Work |
| I18N Services | 0/2 (0%) | 🔴 Needs Work |

**Goal:** 70/70 (100%) by end of 4-week implementation plan

## Testing Framework

### Technology
- **Framework:** [Vitest](https://vitest.dev/) (NOT Jasmine or Jest)
- **Environment:** jsdom with Angular compiler
- **Async Pattern:** Promises with `async/await` or `.toPromise()` (NO `done()` callbacks)

### Key Commands

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/app/core/services/api.service.spec.ts

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests for specific component
pnpm test tm
pnpm test dfd
```

## Documentation Overview

### 1. Unit Test Implementation Plan
**File:** [UNIT_TEST_IMPLEMENTATION_PLAN.md](./UNIT_TEST_IMPLEMENTATION_PLAN.md)

Comprehensive plan covering:
- All 40 services requiring tests
- Detailed test focus for each service
- Complexity estimates
- Priority groupings
- Implementation phases
- Testing guidelines and patterns

**Use this when:** Planning work or understanding what needs to be tested

### 2. Executive Summary
**File:** [UNIT_TEST_PLAN_SUMMARY.md](./UNIT_TEST_PLAN_SUMMARY.md)

High-level overview including:
- Current state and gap analysis
- 4-phase implementation timeline
- Success criteria
- Risk mitigation strategies
- Quick reference of all 40 services

**Use this when:** Presenting to stakeholders or getting started

### 3. Implementation Checklist
**File:** [UNIT_TEST_CHECKLIST.md](./UNIT_TEST_CHECKLIST.md)

Practical checklist for each test implementation:
- Pre-implementation steps
- Test file setup template
- Required test sections
- Code patterns and examples
- Quality checks
- Pre-commit validation

**Use this when:** Actually writing tests for a service

## Testing Patterns

### Standard Test File Structure

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
  let mockLogger: MockLoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createTypedMockLoggerService();
    service = new ServiceUnderTest(mockLogger as unknown as LoggerService);
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

### Available Mocks

Located in `src/testing/mocks/`:

- `createTypedMockLoggerService()` - Logger service
- `createTypedMockHttpClient()` - HTTP client
- `createTypedMockRouter()` - Angular router
- `createTypedMockPlatformLocation()` - Platform location
- `MockAuthService` - Authentication service
- `MockGraphService` - X6 graph service
- `MockWebSocketService` - WebSocket service

See [src/testing/mocks/index.ts](../../src/testing/mocks/index.ts) for details.

## Example Tests

Study these existing tests for patterns:

### Simple Service
[logger.service.spec.ts](../../src/app/core/services/logger.service.spec.ts)
- Basic service initialization
- Method testing
- State management

### API Service
[api.service.spec.ts](../../src/app/core/services/api.service.spec.ts)
- HTTP method testing (GET, POST, PUT, DELETE)
- Error handling
- Parameter validation
- URL construction

### Admin Service
[user-admin.service.spec.ts](../../src/app/core/services/user-admin.service.spec.ts)
- List/filter operations
- Delete operations
- Observable state updates
- API integration

### Complex Service
[auth.service.spec.ts](../../src/app/auth/services/auth.service.spec.ts)
- OAuth flow
- Token management
- State management
- Storage mocking
- Crypto mocking

### Infrastructure Service
[infra-edge.service.spec.ts](../../src/app/pages/dfd/infrastructure/services/infra-edge.service.spec.ts)
- X6 graph integration
- Real X6 instances (not mocked)
- Complex object manipulation

## Implementation Phases

### Phase 1: Foundation (Week 1)
**10 services** - Core Services
- Establish testing patterns
- Create additional mocks as needed
- Target: 56% total coverage

### Phase 2: Feature Services (Week 2)
**12 services** - TM Services + Shared Services
- Apply established patterns
- Target: 73% total coverage

### Phase 3: DFD Services (Week 3)
**16 services** - DFD Application + Presentation
- Complex service testing
- Target: 97% total coverage

### Phase 4: Finalization (Week 4)
**2 services** - I18N + Review
- Complete remaining services
- Review and refactor
- Target: 100% coverage ✅

## Best Practices

### DO ✅
- Use Vitest syntax (`vi.fn()`, `expect()`, `describe()`, `it()`)
- Use typed mocks from `@testing/mocks`
- Test both success and error cases
- Test observable emissions
- Use `.toPromise()` or `subscribe()` for async
- Clear mocks in `beforeEach()` with `vi.clearAllMocks()`
- Write clear test descriptions
- Follow Arrange-Act-Assert pattern

### DON'T ❌
- Use Jasmine or Jest syntax
- Use `done()` callbacks for async tests
- Mock everything (some services test real X6 instances)
- Skip or disable tests
- Leave console.log in tests
- Write tests dependent on execution order
- Hardcode magic values (use constants)

## Quality Standards

Each service test must include:

1. ✅ Service initialization test
2. ✅ Tests for all public methods
3. ✅ Success path tests
4. ✅ Error handling tests
5. ✅ Edge case tests (null, undefined, empty)
6. ✅ Observable state change tests
7. ✅ Dependency interaction verification
8. ✅ Minimum 80% line coverage

## Running Tests in CI/CD

Tests run automatically on:
- Every pull request
- Every commit to main branch
- Nightly builds

Coverage reports are generated and must meet thresholds.

## Contributing

When adding new services:

1. Write tests BEFORE or WITH the service implementation
2. Follow the patterns in [UNIT_TEST_CHECKLIST.md](./UNIT_TEST_CHECKLIST.md)
3. Ensure tests pass locally before committing
4. Run `pnpm run format` and `pnpm run lint:all`
5. Verify coverage meets minimum threshold

## Resources

### Internal
- [Architecture Guide](../reference/architecture/overview.md)
- [Service Provisioning Standards](../reference/architecture/service-provisioning.md)
- [Testing Utilities](../../src/testing/README.md)
- [Mock Services](../../src/testing/mocks/)

### External
- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Angular Testing Guide](https://angular.dev/guide/testing)
- [RxJS Testing Guide](https://rxjs.dev/guide/testing)

## Questions?

For questions about testing:
1. Check this documentation first
2. Review similar existing tests
3. Ask in team chat or during stand-up
4. Update this documentation when patterns emerge

---

**Last Updated:** 2025-12-12
**Maintained By:** Development Team
**Next Review:** After Phase 1 completion
