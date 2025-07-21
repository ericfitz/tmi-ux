/**
 * Clean Cypress test runner that filters out unwanted warnings and errors
 */

import { spawn } from 'child_process';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const isComponentTest = args.includes('--component');
const isOpen = args.includes('--open');
const specPattern = args.find(arg => arg.startsWith('--spec='))?.split('=')[1];

// Build the Cypress command
let command = 'npx';
let cypressArgs = ['cypress'];
cypressArgs.push(isOpen ? 'open' : 'run');
cypressArgs.push(isComponentTest ? '--component' : '--e2e');

if (specPattern) {
    cypressArgs.push('--spec', specPattern);
}

// Add additional options
cypressArgs.push('--browser', 'electron');
cypressArgs.push('--config-file', 'cypress.config.cjs');

// Filter patterns for unwanted output
const filterPatterns = [
    /ERROR:node_bindings\.cc.*NODE_OPTIONs are not supported in packaged apps/,
    /DevTools listening on ws:\/\//,
    /ExperimentalWarning:.*experimental-loader/,
    /Opening `\/dev\/tty` failed \(\d+\): Device not configured/,
    /Use `node --trace-warnings \.\.\.` to show where the warning was created/,
    /npm notice/,
    /New major version of npm available/,
    /Changelog:/,
    /To update run:/,
    /WARNING:viz_main_impl\.cc.*VizNullHypothesis is disabled/,
    /Warning: The following browser launch options were provided but are not supported/,
    /INFO:CONSOLE.*vite.*connecting/,
    /INFO:CONSOLE.*vite.*connected/,
    /INFO:CONSOLE.*Angular is running in development mode/,
    /^\s*-\s*args\s*$/
];

function shouldFilterLine(line) {
    return filterPatterns.some(pattern => pattern.test(line));
}

// Print the command (filtered)
console.log(`Running: cypress ${cypressArgs.join(' ')}`);

// Spawn the process
const child = spawn(command, cypressArgs, {
    env: {
        ...process.env,
        NODE_OPTIONS: '--no-warnings',
        ELECTRON_ENABLE_LOGGING: 'false',
        CYPRESS_CRASH_REPORTS: '0',
        DEBUG: '',
        FORCE_COLOR: '1' // Keep colors for test output
    }
});

// Filter stdout
child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    const filteredLines = lines.filter(line => !shouldFilterLine(line));
    if (filteredLines.length > 0 && filteredLines.join('').trim()) {
        process.stdout.write(filteredLines.join('\n'));
    }
});

// Filter stderr
child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    const filteredLines = lines.filter(line => !shouldFilterLine(line));
    if (filteredLines.length > 0 && filteredLines.join('').trim()) {
        process.stderr.write(filteredLines.join('\n'));
    }
});

child.on('close', (code) => {
    if (code === 0) {
        console.log('Tests completed successfully');
    } else {
        console.error(`Tests failed with exit code ${code}`);
    }
    process.exit(code);
});

child.on('error', (error) => {
    console.error('Failed to start Cypress:', error.message);
    process.exit(1);
});