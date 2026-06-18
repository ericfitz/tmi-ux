import { Locator, Page } from '@playwright/test';

// SEM@d7e72d2d50ea886ef5f55e0c39b76aab799f9a74: Playwright page object for the CVSS score calculator dialog
export class CvssCalculatorDialog {
  private dialog: Locator;

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: bind the dialog locator to the mat-dialog-container (pure)
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

  // SEM@d7e72d2d50ea886ef5f55e0c39b76aab799f9a74: select a CVSS version in the calculator dialog, skipping if already active
  async selectVersion(v: '3.1' | '4.0') {
    // Check if the version toggle is already selected (active) — skip if so.
    // When the dialog auto-selects a version (e.g., 4.0 when 3.1 exists),
    // the toggle group may be locked and clicking it would fail.
    const toggle = this.versionToggle(v);
    const isChecked = await toggle.getAttribute('class');
    if (isChecked?.includes('mat-button-toggle-checked')) {
      return;
    }
    await toggle.locator('button').dispatchEvent('click');
  }

  // SEM@d7e72d2d50ea886ef5f55e0c39b76aab799f9a74: set a CVSS metric value by clicking its toggle in the calculator dialog
  async setMetric(metric: string, value: string) {
    const toggle = this.metricValue(metric, value);
    // Scroll into view first — metric may be outside the dialog viewport
    await toggle.scrollIntoViewIfNeeded();
    // Use dispatchEvent to bypass tooltip overlay interception
    await toggle.locator('button').dispatchEvent('click');
  }

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: apply the computed CVSS score and close the calculator dialog
  async apply() {
    await this.applyButton().click();
  }
}
