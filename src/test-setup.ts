// This file is required by vitest.config.ts and will be used for test setup

// CRITICAL: Import compiler setup FIRST to register compiler facade
import './testing/compiler-setup';

// Import our zone setup to ensure proper Zone.js initialization
import './testing/zone-setup';

// Polyfill Web Crypto API for JSDOM environment
// JSDOM does not provide crypto.getRandomValues or crypto.subtle,
// which are required by PKCE authentication utilities
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
  });
}

// Global cleanup to prevent test pollution
import { afterEach, vi } from 'vitest';

afterEach(() => {
  // Restore all mocks/spies after each test to prevent cross-test contamination
  // This is critical for tests that spy on global objects like crypto, window, etc.
  vi.restoreAllMocks();
});
