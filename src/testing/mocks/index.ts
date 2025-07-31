/**
 * Centralized exports for all mock services
 * 
 * This index file provides a single entry point for importing mock services,
 * making it easier to use shared mocks across test files.
 */

// Auth service mocks
export { MockAuthService, type User } from './mock-auth.service';

// Graph service mocks  
export { MockGraphService } from './mock-graph.service';

// WebSocket service mocks
export { MockWebSocketService } from './mock-websocket.service';

// Logger service mocks
export { 
  createMockLoggerService, 
  createTypedMockLoggerService, 
  type MockLoggerService 
} from './mock-logger.service';

// Router service mocks
export {
  createMockRouter,
  createTypedMockRouter,
  type MockRouter
} from './mock-router.service';

// HttpClient service mocks
export {
  createMockHttpClient,
  createTypedMockHttpClient,
  type MockHttpClient
} from './mock-http-client.service';

/**
 * Factory function to create all commonly used mocks
 * Use this when you need multiple mocks in a single test file
 */
export function createCommonMocks() {
  return {
    logger: createMockLoggerService(),
    router: createMockRouter(),
    httpClient: createMockHttpClient(),
    auth: new MockAuthService(),
    graph: new MockGraphService(),
    websocket: new MockWebSocketService(),
  };
}

/**
 * Factory function to create typed mocks
 * Use this when you need to access mock functions directly for assertions
 */
export function createTypedMocks() {
  return {
    logger: createTypedMockLoggerService(),
    router: createTypedMockRouter(),
    httpClient: createTypedMockHttpClient(),
    auth: new MockAuthService(),
    graph: new MockGraphService(), 
    websocket: new MockWebSocketService(),
  };
}