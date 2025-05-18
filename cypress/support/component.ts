// ***********************************************************
// This file is processed and loaded automatically before your test files.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Import Angular specific commands
import { mount } from 'cypress/angular';

// Add the mount command to the global Cypress namespace
Cypress.Commands.add('mount', mount);

// Alternatively you can use CommonJS syntax:
// require('./commands')
