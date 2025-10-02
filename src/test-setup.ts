// This file is required by vitest.config.ts and will be used for test setup

// CRITICAL: Import compiler setup FIRST to register compiler facade
import './testing/compiler-setup';

// Import our zone setup to ensure proper Zone.js initialization
import './testing/zone-setup';

// Additional global test setup can go here
