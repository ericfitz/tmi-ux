// This file is required by vitest.config.ts and will be used for test setup

// CRITICAL: Import compiler setup FIRST to register compiler facade
import './testing/compiler-setup';

// Import our zone setup to ensure proper Zone.js initialization
import './testing/zone-setup';

// Additional global test setup can go here

// Global cleanup to prevent test pollution
import { afterEach, vi } from 'vitest';

afterEach(() => {
  // Restore all mocks/spies after each test to prevent cross-test contamination
  // This is critical for tests that spy on global objects like crypto, window, etc.
  vi.restoreAllMocks();
});
