// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Import the mount command from cypress/angular
import { mount } from 'cypress/angular';

// Add the mount command
Cypress.Commands.add('mount', mount);

/**
 * Custom command to add a node to the graph
 */
Cypress.Commands.add('addNodeToGraph', (nodeType: string, position: { x: number; y: number }) => {
  cy.get('.graph-container').trigger('mousedown', position.x, position.y).trigger('mouseup');

  cy.get('.node-type-selector').contains(nodeType).click();
});

/**
 * Custom command to connect two nodes with an edge
 */
Cypress.Commands.add('connectNodes', (sourceId: string, targetId: string) => {
  cy.get(`[data-id="${sourceId}"]`).find('.port-out').first().trigger('mousedown');
  cy.get(`[data-id="${targetId}"]`).find('.port-in').first().trigger('mouseup');
});

/**
 * Custom command to select a node in the graph
 */
Cypress.Commands.add('selectNode', (nodeId: string) => {
  cy.get(`[data-id="${nodeId}"]`).click();
});

/**
 * Custom command to login with a specific role
 */
Cypress.Commands.add('login', (email: string, role: 'owner' | 'writer' | 'reader' = 'owner') => {
  // This is a placeholder implementation
  // In a real implementation, this would interact with the login form
  // or directly call the authentication API
  cy.window().then(win => {
    win.localStorage.setItem('user', JSON.stringify({ email, role, isAuthenticated: true }));
  });

  // Reload to apply the authentication
  cy.reload();
});

export {};
