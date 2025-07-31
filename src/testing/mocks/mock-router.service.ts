/**
 * Mock Router service for testing
 * 
 * This provides a standardized mock of Angular's Router that can be reused
 * across all test files, eliminating duplication and ensuring consistency.
 */

import { vi } from 'vitest';
import type { Router } from '@angular/router';

/**
 * Creates a mock Router with commonly used methods
 * 
 * @param initialUrl - The initial URL for the router (default: '/current-route')
 * @returns A mock Router with vitest mock functions
 */
export function createMockRouter(initialUrl: string = '/current-route'): Router {
  return {
    navigate: vi.fn().mockResolvedValue(true),
    navigateByUrl: vi.fn().mockResolvedValue(true),
    url: initialUrl,
    createUrlTree: vi.fn(),
    serializeUrl: vi.fn(),
    parseUrl: vi.fn(),
    isActive: vi.fn().mockReturnValue(false),
    routerState: {
      root: {},
    } as any,
    events: {
      pipe: vi.fn(),
      subscribe: vi.fn(),
    } as any,
  } as unknown as Router;
}

/**
 * Type-safe interface for the mock Router
 * Use this type when you need to access the mock functions directly
 */
export interface MockRouter {
  navigate: ReturnType<typeof vi.fn>;
  navigateByUrl: ReturnType<typeof vi.fn>;
  url: string;
  createUrlTree: ReturnType<typeof vi.fn>;
  serializeUrl: ReturnType<typeof vi.fn>;
  parseUrl: ReturnType<typeof vi.fn>;
  isActive: ReturnType<typeof vi.fn>;
  routerState: any;
  events: any;
}

/**
 * Creates a typed mock Router that allows easy access to mock functions
 * 
 * @param initialUrl - The initial URL for the router (default: '/current-route')
 * @returns A typed mock Router
 */
export function createTypedMockRouter(initialUrl: string = '/current-route'): MockRouter {
  return createMockRouter(initialUrl) as unknown as MockRouter;
}