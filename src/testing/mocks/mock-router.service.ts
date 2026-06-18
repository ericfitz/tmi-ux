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
// SEM@e2ca46c9764dd30e66d02e1b3dc7c25f22057c23: build a mock Router with navigation spy methods and a configurable initial URL (pure)
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
// SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: build a typed mock Router exposing spy methods for test assertions (pure)
export function createTypedMockRouter(initialUrl: string = '/current-route'): MockRouter {
  return createMockRouter(initialUrl) as unknown as MockRouter;
}
