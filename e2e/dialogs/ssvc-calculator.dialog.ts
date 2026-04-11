import { Locator, Page } from '@playwright/test';

export class SsvcCalculatorDialog {
  private dialog: Locator;

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

  stepDot(index: number): Locator {
    return this.stepDots().nth(index);
  }

  valueCard(name: string): Locator {
    return this.valueCards().filter({ hasText: name });
  }

  summaryRow(index: number): Locator {
    return this.summaryRows().nth(index);
  }

  async selectValue(name: string) {
    await this.valueCard(name).click();
  }

  async next() {
    await this.nextButton().click();
  }

  async back() {
    await this.backButton().click();
  }

  async apply() {
    await this.applyButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
