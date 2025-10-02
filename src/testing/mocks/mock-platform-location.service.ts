import { vi } from 'vitest';

/**
 * Mock PlatformLocation for testing
 * This mock provides the essential PlatformLocation functionality needed for Angular tests
 */
export interface MockPlatformLocation {
  getBaseHrefFromDOM: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
  onPopState: ReturnType<typeof vi.fn>;
  onHashChange: ReturnType<typeof vi.fn>;
  href: string;
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  replaceState: ReturnType<typeof vi.fn>;
  pushState: ReturnType<typeof vi.fn>;
  forward: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
  historyGo: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock PlatformLocation instance
 */
export function createMockPlatformLocation(): MockPlatformLocation {
  return {
    getBaseHrefFromDOM: vi.fn().mockReturnValue('/'),
    getState: vi.fn().mockReturnValue({}),
    onPopState: vi.fn(),
    onHashChange: vi.fn(),
    href: 'http://localhost:4200',
    protocol: 'http:',
    hostname: 'localhost',
    port: '4200',
    pathname: '/',
    search: '',
    hash: '',
    replaceState: vi.fn(),
    pushState: vi.fn(),
    forward: vi.fn(),
    back: vi.fn(),
    historyGo: vi.fn(),
  };
}

/**
 * Create a typed mock PlatformLocation instance (same as createMockPlatformLocation)
 * Provided for consistency with other mock services
 */
export function createTypedMockPlatformLocation(): MockPlatformLocation {
  return createMockPlatformLocation();
}
