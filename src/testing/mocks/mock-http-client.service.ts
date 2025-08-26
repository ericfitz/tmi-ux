/**
 * Mock HttpClient service for testing
 *
 * This provides a standardized mock of Angular's HttpClient that can be reused
 * across all test files, eliminating duplication and ensuring consistency.
 */

import { vi } from 'vitest';
import { of } from 'rxjs';
import type { HttpClient } from '@angular/common/http';

/**
 * Default responses for mock HTTP methods
 */
const DEFAULT_SUCCESS_RESPONSE = { id: 1, name: 'Test Data' };

/**
 * Creates a mock HttpClient with commonly used methods
 *
 * @param defaultResponse - The default response for successful requests
 * @returns A mock HttpClient with vitest mock functions
 */
export function createMockHttpClient(defaultResponse: any = DEFAULT_SUCCESS_RESPONSE): HttpClient {
  return {
    get: vi.fn().mockReturnValue(of(defaultResponse)),
    post: vi.fn().mockReturnValue(of(defaultResponse)),
    put: vi.fn().mockReturnValue(of(defaultResponse)),
    patch: vi.fn().mockReturnValue(of(defaultResponse)),
    delete: vi.fn().mockReturnValue(of(undefined)), // DELETE returns 204 No Content with no body
    head: vi.fn().mockReturnValue(of({})),
    options: vi.fn().mockReturnValue(of({})),
    request: vi.fn().mockReturnValue(of(defaultResponse)),
  } as unknown as HttpClient;
}

/**
 * Type-safe interface for the mock HttpClient
 * Use this type when you need to access the mock functions directly
 */
export interface MockHttpClient {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  head: ReturnType<typeof vi.fn>;
  options: ReturnType<typeof vi.fn>;
  request: ReturnType<typeof vi.fn>;
}

/**
 * Creates a typed mock HttpClient that allows easy access to mock functions
 *
 * @param defaultResponse - The default response for successful requests
 * @returns A typed mock HttpClient
 */
export function createTypedMockHttpClient(
  defaultResponse: any = DEFAULT_SUCCESS_RESPONSE,
): MockHttpClient {
  return createMockHttpClient(defaultResponse) as unknown as MockHttpClient;
}
