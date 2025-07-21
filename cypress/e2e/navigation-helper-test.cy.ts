/// <reference types="cypress" />

import { navigateToThreatModels, navigateToDfdDiagram } from '../support/dfd-test-helpers';

/**
 * Test to verify the navigation helper functions work correctly
 */

describe('Navigation Helper Test', () => {
  it('should successfully navigate to threat models page with proper authentication and mock data', () => {
    navigateToThreatModels();
    
    // Verify we're on the correct page
    cy.url().should('include', '/tm');
    cy.url().should('not.include', '/login');
    
    // Check that we have threat model cards
    cy.get('body').then($body => {
      const threatModelCards = $body.find('.threat-model-card');
      const noModelsMessage = $body.find('.no-threat-models');
      
      cy.log(`Found ${threatModelCards.length} threat model cards`);
      cy.log(`Found ${noModelsMessage.length} no-models messages`);
      
      // We should have either threat model cards OR a no-models message
      expect(threatModelCards.length > 0 || noModelsMessage.length > 0).to.be.true;
      
      if (threatModelCards.length > 0) {
        // Look specifically for "System Authentication" card
        const systemAuthCards = $body.find('*').filter((i, el) => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('system') && text.includes('auth');
        });
        cy.log(`Found ${systemAuthCards.length} "System Authentication" cards`);
      }
    });
    
    // Verify mock data is working by checking localStorage
    cy.window().then((win) => {
      const mockDataValue = win.localStorage.getItem('useMockData');
      cy.log(`Mock data localStorage value: ${mockDataValue}`);
      expect(mockDataValue).to.equal('true');
    });
    
    cy.screenshot('threat-models-page-success');
  });

  it('should successfully navigate to DFD diagram with full flow', () => {
    navigateToDfdDiagram();
    
    // Verify we're on the DFD page
    cy.url().should('include', '/dfd/');
    cy.url().should('not.include', '/login');
    cy.url().should('not.include', '/tm');
    
    // Verify DFD component loaded
    cy.get('app-dfd', { timeout: 15000 }).should('be.visible');
    
    cy.screenshot('dfd-page-success');
  });
});