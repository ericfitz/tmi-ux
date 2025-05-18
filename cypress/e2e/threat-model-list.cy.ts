/**
 * E2E tests for the threat model list page
 */

import { ThreatModelListPage } from '../../src/testing/page-objects/threat-model-list.page';

describe('Threat Model List', () => {
  const page = new ThreatModelListPage();

  beforeEach(() => {
    // Visit the threat models page
    page.visit();

    // Ensure mock data is enabled
    cy.window().then(win => {
      win.localStorage.setItem('useMockData', 'true');
    });

    // Reload to apply the mock data setting
    cy.reload();

    // Wait for the page to load
    page.waitForThreatModelCardsToLoad();
  });

  it('should display the list of threat models', () => {
    // Check that the page title is displayed
    page.getPageTitle().should('contain.text', 'Threat Models');

    // Check that the threat model cards are displayed
    page.getThreatModelCards().should('have.length.at.least', 1);
  });

  it('should navigate to threat model details when clicking on a threat model', () => {
    // Click on the first threat model
    page.getThreatModelCards().first().click();

    // Check that we navigated to the threat model details page
    cy.url().should('include', '/tm/');

    // Check that the threat model details are displayed
    cy.contains('Diagrams').should('be.visible');
    cy.contains('Threats').should('be.visible');
  });

  it('should allow creating a new threat model', () => {
    // Click on the create button
    page.clickCreateNewButton();

    // Fill in the form
    cy.get('input[formControlName="name"]').type('Test Threat Model');
    cy.get('textarea[formControlName="description"]').type('This is a test threat model');
    cy.get('mat-select[formControlName="threat_model_framework"]').click();
    cy.get('mat-option').contains('STRIDE').click();

    // Submit the form
    cy.contains('button', 'Create').click();

    // Check that the new threat model is created and we are redirected to it
    cy.url().should('include', '/tm/');
    cy.contains('Test Threat Model').should('be.visible');
  });

  it('should filter threat models by name', () => {
    // Type in the search box
    page.search('System');

    // Check that the filtered results are displayed
    page.getThreatModelCards().should('have.length.at.least', 1);

    // Check that all displayed threat models contain the search text
    page.getThreatModelCards().each($card => {
      cy.wrap($card).should('contain.text', 'System');
    });

    // Clear the search
    page.clearSearch();

    // Check that all threat models are displayed again
    page.getThreatModelCards().should('have.length.at.least', 3);
  });

  it('should toggle mock data', () => {
    // Get the initial count of threat models
    let initialCount = 0;
    page.getThreatModelCardCount().then(count => {
      initialCount = count;
    });

    // Toggle mock data off
    page.toggleMockData();

    // Wait for the page to reload
    cy.wait(1000);

    // Check that the threat model count has changed
    // Note: This assumes that the real API returns a different number of threat models
    // In a real test, you might need to mock the API response
    page.getThreatModelCardCount().should('not.equal', initialCount);

    // Toggle mock data back on
    page.toggleMockData();

    // Wait for the page to reload
    cy.wait(1000);

    // Check that the threat model count is back to the initial count
    page.getThreatModelCardCount().should('equal', initialCount);
  });
});
