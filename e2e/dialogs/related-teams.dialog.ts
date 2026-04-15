import { Locator, Page } from '@playwright/test';

export class RelatedTeamsDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly relatedRows = () => this.dialog.getByTestId('related-teams-row');
  readonly addButton = () => this.dialog.getByTestId('related-teams-add-button');
  readonly teamInput = () => this.dialog.getByTestId('related-teams-team-input');
  readonly relationshipSelect = () =>
    this.dialog.getByTestId('related-teams-relationship-select');
  readonly customRelationshipInput = () =>
    this.dialog.getByTestId('related-teams-custom-relationship-input');
  readonly confirmAddButton = () => this.dialog.getByTestId('related-teams-confirm-add-button');
  readonly cancelAddButton = () => this.dialog.getByTestId('related-teams-cancel-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('related-teams-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('related-teams-save-button');

  removeButton(index: number) {
    return this.relatedRows().nth(index).getByTestId('related-teams-remove-button');
  }

  async searchTeam(name: string) {
    await this.teamInput().fill(name);
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
