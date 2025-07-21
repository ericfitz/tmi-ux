// ***********************************************************
// This file is processed and loaded automatically before your test files.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import Angular JIT compiler to fix compilation issues
import '@angular/compiler';

// Import commands.js using ES2015 syntax:
import './commands';

// Note: Image snapshot plugin removed to avoid dependency issues

// Suppress console warnings and errors that are not test-related
Cypress.on('window:before:load', (win) => {
  // Suppress specific Node.js and Electron warnings
  const originalConsoleError = win.console.error;
  const originalConsoleWarn = win.console.warn;
  
  win.console.error = (...args) => {
    const message = args.join(' ');
    // Filter out known non-critical errors
    if (
      message.includes('NODE_OPTIONs are not supported in packaged apps') ||
      message.includes('ExperimentalWarning') ||
      message.includes('DevTools listening') ||
      message.includes('/dev/tty') ||
      message.includes('Opening `/dev/tty` failed')
    ) {
      return; // Suppress these specific errors
    }
    originalConsoleError.apply(win.console, args);
  };
  
  win.console.warn = (...args) => {
    const message = args.join(' ');
    // Filter out known non-critical warnings
    if (
      message.includes('ExperimentalWarning') ||
      message.includes('experimental-loader') ||
      message.includes('DevTools')
    ) {
      return; // Suppress these specific warnings
    }
    originalConsoleWarn.apply(win.console, args);
  };
});

// Configure Cypress to ignore uncaught exceptions that are not test-related
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent Cypress from failing the test for these specific errors
  if (err.message.includes('NODE_OPTIONs are not supported') ||
      err.message.includes('DevTools listening') ||
      err.message.includes('/dev/tty') ||
      err.message.includes('ExperimentalWarning')) {
    return false;
  }
  // Let other exceptions fail the test
  return true;
});

// Alternatively you can use CommonJS syntax:
// require('./commands')
