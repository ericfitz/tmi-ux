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

const { execSync } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const isComponentTest = args.includes('--component');
const isOpen = args.includes('--open');
const specPattern = args.find(arg => arg.startsWith('--spec='))?.split('=')[1];

// Build the Cypress command
let command = 'cypress';
command += isOpen ? ' open' : ' run';
command += isComponentTest ? ' --component' : ' --e2e';

if (specPattern) {
    command += ` --spec "${specPattern}"`;
}

// Add additional options
command += ' --browser chrome';
command += ' --config-file cypress.config.ts';

// Print the command
console.log(`Running: ${command}`);

try {
    // Execute the command
    execSync(command, { stdio: 'inherit' });
    console.log('Tests completed successfully');
    process.exit(0);
} catch (error) {
    console.error('Tests failed with error:', error.message);
    process.exit(1);
}