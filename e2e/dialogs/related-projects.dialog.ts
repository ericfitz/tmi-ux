import { Locator, Page } from '@playwright/test';

export class RelatedProjectsDialog {
  private dialog: Locator;

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

  removeButton(index: number) {
    return this.relatedRows().nth(index).getByTestId('related-projects-remove-button');
  }

  async searchProject(name: string) {
    await this.projectInput().fill(name);
    await this.page.locator('mat-option').filter({ hasText: name }).click();
  }

  async selectRelationship(relationship: string) {
    await this.relationshipSelect().click();
    await this.page.locator('mat-option').filter({ hasText: relationship }).click();
  }

  async confirmAdd() {
    await this.confirmAddButton().click();
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
