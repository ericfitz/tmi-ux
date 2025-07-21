/// <reference types="cypress" />

/**
 * Test to debug the proper navigation flow to the threat models page
 */

describe('Navigation Flow Debug', () => {
  let logs: string[] = [];

  beforeEach(() => {
    logs = [];
    
    // Capture console logs
    cy.window().then((win) => {
      cy.stub(win.console, 'log').callsFake((...args) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        logs.push(message);
        
        // Only log CYPRESS-DEBUG messages to keep noise down
        if (message.includes('[CYPRESS-DEBUG]')) {
          cy.log('APP LOG: ' + message);
        }
      });
    });
  });

  it('should follow the correct navigation flow to reach threat models', () => {
    // Step 1: Visit root page
    cy.visit('/');
    cy.url().then(url => {
      cy.log(`Step 1 - Current URL: ${url}`);
    });
    
    // Step 2: Check what page we're on and enable mock data toggle if needed
    cy.get('body').then($body => {
      const bodyText = $body.text();
      cy.log(`Page content includes login: ${bodyText.includes('Login')}`);
      cy.log(`Page content includes toggle: ${bodyText.includes('toggle') || bodyText.includes('switch')}`);
      
      // Look for a toggle or switch in the navbar
      const navbarToggles = $body.find('nav *').filter((i, el) => {
        const text = el.textContent?.toLowerCase() || '';
        const type = el.type?.toLowerCase() || '';
        return text.includes('mock') || text.includes('toggle') || type.includes('checkbox') || type.includes('switch');
      });
      cy.log(`Found ${navbarToggles.length} potential toggles in navbar`);
    });
    
    // Step 3: Try to find and enable the mock data toggle
    cy.get('body').then($body => {
      // Look for toggle elements more broadly
      const possibleToggles = $body.find('input[type="checkbox"], mat-slide-toggle, [role="switch"]');
      cy.log(`Found ${possibleToggles.length} possible toggle elements`);
      
      if (possibleToggles.length > 0) {
        cy.log('Clicking first toggle element');
        cy.wrap(possibleToggles.first()).click({ force: true });
      } else {
        cy.log('No toggle found, setting localStorage manually');
        cy.window().then((win) => {
          win.localStorage.setItem('useMockData', 'true');
        });
      }
    });
    
    cy.wait(1000);
    
    // Step 4: Look for "Login as User1" button and click it
    cy.get('body').then($body => {
      const loginButtons = $body.find('button').filter((i, el) => {
        const text = el.textContent?.toLowerCase() || '';
        return text.includes('login') && text.includes('user1');
      });
      cy.log(`Found ${loginButtons.length} "Login as User1" buttons`);
      
      if (loginButtons.length > 0) {
        cy.log('Clicking "Login as User1" button');
        cy.wrap(loginButtons.first()).click();
      } else {
        cy.log('No "Login as User1" button found, looking for any login button');
        const anyLoginButton = $body.find('button').filter((i, el) => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('login');
        });
        cy.log(`Found ${anyLoginButton.length} login buttons`);
        if (anyLoginButton.length > 0) {
          cy.wrap(anyLoginButton.first()).click();
        }
      }
    });
    
    cy.wait(2000);
    
    // Step 5: Check where we are now
    cy.url().then(url => {
      cy.log(`Step 5 - Current URL after login attempt: ${url}`);
    });
    
    // Step 6: Navigate to /tm if we're not already there
    cy.url().then(url => {
      if (!url.includes('/tm')) {
        cy.log('Not on /tm page, navigating there');
        cy.visit('/tm');
      }
    });
    
    cy.wait(2000);
    
    // Step 7: Check final URL and page content
    cy.url().then(url => {
      cy.log(`Final URL: ${url}`);
    });
    
    cy.get('body').then($body => {
      const threatModelCards = $body.find('.threat-model-card');
      const systemAuthCard = $body.find('*').filter((i, el) => {
        const text = el.textContent?.toLowerCase() || '';
        return text.includes('system') && text.includes('auth');
      });
      
      cy.log(`Found ${threatModelCards.length} threat model cards`);
      cy.log(`Found ${systemAuthCard.length} "System Authentication" elements`);
      
      // Log all debug messages
      const debugLogs = logs.filter(log => log.includes('[CYPRESS-DEBUG]'));
      cy.log(`Captured ${debugLogs.length} debug logs:`);
      debugLogs.forEach(log => cy.log(log));
    });
    
    cy.screenshot('navigation-flow-debug');
  });
});