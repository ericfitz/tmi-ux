import { Locator, Page } from '@playwright/test';

// SEM@88e6a889c33276e0b9d96b4698fbf7d39d4a382b: Playwright page object for the related projects management dialog
export class RelatedProjectsDialog {
  private dialog: Locator;

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: bind Playwright page and locate the related-projects dialog container (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly relatedRows = () => this.dialog.getByTestId('related-projects-row');
  readonly addButton = () => this.dialog.getByTestId('related-projects-add-button');
  readonly projectInput = () => this.dialog.getByTestId('related-projects-project-input');
  readonly relationshipSelect = () =>
    this.dialog.getByTestId('related-projects-relationship-select');
  readonly customRelationshipInput = () =>
    this.dialog.getByTestId('related-projects-custom-relationship-input');
  readonly confirmAddButton = () => this.dialog.getByTestId('related-projects-confirm-add-button');
  readonly cancelAddButton = () => this.dialog.getByTestId('related-projects-cancel-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('related-projects-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('related-projects-save-button');

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: fetch the remove button for the related project row at the given index (pure)
  removeButton(index: number) {
    return this.relatedRows().nth(index).getByTestId('related-projects-remove-button');
  }

  // SEM@88e6a889c33276e0b9d96b4698fbf7d39d4a382b: search for a project by name and select it from the autocomplete dropdown
  async searchProject(name: string) {
    await this.projectInput().click();
    await this.projectInput().fill('');
    await this.projectInput().pressSequentially(name, { delay: 30 });
    const option = this.page
      .locator('.cdk-overlay-pane .mat-mdc-autocomplete-panel mat-option')
      .filter({ hasText: name });
    await option.first().waitFor({ state: 'visible', timeout: 10000 });
    await option.first().click();
  }

  // SEM@88e6a889c33276e0b9d96b4698fbf7d39d4a382b: select a relationship type from the dropdown panel (mutates shared state)
  async selectRelationship(relationship: string) {
    await this.relationshipSelect().click();
    const panel = this.page.locator('.cdk-overlay-pane .mat-mdc-select-panel');
    await panel.first().waitFor({ state: 'visible', timeout: 5000 });
    const option = panel.locator('mat-option').filter({ hasText: relationship });
    await option.first().waitFor({ state: 'visible', timeout: 5000 });
    await option.first().click();
    await panel.first().waitFor({ state: 'hidden', timeout: 5000 });
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: confirm adding a related project entry in the dialog (mutates shared state)
  async confirmAdd() {
    await this.confirmAddButton().click();
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: submit the related-projects dialog by clicking save (mutates shared state)
  async save() {
    await this.saveButton().click();
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: dismiss the related-projects dialog without saving (mutates shared state)
  async cancel() {
    await this.cancelButton().click();
  }
}
