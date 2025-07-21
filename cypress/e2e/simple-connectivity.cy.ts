/// <reference types="cypress" />

/**
 * Simple connectivity test to verify the app is loading
 */

describe('Simple Connectivity Test', () => {
  it('should be able to visit the application', () => {
    cy.visit('/');
    
    // Just check that we can load something
    cy.get('body').should('exist');
    
    // Wait for potential Angular loading
    cy.wait(2000);
    
    // Take a screenshot to see what we got
    cy.screenshot('simple-connectivity-test');
  });

  it('should check if threat models page loads', () => {
    // Visit the threat models page with mock data enabled
    cy.visit('/tm', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('useMockData', 'true');
      }
    });
    
    // Just check that the page loads
    cy.get('body').should('exist');
    
    // Wait for potential loading
    cy.wait(5000);
    
    // Take a screenshot
    cy.screenshot('tm-page-test');
    
    // Try to find threat model cards
    cy.get('body').then($body => {
      const cards = $body.find('.threat-model-card');
      cy.log(`Found ${cards.length} threat model cards`);
      
      if (cards.length > 0) {
        cy.get('.threat-model-card').should('exist');
        cy.log('SUCCESS: Found threat model cards!');
      } else {
        cy.log('No threat model cards found');
        // Check for the no threat models message
        cy.get('.no-threat-models').then($noModels => {
          if ($noModels.length > 0) {
            cy.log('Found no-threat-models message');
          }
        });
      }
    });
  });
});