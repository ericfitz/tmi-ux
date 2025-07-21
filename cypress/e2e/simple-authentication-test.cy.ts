/// <reference types="cypress" />

/**
 * Simple test to understand the authentication flow
 */

describe('Simple Authentication Test', () => {
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
        
        if (message.includes('[CYPRESS-DEBUG]')) {
          cy.log('APP LOG: ' + message);
        }
      });
    });
  });

  it('should handle the complete authentication flow step by step', () => {
    // Step 1: Visit root with clean slate
    cy.visit('/', {
      onBeforeLoad: (win) => {
        win.localStorage.clear();
        win.sessionStorage.clear();
        win.localStorage.setItem('useMockData', 'true');
      }
    });
    
    cy.url().then(url => {
      cy.log(`Step 1 - Root URL: ${url}`);
    });
    
    cy.wait(2000);
    
    // Step 2: Check what's on the page and look for toggle
    cy.get('body').then($body => {
      const bodyText = $body.text();
      cy.log(`Page contains "Login": ${bodyText.includes('Login')}`);
      cy.log(`Page contains "Toggle" or "Switch": ${bodyText.includes('Toggle') || bodyText.includes('Switch') || bodyText.includes('toggle') || bodyText.includes('switch')}`);
      
      // Look for any toggles or switches
      const toggles = $body.find('mat-slide-toggle, input[type="checkbox"], [role="switch"]');
      cy.log(`Found ${toggles.length} potential toggle elements`);
      
      if (toggles.length > 0) {
        cy.log('Clicking toggle to enable mock data');
        cy.wrap(toggles.first()).click({ force: true });
        cy.wait(1000);
      }
    });
    
    // Step 3: Look for "Login as User1" button
    cy.get('body').then($body => {
      const loginButtons = $body.find('button').filter((i, el) => {
        const text = el.textContent?.toLowerCase() || '';
        return text.includes('login') && text.includes('user1');
      });
      
      cy.log(`Found ${loginButtons.length} "Login as User1" buttons`);
      
      if (loginButtons.length > 0) {
        cy.log('Clicking "Login as User1" button');
        cy.wrap(loginButtons.first()).click();
        cy.wait(2000);
      } else {
        cy.log('No "Login as User1" button found');
        
        // Look for any login buttons
        const anyLoginButtons = $body.find('button').filter((i, el) => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('login');
        });
        
        cy.log(`Found ${anyLoginButtons.length} general login buttons`);
        if (anyLoginButtons.length > 0) {
          cy.wrap(anyLoginButtons.first()).click();
          cy.wait(2000);
        }
      }
    });
    
    // Step 4: Check current URL
    cy.url().then(url => {
      cy.log(`Step 4 - URL after login attempt: ${url}`);
    });
    
    // Step 5: Try to visit /tm
    cy.visit('/tm');
    cy.wait(3000);
    
    // Step 6: Check final URL and what's on the page
    cy.url().then(url => {
      cy.log(`Step 6 - Final URL: ${url}`);
      
      if (url.includes('/login')) {
        cy.log('Still on login page - authentication failed');
        
        // Try the login process again on this page
        cy.get('body').then($body => {
          const toggles = $body.find('mat-slide-toggle, input[type="checkbox"], [role="switch"]');
          if (toggles.length > 0 && toggles.first().prop('checked') !== true) {
            cy.log('Toggle found and not checked, clicking it');
            cy.wrap(toggles.first()).click({ force: true });
            cy.wait(1000);
          }
          
          const loginButtons = $body.find('button').filter((i, el) => {
            const text = el.textContent?.toLowerCase() || '';
            return text.includes('login') && text.includes('user1');
          });
          
          if (loginButtons.length > 0) {
            cy.log('Found "Login as User1" button on login page, clicking it');
            cy.wrap(loginButtons.first()).click();
            cy.wait(2000);
            
            // Try visiting /tm again
            cy.visit('/tm');
            cy.wait(3000);
          }
        });
      } else {
        cy.log('Successfully navigated away from login page');
      }
    });
    
    // Step 7: Final check
    cy.url().then(url => {
      cy.log(`Final URL: ${url}`);
    });
    
    cy.get('body').then($body => {
      const threatModelCards = $body.find('.threat-model-card');
      const noModelsMessage = $body.find('.no-threat-models');
      
      cy.log(`Found ${threatModelCards.length} threat model cards`);
      cy.log(`Found ${noModelsMessage.length} no-models messages`);
      
      // Log debug messages
      const debugLogs = logs.filter(log => log.includes('[CYPRESS-DEBUG]'));
      cy.log(`Captured ${debugLogs.length} debug logs`);
      debugLogs.forEach(log => cy.log(log));
    });
    
    cy.screenshot('simple-authentication-test');
  });
});