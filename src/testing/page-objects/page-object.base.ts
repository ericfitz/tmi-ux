/**
 * Base class for page objects
 *
 * Page objects are a design pattern for encapsulating UI interactions in tests.
 * They provide a higher-level API for interacting with the UI, which makes tests
 * more readable and maintainable.
 */

/**
 * Base class for page objects
 */
export abstract class PageObject {
  /**
   * The base URL for the page
   */
  protected baseUrl: string;

  /**
   * Constructor
   * @param baseUrl The base URL for the page
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Navigate to the page
   * @param params Optional parameters to append to the URL
   */
  visit(params?: Record<string, string>): Cypress.Chainable<Cypress.AUTWindow> {
    let url = this.baseUrl;

    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        queryParams.append(key, value);
      });

      url += `?${queryParams.toString()}`;
    }

    return cy.visit(url);
  }

  /**
   * Get an element by test ID
   * @param testId The test ID of the element
   */
  getByTestId(testId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(`[data-testid="${testId}"]`);
  }

  /**
   * Get an element by CSS selector
   * @param selector The CSS selector
   */
  getBySelector(selector: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.get(selector);
  }

  /**
   * Get an element by text content
   * @param text The text content
   */
  getByText(text: string): Cypress.Chainable<JQuery<HTMLElement>> {
    // Use cy.get with :contains() selector instead of cy.contains()
    return cy.get(`body :contains("${text}")`).filter((index, element) => {
      // Filter to only elements that directly contain the text
      return element.innerText.includes(text);
    });
  }

  /**
   * Click an element by test ID
   * @param testId The test ID of the element
   */
  clickByTestId(testId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getByTestId(testId).click();
  }

  /**
   * Click an element by CSS selector
   * @param selector The CSS selector
   */
  clickBySelector(selector: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector(selector).click();
  }

  /**
   * Click an element by text content
   * @param text The text content
   */
  clickByText(text: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getByText(text).first().click();
  }

  /**
   * Type text into an element by test ID
   * @param testId The test ID of the element
   * @param text The text to type
   */
  typeByTestId(testId: string, text: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getByTestId(testId).type(text);
  }

  /**
   * Type text into an element by CSS selector
   * @param selector The CSS selector
   * @param text The text to type
   */
  typeBySelector(selector: string, text: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector(selector).type(text);
  }

  /**
   * Clear an input element by test ID
   * @param testId The test ID of the element
   */
  clearByTestId(testId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getByTestId(testId).clear();
  }

  /**
   * Clear an input element by CSS selector
   * @param selector The CSS selector
   */
  clearBySelector(selector: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector(selector).clear();
  }

  /**
   * Select an option from a dropdown by test ID
   * @param testId The test ID of the dropdown
   * @param value The value to select
   */
  selectByTestId(testId: string, value: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getByTestId(testId).select(value);
  }

  /**
   * Select an option from a dropdown by CSS selector
   * @param selector The CSS selector
   * @param value The value to select
   */
  selectBySelector(selector: string, value: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector(selector).select(value);
  }

  /**
   * Check if an element exists by test ID
   * @param testId The test ID of the element
   */
  shouldExistByTestId(testId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getByTestId(testId).should('exist');
  }

  /**
   * Check if an element exists by CSS selector
   * @param selector The CSS selector
   */
  shouldExistBySelector(selector: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector(selector).should('exist');
  }

  /**
   * Check if an element does not exist by test ID
   * @param testId The test ID of the element
   */
  shouldNotExistByTestId(testId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getByTestId(testId).should('not.exist');
  }

  /**
   * Check if an element does not exist by CSS selector
   * @param selector The CSS selector
   */
  shouldNotExistBySelector(selector: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector(selector).should('not.exist');
  }

  /**
   * Check if an element is visible by test ID
   * @param testId The test ID of the element
   */
  shouldBeVisibleByTestId(testId: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getByTestId(testId).should('be.visible');
  }

  /**
   * Check if an element is visible by CSS selector
   * @param selector The CSS selector
   */
  shouldBeVisibleBySelector(selector: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector(selector).should('be.visible');
  }

  /**
   * Check if an element contains text by test ID
   * @param testId The test ID of the element
   * @param text The text to check for
   */
  shouldContainTextByTestId(testId: string, text: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getByTestId(testId).should('contain.text', text);
  }

  /**
   * Check if an element contains text by CSS selector
   * @param selector The CSS selector
   * @param text The text to check for
   */
  shouldContainTextBySelector(
    selector: string,
    text: string,
  ): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector(selector).should('contain.text', text);
  }

  /**
   * Wait for an element to exist by test ID
   * @param testId The test ID of the element
   * @param timeout The timeout in milliseconds
   */
  waitForElementByTestId(testId: string, timeout = 10000): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getByTestId(testId).should('exist', { timeout });
  }

  /**
   * Wait for an element to exist by CSS selector
   * @param selector The CSS selector
   * @param timeout The timeout in milliseconds
   */
  waitForElementBySelector(
    selector: string,
    timeout = 10000,
  ): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector(selector).should('exist', { timeout });
  }
}
