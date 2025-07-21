/// <reference types="cypress" />

/**
 * Explore the threat models page to understand what elements are available
 */

describe('Threat Models Page Exploration', () => {
  it('should explore what is available on the threat models page', () => {
    // Enable mock data
    cy.window().then(win => {
      win.localStorage.setItem('useMockData', 'true');
    });
    
    cy.visit('/tm');
    
    // Wait for the page to load
    cy.wait(3000);
    
    // Take a screenshot
    cy.screenshot('tm-page-exploration');
    
    // Log all the elements we can find
    cy.get('body').then($body => {
      const bodyHtml = $body.html();
      cy.log('Full page HTML length:', bodyHtml.length);
    });
    
    // Check for various possible card-like elements
    const possibleSelectors = [
      '.threat-model-card',
      '.card',
      '[class*="card"]',
      '[class*="threat"]',
      '[class*="model"]',
      'mat-card',
      '.mat-card',
      'button',
      'a',
      'h1',
      'h2',
      'h3',
      '.title',
      '[data-cy]',
      '[data-testid]'
    ];
    
    possibleSelectors.forEach(selector => {
      cy.get('body').then($body => {
        const elements = $body.find(selector);
        if (elements.length > 0) {
          cy.log(`Found ${elements.length} elements for selector: ${selector}`);
          cy.get(selector).then($els => {
            if ($els.length > 0) {
              const firstElement = $els.first();
              const text = firstElement.text().trim();
              const classes = firstElement.attr('class') || '';
              cy.log(`First ${selector} element - text: "${text.substring(0, 50)}", classes: "${classes}"`);
            }
          });
        }
      });
    });
    
    // Look for any navigation elements
    cy.get('body').then($body => {
      const navElements = $body.find('nav, .nav, [role="navigation"], router-outlet');
      cy.log(`Found ${navElements.length} navigation-related elements`);
    });
    
    // Check if Angular has loaded
    cy.window().then(win => {
      const hasAngular = !!(win as any).ng;
      cy.log('Angular loaded:', hasAngular);
    });
  });
  
  it('should try to navigate step by step', () => {
    // Start from root
    cy.visit('/');
    cy.wait(1000);
    cy.screenshot('step1-root');
    
    // Try to find any navigation or link to threat models
    cy.get('body').then($body => {
      const links = $body.find('a, button').filter(':contains("Threat"), :contains("Model"), :contains("TM")');
      cy.log(`Found ${links.length} potential threat model links`);
      
      if (links.length > 0) {
        // Click the first one
        cy.get('a, button').filter(':contains("Threat"), :contains("Model"), :contains("TM")').first().click();
        cy.wait(2000);
        cy.screenshot('step2-after-click');
      }
    });
    
    // Enable mock data and try direct navigation again
    cy.window().then(win => {
      win.localStorage.setItem('useMockData', 'true');
    });
    
    cy.visit('/tm');
    cy.wait(3000);
    cy.screenshot('step3-tm-with-mock');
    
    // Look for any clickable elements that might lead to DFD
    cy.get('body').then($body => {
      const clickableElements = $body.find('a, button, [click], [routerLink]');
      cy.log(`Found ${clickableElements.length} clickable elements on TM page`);
      
      clickableElements.each((index, element) => {
        const $el = Cypress.$(element);
        const text = $el.text().trim();
        const href = $el.attr('href') || '';
        const routerLink = $el.attr('routerLink') || '';
        if (text || href || routerLink) {
          cy.log(`Clickable ${index}: text="${text.substring(0, 30)}", href="${href}", routerLink="${routerLink}"`);
        }
      });
    });
  });
});