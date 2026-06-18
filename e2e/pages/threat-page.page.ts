import { Page } from '@playwright/test';

// SEM@cbe04d1beae39fd5d2c0e2717ee7a1eddf67271c: Playwright page object exposing threat edit form locators and actions (pure)
export class ThreatPage {
  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: bind the Playwright page for the threat page object (pure)
  constructor(private page: Page) {}

  readonly nameInput = () => this.page.getByTestId('threat-page-name-input');
  readonly descriptionInput = () => this.page.getByTestId('threat-page-description-input');
  readonly statusSelect = () => this.page.getByTestId('threat-page-status-select');
  readonly severitySelect = () => this.page.getByTestId('threat-page-severity-select');
  readonly scoreInput = () => this.page.getByTestId('threat-page-score-input');
  readonly prioritySelect = () => this.page.getByTestId('threat-page-priority-select');
  readonly saveButton = () => this.page.getByTestId('threat-page-save-button');
  readonly deleteButton = () => this.page.getByTestId('threat-page-delete-button');
  readonly addCweButton = () => this.page.getByTestId('threat-page-add-cwe-button');
  readonly cweChips = () => this.page.getByTestId('threat-page-cwe-chip');
  readonly openCvssButton = () => this.page.getByTestId('threat-page-open-cvss-button');
  readonly cvssChips = () => this.page.getByTestId('threat-page-cvss-chip');
  readonly threatTypeChips = () => this.page.getByTestId('threat-page-threat-type-chip');
  readonly addMappingButton = () => this.page.getByTestId('threat-page-add-mapping-button');

  // SEM@cbe04d1beae39fd5d2c0e2717ee7a1eddf67271c: fill the threat name input with the given value
  async fillName(name: string) {
    await this.nameInput().fill(name);
  }

  // SEM@cbe04d1beae39fd5d2c0e2717ee7a1eddf67271c: fill the threat description input with the given value
  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: click the save button to submit the threat form
  async save() {
    await this.saveButton().click();
  }
}
