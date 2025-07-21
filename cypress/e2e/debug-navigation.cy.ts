/// <reference types="cypress" />

/**
 * Debug test to understand the application navigation structure
 */

describe('Debug Navigation', () => {
  it('should explore what is available on the root page', () => {
    // Visit the root page first
    cy.visit('/');
    
    // Take a screenshot to see what's on the page
    cy.screenshot('root-page-initial');
    
    // Check the URL after visiting
    cy.url().then(url => {
      cy.log('Current URL:', url);
    });
    
    // Enable mock data
    cy.window().then(win => {
      win.localStorage.setItem('useMockData', 'true');
    });
    
    // Now try to visit the threat models page
    cy.visit('/tm');
    
    // Take a screenshot to see what's on the page
    cy.screenshot('tm-page-initial');
    
    // Log the page content
    cy.get('body').then($body => {
      cy.log('Page HTML:', $body.html());
    });
    
    // Check what elements are present
    cy.get('h1').then($h1 => {
      if ($h1.length > 0) {
        cy.log('Found h1 elements:', $h1.text());
      }
    });
    
    // Check for any buttons or cards
    cy.get('button').then($buttons => {
      if ($buttons.length > 0) {
        cy.log('Found buttons:', $buttons.length);
      }
    });
    
    cy.get('[class*="card"]').then($cards => {
      if ($cards.length > 0) {
        cy.log('Found card-like elements:', $cards.length);
      }
    });
    
    // Check if this redirects somewhere
    cy.url().should('include', '/tm');
    
    // Wait to see if anything loads
    cy.wait(2000);
    cy.screenshot('tm-page-after-wait');
  });
});