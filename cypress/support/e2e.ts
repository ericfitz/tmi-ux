// ***********************************************************
// This file is processed and loaded automatically before your test files.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Import the image snapshot commands
import { addMatchImageSnapshotCommand } from 'cypress-image-snapshot/command';

// Add the image snapshot command
addMatchImageSnapshotCommand();

// Alternatively you can use CommonJS syntax:
// require('./commands')
