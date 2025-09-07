/**
 * Page object for the threat model list page
 */

import { PageObject } from './page-object.base';

/**
 * Page object for the threat model list page
 */
export class ThreatModelListPage extends PageObject {
  /**
   * Constructor
   */
  constructor() {
    super('/tm');
  }

  /**
   * Get the page title
   */
  getPageTitle(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector('h1');
  }

  /**
   * Get all threat model cards
   */
  getThreatModelCards(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector('.threat-model-card');
  }

  /**
   * Get a threat model card by name
   * @param name The name of the threat model
   */
  getThreatModelCardByName(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getThreatModelCards().filter(`:contains("${name}")`);
  }

  /**
   * Click on a threat model card by name
   * @param name The name of the threat model
   */
  clickThreatModelCardByName(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getThreatModelCardByName(name).click();
  }

  /**
   * Get the create new button
   */
  getCreateNewButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector('button:contains("Create New")');
  }

  /**
   * Click the create new button
   */
  clickCreateNewButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getCreateNewButton().click();
  }

  /**
   * Get the search input
   */
  getSearchInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector('input[placeholder="Search"]');
  }

  /**
   * Search for a threat model
   * @param searchText The text to search for
   */
  search(searchText: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getSearchInput().type(searchText);
  }

  /**
   * Clear the search input
   */
  clearSearch(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getSearchInput().clear();
  }

  /**
   * Check if a threat model with the specified name exists
   * @param name The name of the threat model
   */
  threatModelWithNameExists(name: string): Cypress.Chainable<boolean> {
    return this.getThreatModelCards().then($cards => {
      const cardTexts = $cards.toArray().map(card => card.textContent);
      return cardTexts.some(text => text && text.includes(name));
    });
  }

  /**
   * Get the count of threat model cards
   */
  getThreatModelCardCount(): Cypress.Chainable<number> {
    return this.getThreatModelCards().its('length');
  }

  /**
   * Wait for threat model cards to load
   * @param timeout The timeout in milliseconds
   */
  waitForThreatModelCardsToLoad(timeout = 10000): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getThreatModelCards().should('exist', { timeout });
  }

  /**
   * Check if the page is loaded
   */
  isLoaded(): Cypress.Chainable<boolean> {
    return this.getPageTitle()
      .should('be.visible')
      .then(() => true);
  }
}
