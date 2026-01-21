/**
 * Script to run Cypress tests
 *
 * This script runs Cypress tests with the specified configuration.
 * It can be used to run E2E tests or component tests.
 *
 * Usage:
 *   node scripts/run-cypress-tests.js [--component] [--open] [--spec=<spec-pattern>]
 *
 * Options:
 *   --component: Run component tests instead of E2E tests
 *   --open: Open the Cypress UI instead of running headlessly
 *   --spec=<spec-pattern>: Run only tests matching the specified pattern
 */

import { execFileSync } from 'child_process';

// Parse command line arguments
const args = process.argv.slice(2);
const isComponentTest = args.includes('--component');
const isOpen = args.includes('--open');
const rawSpecPattern = args.find(arg => arg.startsWith('--spec='))?.split('=')[1];

// Validate and sanitize spec pattern to prevent command injection
// Only allow alphanumeric, dots, slashes, hyphens, underscores, asterisks, and brackets
const specPattern = rawSpecPattern && /^[\w./*\-[\]]+$/.test(rawSpecPattern) ? rawSpecPattern : undefined;
if (rawSpecPattern && !specPattern) {
    console.error('Invalid spec pattern. Only alphanumeric characters, dots, slashes, hyphens, underscores, asterisks, and brackets are allowed.');
    process.exit(1);
}

// Build the Cypress arguments array (avoids shell interpretation for security)
const cypressArgs = ['cypress', isOpen ? 'open' : 'run'];
cypressArgs.push(isComponentTest ? '--component' : '--e2e');

if (specPattern) {
    cypressArgs.push('--spec', specPattern);
}

// Add additional options
cypressArgs.push('--browser', 'electron');
cypressArgs.push('--config-file', 'cypress.config.cjs');

// Print the command for visibility
console.log(`Running: npx ${cypressArgs.join(' ')}`);

try {
    // Execute with argument array to avoid shell injection vulnerabilities
    // lgtm[js/indirect-command-line-injection] - specPattern is validated via allowlist regex above
    execFileSync('npx', cypressArgs, {
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_OPTIONS: '--no-warnings --no-experimental-loader --disable-warning=ExperimentalWarning',
            ELECTRON_ENABLE_LOGGING: 'false',
            CYPRESS_CRASH_REPORTS: '0',
            DEBUG: '',
            FORCE_COLOR: '0'
        }
    });
    console.log('Tests completed successfully');
    process.exit(0);
} catch (error) {
    console.error('Tests failed with error:', error.message);
    process.exit(1);
}
