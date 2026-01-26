# Unit Test Implementation Checklist

**Quick Reference for Implementing Service Tests**

Use this checklist when implementing tests for each service.

## Pre-Implementation

- [ ] Read the service source code thoroughly
- [ ] Identify all dependencies
- [ ] Check if mock helpers exist for dependencies
- [ ] Review similar existing tests for patterns
- [ ] Note any complex logic or edge cases

## Test File Setup

```typescript
// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ServiceUnderTest } from './service-under-test.service';
// Import mocks and types...
```

- [ ] Add standard header comments
- [ ] Import vitest functions
- [ ] Import service under test
- [ ] Import dependencies and mocks
- [ ] Import test data types

## Test Structure

### 1. Service Initialization
```typescript
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
});
```

- [ ] Create describe block for service
- [ ] Declare service and mock variables
- [ ] Set up beforeEach with vi.clearAllMocks()
- [ ] Initialize mocks
- [ ] Instantiate service
- [ ] Test service creation

### 2. For Each Public Method

```typescript
describe('methodName()', () => {
  it('should handle success case', async () => {
    // Arrange
    mockDependency.method.mockReturnValue(of(mockData));

    // Act
    const result = await service.methodName().toPromise();

    // Assert
    expect(result).toEqual(mockData);
    expect(mockDependency.method).toHaveBeenCalledWith(expectedParams);
  });

  it('should handle error case', async () => {
    // Arrange
    const error = new Error('Test error');
    mockDependency.method.mockReturnValue(throwError(() => error));

    // Act & Assert
    try {
      await service.methodName().toPromise();
      fail('Should have thrown error');
    } catch (err) {
      expect(err).toBe(error);
      expect(mockLogger.error).toHaveBeenCalled();
    }
  });

  it('should handle edge cases', () => {
    // Test null, undefined, empty values
  });
});
```

- [ ] Create describe block for method
- [ ] Test success path
- [ ] Test error handling
- [ ] Test with null/undefined inputs
- [ ] Test with empty inputs
- [ ] Test boundary conditions
- [ ] Verify dependencies called correctly
- [ ] Verify logger calls (if applicable)

### 3. Observable State Management

```typescript
describe('State Management', () => {
  it('should emit initial state', () => {
    service.state$.subscribe(state => {
      expect(state).toEqual(initialState);
    });
  });

  it('should update state on change', () => {
    const states: State[] = [];
    service.state$.subscribe(state => states.push(state));

    service.updateState(newState);

    expect(states).toHaveLength(2);
    expect(states[1]).toEqual(newState);
  });
});
```

- [ ] Test initial observable values
- [ ] Test observable emissions on changes
- [ ] Test observable completion (if applicable)
- [ ] Test multiple subscribers

### 4. API Interactions (if applicable)

```typescript
describe('API Operations', () => {
  it('should call correct endpoint with params', () => {
    mockApiService.get.mockReturnValue(of(mockResponse));

    service.fetchData(params).subscribe();

    expect(mockApiService.get).toHaveBeenCalledWith(
      'expected/endpoint',
      expectedParams
    );
  });

  it('should transform API response', async () => {
    mockApiService.get.mockReturnValue(of(apiResponse));

    const result = await service.fetchData().toPromise();

    expect(result).toEqual(transformedData);
  });
});
```

- [ ] Verify correct endpoint called
- [ ] Verify correct parameters passed
- [ ] Verify correct HTTP method used
- [ ] Test response transformation
- [ ] Test error responses (401, 403, 404, 500)

### 5. WebSocket Interactions (if applicable)

```typescript
describe('WebSocket Operations', () => {
  it('should send correct message format', () => {
    service.sendOperation(operation);

    expect(mockWebSocket.send).toHaveBeenCalledWith({
      type: 'expectedType',
      payload: expectedPayload,
    });
  });

  it('should handle incoming messages', () => {
    const handler = mockWebSocket.on.mock.calls[0][1];

    handler(incomingMessage);

    expect(service.state$).toEmit(expectedState);
  });
});
```

- [ ] Test message sending
- [ ] Test message format
- [ ] Test message handlers
- [ ] Test connection state changes

## Test Coverage Checklist

### Completeness
- [ ] All public methods tested
- [ ] All observables tested
- [ ] All error paths tested
- [ ] All edge cases tested
- [ ] Dependencies verified

### Quality
- [ ] Clear test descriptions
- [ ] Arrange-Act-Assert pattern used
- [ ] No hardcoded values (use constants)
- [ ] Tests are independent
- [ ] Tests clean up after themselves

### Async Handling
- [ ] Using promises (`.toPromise()`) or subscribe
- [ ] NOT using `done()` callback
- [ ] Proper error handling in async tests
- [ ] Waiting for async operations to complete

### Mocking
- [ ] Using typed mocks from `@testing/mocks`
- [ ] Mocks reset in beforeEach with `vi.clearAllMocks()`
- [ ] Return values configured correctly
- [ ] Spy assertions used appropriately

## Running Tests

```bash
# Run this test only
pnpm test src/app/path/to/service.spec.ts

# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch
```

- [ ] Test file runs successfully
- [ ] All tests pass
- [ ] No console errors or warnings
- [ ] Coverage meets minimum threshold (80%)

## Pre-Commit

- [ ] All tests pass locally
- [ ] Code formatted (`pnpm run format`)
- [ ] Linting passes (`pnpm run lint:all`)
- [ ] No skipped or disabled tests
- [ ] Test file follows naming convention (`*.spec.ts`)
- [ ] Test file co-located with source file

## Documentation

- [ ] Add comments for complex test setup
- [ ] Update this checklist if new patterns emerge
- [ ] Document any new mock helpers created

---

## Common Patterns

### Testing Observables
```typescript
// Pattern 1: Subscribe
it('should emit value', () => {
  service.data$.subscribe(data => {
    expect(data).toEqual(expectedData);
  });
});

// Pattern 2: Promise
it('should emit value', async () => {
  const data = await service.data$.pipe(take(1)).toPromise();
  expect(data).toEqual(expectedData);
});

// Pattern 3: Multiple emissions
it('should emit multiple values', () => {
  const values: Data[] = [];
  service.data$.subscribe(data => values.push(data));

  service.updateData(newData1);
  service.updateData(newData2);

  expect(values).toHaveLength(3); // initial + 2 updates
});
```

### Testing Errors
```typescript
// Observable errors
it('should handle errors', () => {
  mockService.method.mockReturnValue(throwError(() => new Error('Test')));

  service.fetchData().subscribe({
    error: err => {
      expect(err.message).toBe('Test');
      expect(mockLogger.error).toHaveBeenCalled();
    }
  });
});

// Async errors
it('should handle errors', async () => {
  mockService.method.mockReturnValue(throwError(() => new Error('Test')));

  try {
    await service.fetchData().toPromise();
    fail('Should have thrown');
  } catch (err) {
    expect(err.message).toBe('Test');
  }
});
```

### Mocking Return Values
```typescript
// Single value
mockService.method.mockReturnValue(of(mockData));

// Error
mockService.method.mockReturnValue(throwError(() => new Error('Test')));

// Different values per call
mockService.method
  .mockReturnValueOnce(of(data1))
  .mockReturnValueOnce(of(data2));

// Implementation
mockService.method.mockImplementation((param) => {
  return of(/* based on param */);
});
```

---

**Reference:** See existing test files for examples:
- Simple service: `src/app/core/services/logger.service.spec.ts`
- API service: `src/app/core/services/api.service.spec.ts`
- Admin service: `src/app/core/services/user-admin.service.spec.ts`
- Complex service: `src/app/auth/services/auth.service.spec.ts`
