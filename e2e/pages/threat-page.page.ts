import { Page } from '@playwright/test';

export class ThreatPage {
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

  async fillName(name: string) {
    await this.nameInput().clear();
    await this.nameInput().pressSequentially(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().clear();
    await this.descriptionInput().pressSequentially(desc);
  }

  async save() {
    await this.saveButton().click();
  }
}
