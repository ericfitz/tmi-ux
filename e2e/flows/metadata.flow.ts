import { Page } from '@playwright/test';
import { MetadataDialog } from '../dialogs/metadata.dialog';

export class MetadataFlow {
  private metadataDialog: MetadataDialog;

  constructor(private page: Page) {
    this.metadataDialog = new MetadataDialog(page);
  }

  async addEntry(key: string, value: string) {
    await this.metadataDialog.addEntry(key, value);
  }

  async editEntry(index: number, key?: string, value?: string) {
    if (key !== undefined) {
      await this.metadataDialog.fillInput(this.metadataDialog.keyInput(index), key);
    }
    if (value !== undefined) {
      await this.metadataDialog.fillInput(this.metadataDialog.valueInput(index), value);
    }
  }

  async deleteEntry(index: number) {
    await this.metadataDialog.deleteButton(index).click();
  }

  async saveAndClose() {
    await this.metadataDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }
}
