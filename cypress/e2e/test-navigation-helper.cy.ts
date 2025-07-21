/// <reference types="cypress" />

import { navigateToDfdDiagram } from '../support/dfd-test-helpers';

/**
 * Simple test to verify the navigation helper works correctly
 */

describe('Test Navigation Helper', () => {
  it('should successfully navigate to DFD diagram using helper function', () => {
    navigateToDfdDiagram();
    
    // Examine what's actually on the page
    cy.get('body').then(($body) => {
      // Log all the main elements we can find
      const appDfd = $body.find('app-dfd');
      const graphElements = $body.find('[class*="graph"], [class*="x6"]');
      const buttons = $body.find('button');
      
      cy.log(`Found app-dfd elements: ${appDfd.length}`);
      cy.log(`Found graph-related elements: ${graphElements.length}`);
      cy.log(`Found buttons: ${buttons.length}`);
      
      if (graphElements.length > 0) {
        graphElements.each((i, el) => {
          cy.log(`Graph element ${i}: ${el.className}`);
        });
      }
    });
    
    // Check for common graph container elements
    cy.get('body').then(($body) => {
      const possibleContainers = [
        '.x6-graph-scroller',
        '.x6-graph',
        '.graph-container',
        '#graphContainer',
        '[id*="graph"]',
        '[class*="graph"]'
      ];
      
      possibleContainers.forEach(selector => {
        const found = $body.find(selector);
        if (found.length > 0) {
          cy.log(`Found potential graph container: ${selector} (${found.length} elements)`);
        }
      });
    });
    
    cy.log('Navigation helper test completed - page examination done');
  });
});