# Integration Testing Approach for DFD Services

## Overview

This document describes the integration testing approach implemented for the DFD (Data Flow Diagram) services to eliminate mock logic duplication and improve test reliability.

## Problem Statement

During the refactoring of port management functionality from the monolithic `x6-graph.adapter.ts` into dedicated services (`PortStateManagerService` and `X6PortManager`), we encountered a testing architecture issue:

- Tests used mocked versions of the port management services
- Mocks were just empty functions that didn't perform actual port visibility updates
- Test assertions expected real port visibility changes to occur
- This created a need to duplicate the same logic in mocks that they were supposed to replace

## Solution: Integration Testing

Instead of maintaining complex mocks that duplicate business logic, we adopted an **integration testing approach** for services that have interdependent behavior.

### Key Principles

1. **Use Real Service Instances**: Replace mocks with actual service instances for business logic services
2. **Mock Cross-Cutting Concerns**: Keep `LoggerService` mocked since it's a cross-cutting concern
3. **Test Real Integration**: Verify actual service integration and behavior
4. **Eliminate Logic Duplication**: No need to replicate service logic in mocks

### Implementation Example

#### Before (Problematic Mock Approach)

```typescript
// Mock interfaces that would need to duplicate real logic
interface MockPortStateManagerService {
  updateNodePortVisibility: ReturnType<typeof vi.fn>;
  showAllPorts: ReturnType<typeof vi.fn>;
  // ... more methods that would need real implementations
}

// Empty mocks that don't perform actual work
mockPortStateManager = {
  updateNodePortVisibility: vi.fn(), // Empty - no port visibility changes
  showAllPorts: vi.fn(), // Empty - no port visibility changes
  // ...
};
```

#### After (Integration Testing Approach)

```typescript
// Only mock cross-cutting concerns
interface MockLoggerService {
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

// Create real service instances with proper dependencies
const queryService = new EdgeQueryService(mockLogger);
const portStateManager = new PortStateManagerService(queryService, mockLogger);
const portManager = new X6PortManager(mockLogger);
const service = new EdgeService(mockLogger, portStateManager, portManager);
```

### Service Dependency Chain

```
EdgeService
├── PortStateManagerService (REAL)
│   ├── EdgeQueryService (REAL)
│   └── LoggerService (MOCK)
├── X6PortManager (REAL)
│   └── LoggerService (MOCK)
└── LoggerService (MOCK)
```

### Benefits

✅ **No Logic Duplication**: Eliminates need to replicate port management logic in mocks  
✅ **Real Behavior Testing**: Tests actual integration between services  
✅ **Maintenance Reduction**: No need to sync mocks with service changes  
✅ **Refactoring Safety**: Tests remain valid when internal implementation changes  
✅ **Better Coverage**: Tests verify actual service interactions

### When to Use Integration Testing

Use this approach when:

- Services have complex interdependent behavior
- Mocking would require duplicating significant business logic
- You need to verify actual integration between services
- The services are part of the same bounded context

### When to Use Unit Testing with Mocks

Continue using mocks when:

- Testing isolated units of functionality
- Dependencies are simple or cross-cutting concerns (like logging)
- You want to test error conditions that are hard to reproduce with real services
- Performance is a concern for test execution speed

## Implementation Results

The integration testing approach was successfully implemented for `EdgeService` tests:

- **15 tests passing** with real port management behavior
- **No mock logic duplication** required
- **Actual port visibility updates** verified in tests
- **Improved test reliability** and maintainability

## Future Considerations

- Apply similar approach to other service test files when mock logic duplication becomes an issue
- Consider hybrid approaches where some dependencies are real and others are mocked based on testing needs
- Document service dependency chains to help determine optimal testing strategies
