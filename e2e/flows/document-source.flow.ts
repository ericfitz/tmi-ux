import { Page } from '@playwright/test';
import { DocumentEditorDialog } from '../dialogs/document-editor.dialog';

/**
 * Flows for the source selector + picker affordances inside the
 * document-editor dialog (create mode). Picker interactions in
 * google-drive-live tests require a human to select a file.
 */
// SEM@b3ead44cf22347220a308a3b5d954272ebc12eb5: E2E flow for document source selection and file-picker interactions
export class DocumentSourceFlow {
  private editor: DocumentEditorDialog;

  // SEM@b3ead44cf22347220a308a3b5d954272ebc12eb5: initialize the document editor dialog page object (pure)
  constructor(private page: Page) {
    this.editor = new DocumentEditorDialog(page);
  }

  /**
   * Open the create-document dialog from the tm-edit page (caller must
   * already be on a tm-edit page). Selects the given source value.
   */
  // SEM@b3ead44cf22347220a308a3b5d954272ebc12eb5: open the create-document dialog and select a source type (mutates shared state)
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
  // SEM@b3ead44cf22347220a308a3b5d954272ebc12eb5: click the file-picker button to open the external file selector (mutates shared state)
  async clickPick(): Promise<void> {
    await this.editor.pickButton().click();
  }
}
