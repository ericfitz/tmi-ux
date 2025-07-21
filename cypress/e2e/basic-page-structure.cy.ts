/// <reference types="cypress" />

/**
 * Very basic test to understand what's happening with page loading
 */

describe('Basic Page Structure Test', () => {
  it('should examine the basic structure of the threat models page', () => {
    // Visit the threat models page directly
    cy.visit('/tm', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('useMockData', 'true');
      }
    });
    
    // Wait for page to load
    cy.wait(5000);
    
    // Take a screenshot first
    cy.screenshot('basic-page-structure');
    
    // Check if any content exists at all
    cy.get('body').then($body => {
      const bodyText = $body.text().trim();
      const bodyHtml = $body.html();
      
      cy.log(`Body text length: ${bodyText.length}`);
      cy.log(`Body HTML length: ${bodyHtml.length}`);
      
      if (bodyText.length === 0) {
        cy.log('ERROR: Page has no text content');
      } else {
        cy.log(`First 100 chars of body text: ${bodyText.substring(0, 100)}`);
      }
      
      // Check for Angular elements
      const angularElements = $body.find('[ng-version], app-root, router-outlet');
      cy.log(`Found ${angularElements.length} Angular elements`);
      
      // Check for any error messages
      const possibleErrors = $body.find('*').filter((i, el) => {
        const text = el.textContent?.toLowerCase() || '';
        return text.includes('error') || text.includes('fail') || text.includes('not found');
      });
      cy.log(`Found ${possibleErrors.length} elements with error text`);
      
      // Check URL
      cy.url().then(url => {
        cy.log(`Current URL: ${url}`);
      });
      
      // Check if we're being redirected
      cy.location('pathname').should('include', '/tm');
      
      // Try to find any headings or important elements
      const headings = $body.find('h1, h2, h3, h4, h5, h6');
      cy.log(`Found ${headings.length} heading elements`);
      
      const buttons = $body.find('button');
      cy.log(`Found ${buttons.length} button elements`);
      
      const cards = $body.find('[class*="card"], .mat-card');
      cy.log(`Found ${cards.length} card-like elements`);
      
      // Log the title
      cy.title().then(title => {
        cy.log(`Page title: ${title}`);
      });
    });
  });

  it('should check console for errors', () => {
    let consoleErrors: string[] = [];
    
    cy.window().then((win) => {
      // Capture console errors
      cy.stub(win.console, 'error').callsFake((...args) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        consoleErrors.push(message);
        cy.log('CONSOLE ERROR: ' + message);
      });
    });
    
    cy.visit('/tm', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('useMockData', 'true');
      }
    });
    
    cy.wait(5000);
    
    cy.then(() => {
      cy.log(`Captured ${consoleErrors.length} console errors`);
      if (consoleErrors.length > 0) {
        consoleErrors.forEach(error => cy.log(`ERROR: ${error}`));
      }
    });
    
    cy.screenshot('console-error-check');
  });
});