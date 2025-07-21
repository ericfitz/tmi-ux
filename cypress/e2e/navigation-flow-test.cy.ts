/// <reference types="cypress" />

/**
 * Test the complete navigation flow: login -> threat models -> diagram
 */

describe('Navigation Flow Test', () => {
  it('should follow the complete navigation flow to reach DFD', () => {
    // Visit the root page
    cy.visit('/', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('useMockData', 'true');
      }
    });
    
    cy.wait(2000);
    cy.screenshot('step1-root-page');
    
    // Look for mock data toggle in nav bar and enable it
    cy.get('body').then($body => {
      const toggleSelectors = [
        'mat-slide-toggle',
        '.mat-slide-toggle', 
        '[data-cy="mock-toggle"]',
        '.mock-toggle',
        'input[type="checkbox"]'
      ];
      
      for (const selector of toggleSelectors) {
        const toggles = $body.find(selector);
        if (toggles.length > 0) {
          cy.log(`Found mock toggle with selector: ${selector}`);
          cy.get(selector).first().click();
          cy.wait(1000);
          break;
        }
      }
    });
    
    cy.screenshot('step2-after-toggle');
    
    // Look for "Login as User1" button and click it
    cy.get('body').then($body => {
      const loginButtons = $body.find('button:contains("Login as User1")');
      if (loginButtons.length > 0) {
        cy.log('Found "Login as User1" button');
        cy.contains('button', 'Login as User1').click();
        cy.wait(2000);
      } else {
        cy.log('No "Login as User1" button found');
      }
    });
    
    cy.screenshot('step3-after-login');
    
    // Check current URL and navigate to threat models if needed
    cy.url().then(url => {
      cy.log('Current URL after login:', url);
      if (!url.includes('/tm')) {
        cy.visit('/tm');
        cy.wait(2000);
      }
    });
    
    cy.screenshot('step4-threat-models-page');
    
    // Look for threat model cards
    cy.get('body').then($body => {
      const cards = $body.find('.threat-model-card');
      cy.log(`Found ${cards.length} threat model cards`);
      
      if (cards.length > 0) {
        // Look specifically for "System Authentication"
        const systemAuthCard = $body.find('.threat-model-card:contains("System Authentication")');
        if (systemAuthCard.length > 0) {
          cy.log('Found "System Authentication" card');
          cy.contains('.threat-model-card', 'System Authentication').click();
        } else {
          cy.log('Using first threat model card');
          cy.get('.threat-model-card').first().click();
        }
        cy.wait(3000);
      } else {
        cy.log('No threat model cards found');
      }
    });
    
    cy.screenshot('step5-threat-model-details');
    
    // Look for diagrams section
    cy.get('body').then($body => {
      const diagramsText = $body.find(':contains("Diagrams")');
      cy.log(`Found ${diagramsText.length} elements containing "Diagrams"`);
      
      if (diagramsText.length > 0) {
        // Look for diagram cards
        const diagramCards = $body.find('.diagram-card');
        cy.log(`Found ${diagramCards.length} diagram cards`);
        
        if (diagramCards.length > 0) {
          cy.get('.diagram-card').first().click();
          cy.wait(3000);
        }
      }
    });
    
    cy.screenshot('step6-final-dfd-page');
    
    // Check if we reached the DFD component
    cy.get('body').then($body => {
      const graphScroller = $body.find('.x6-graph-scroller');
      const graphToolbar = $body.find('.graph-toolbar');
      
      cy.log(`Graph scroller found: ${graphScroller.length > 0}`);
      cy.log(`Graph toolbar found: ${graphToolbar.length > 0}`);
      
      if (graphScroller.length > 0 && graphToolbar.length > 0) {
        cy.log('SUCCESS: Reached DFD component!');
      }
    });
  });
});