import { Locator, Page } from '@playwright/test';

// SEM@60d89351e8844eed9620a8e65e90ec07b2af32fd: page object for the SSVC calculator dialog; navigate steps and apply score
export class SsvcCalculatorDialog {
  private dialog: Locator;

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: bind the SSVC calculator page object to the Playwright page (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly stepDots = () => this.dialog.getByTestId('ssvc-step-dot');
  readonly valueCards = () => this.dialog.getByTestId('ssvc-value-card');
  readonly backButton = () => this.dialog.getByTestId('ssvc-back-button');
  readonly nextButton = () => this.dialog.getByTestId('ssvc-next-button');
  readonly cancelButton = () => this.dialog.getByTestId('ssvc-cancel-button');
  readonly applyButton = () => this.dialog.getByTestId('ssvc-apply-button');
  readonly decisionBadge = () => this.dialog.getByTestId('ssvc-decision-badge');
  readonly summaryRows = () => this.dialog.getByTestId('ssvc-summary-row');

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: fetch the step indicator locator at a given index (pure)
  stepDot(index: number): Locator {
    return this.stepDots().nth(index);
  }

  // SEM@60d89351e8844eed9620a8e65e90ec07b2af32fd: fetch the SSVC value card locator matching a given option name (pure)
  valueCard(name: string): Locator {
    return this.valueCards().filter({ has: this.page.locator('.value-name', { hasText: name }) });
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: fetch the SSVC summary row locator at a given index (pure)
  summaryRow(index: number): Locator {
    return this.summaryRows().nth(index);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: select an SSVC option value by clicking its value card
  async selectValue(name: string) {
    await this.valueCard(name).click();
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: advance to the next SSVC calculator step by clicking next
  async next() {
    await this.nextButton().click();
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: return to the previous SSVC calculator step by clicking back
  async back() {
    await this.backButton().click();
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: submit the SSVC score by clicking apply
  async apply() {
    await this.applyButton().click();
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: dismiss the SSVC calculator dialog by clicking cancel
  async cancel() {
    await this.cancelButton().click();
  }
}
