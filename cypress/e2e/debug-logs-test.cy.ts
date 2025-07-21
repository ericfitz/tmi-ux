/// <reference types="cypress" />

/**
 * Debug test to examine console logs from the application
 */

describe('Debug Logs Test', () => {
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

  it('should examine logs during navigation to threat models page', () => {
    // Set mock data and visit the page
    cy.visit('/tm', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('useMockData', 'true');
      }
    });
    
    // Wait for the application to load
    cy.wait(5000);
    
    // Take a screenshot
    cy.screenshot('debug-logs-tm-page');
    
    // Log what we found on the page
    cy.get('body').then($body => {
      const cards = $body.find('.threat-model-card');
      const noModels = $body.find('.no-threat-models');
      
      cy.log(`Found ${cards.length} threat model cards`);
      cy.log(`Found ${noModels.length} no-threat-models elements`);
      
      // Log all the debug messages we captured
      cy.then(() => {
        const debugLogs = logs.filter(log => log.includes('[CYPRESS-DEBUG]'));
        cy.log(`Captured ${debugLogs.length} debug logs:`);
        debugLogs.forEach(log => cy.log(log));
        
        // Also check localStorage
        cy.window().then((win) => {
          const mockDataValue = win.localStorage.getItem('useMockData');
          cy.log(`localStorage useMockData: ${mockDataValue}`);
        });
      });
    });
    
    // Check what elements are actually on the page
    cy.get('h1, h2, h3').then($headings => {
      const headings = Array.from($headings).map(h => h.textContent?.trim()).filter(Boolean);
      cy.log('Page headings:', headings.join(', '));
    });
    
    // Look for any error messages
    cy.get('body').then($body => {
      const errorElements = $body.find('.error, .warning, [class*="error"], [class*="warning"]');
      if (errorElements.length > 0) {
        cy.log(`Found ${errorElements.length} potential error elements`);
      }
    });
  });

  it('should examine localStorage and URL behavior', () => {
    // First visit root to set localStorage
    cy.visit('/', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('useMockData', 'true');
      }
    });
    
    cy.wait(1000);
    
    // Check localStorage is set
    cy.window().then((win) => {
      const mockDataValue = win.localStorage.getItem('useMockData');
      cy.log(`localStorage useMockData after setting: ${mockDataValue}`);
    });
    
    // Now visit threat models page
    cy.visit('/tm');
    cy.wait(3000);
    
    // Check localStorage is still set
    cy.window().then((win) => {
      const mockDataValue = win.localStorage.getItem('useMockData');
      cy.log(`localStorage useMockData on /tm page: ${mockDataValue}`);
    });
    
    cy.screenshot('debug-localStorage-test');
    
    // Check for threat model cards
    cy.get('body').then($body => {
      const cards = $body.find('.threat-model-card');
      const noModels = $body.find('.no-threat-models');
      
      cy.log(`Found ${cards.length} threat model cards`);
      cy.log(`Found ${noModels.length} no-threat-models elements`);
      
      // List what's actually on the page
      const allElements = $body.find('*').toArray();
      const interestingElements = allElements.filter(el => {
        const text = el.textContent?.toLowerCase() || '';
        const className = el.className?.toLowerCase() || '';
        return text.includes('threat') || text.includes('model') || 
               className.includes('card') || className.includes('threat') ||
               text.includes('system') || text.includes('auth');
      });
      
      cy.log(`Found ${interestingElements.length} elements with threat/model/card content`);
      interestingElements.slice(0, 5).forEach((el, i) => {
        cy.log(`Element ${i}: ${el.tagName} - ${el.textContent?.slice(0, 50)} - ${el.className}`);
      });
    });
  });
});