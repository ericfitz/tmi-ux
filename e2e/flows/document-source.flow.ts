import { Page } from '@playwright/test';
import { DocumentEditorDialog } from '../dialogs/document-editor.dialog';

/**
 * Flows for the source selector + picker affordances inside the
 * document-editor dialog (create mode). Picker interactions in
 * google-drive-live tests require a human to select a file.
 */
export class DocumentSourceFlow {
  private editor: DocumentEditorDialog;

  constructor(private page: Page) {
    this.editor = new DocumentEditorDialog(page);
  }

  /**
   * Open the create-document dialog from the tm-edit page (caller must
   * already be on a tm-edit page). Selects the given source value.
   */
  async openCreateAndSelectSource(value: string): Promise<void> {
    const addButton = this.page.getByTestId('add-document-button');
    await addButton.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await addButton.click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible', timeout: 5000 });
    await this.editor.selectSource(value);
  }

  /**
   * Click the "Pick a file" button. Returns immediately — the caller is
   * responsible for waiting on picker completion (typically by waiting
   * for the picked-file hint or the form fields to populate).
   */
  async clickPick(): Promise<void> {
    await this.editor.pickButton().click();
  }
}
