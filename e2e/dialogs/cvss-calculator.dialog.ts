import { Locator, Page } from '@playwright/test';

export class CvssCalculatorDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly versionToggle = (v: string) =>
    this.dialog.getByTestId(`cvss-version-${v}`);

  readonly metricGroup = (shortName: string) =>
    this.dialog.getByTestId(`cvss-metric-${shortName}`);

  readonly metricValue = (metric: string, value: string) =>
    this.dialog.getByTestId(`cvss-metric-value-${metric}-${value}`);

  readonly scoreDisplay = () => this.dialog.getByTestId('cvss-score-display');
  readonly vectorDisplay = () => this.dialog.getByTestId('cvss-vector-display');
  readonly applyButton = () => this.dialog.getByTestId('cvss-apply-button');
  readonly cancelButton = () => this.dialog.getByTestId('cvss-cancel-button');

  async selectVersion(v: '3.1' | '4.0') {
    await this.versionToggle(v).click();
  }

  async setMetric(metric: string, value: string) {
    await this.metricValue(metric, value).click();
  }

  async apply() {
    await this.applyButton().click();
  }
}
