import { Page } from '@playwright/test';
import { MetadataDialog } from '../dialogs/metadata.dialog';

// SEM@b040dc0c1400a4a5bfc238295aa021aa0a18c4a7: E2E page-object flow for metadata entry add, edit, delete, and save actions
export class MetadataFlow {
  private metadataDialog: MetadataDialog;

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: initialize the metadata dialog page object (pure)
  constructor(private page: Page) {
    this.metadataDialog = new MetadataDialog(page);
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: add a key-value metadata entry via the dialog (mutates shared state)
  async addEntry(key: string, value: string) {
    await this.metadataDialog.addEntry(key, value);
  }

  // SEM@b040dc0c1400a4a5bfc238295aa021aa0a18c4a7: update the key and/or value of a metadata entry at a given index (mutates shared state)
  async editEntry(index: number, key?: string, value?: string) {
    if (key !== undefined) {
      await this.metadataDialog.fillInput(this.metadataDialog.keyInput(index), key);
    }
    if (value !== undefined) {
      await this.metadataDialog.fillInput(this.metadataDialog.valueInput(index), value);
    }
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: delete a metadata entry at a given index via the dialog (mutates shared state)
  async deleteEntry(index: number) {
    await this.metadataDialog.deleteButton(index).click();
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: save metadata changes and wait for the dialog to close (mutates shared state)
  async saveAndClose() {
    await this.metadataDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }
}
