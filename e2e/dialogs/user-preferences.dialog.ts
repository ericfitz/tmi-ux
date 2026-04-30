import { Locator, Page } from '@playwright/test';

/**
 * The user preferences dialog hosted by the navbar avatar button. Includes
 * the "Document sources" tab where content provider tokens are managed.
 */
export class UserPreferencesDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container').filter({
      has: page.getByTestId('user-preferences-dialog'),
    });
  }

  readonly closeButton = () => this.dialog.getByTestId('pref-close-button');

  /** Tab labels are translated; we match by visible text. */
  readonly documentSourcesTab = () =>
    this.dialog.locator('div[role="tab"]', { hasText: /document sources/i });

  readonly documentSourcesEmpty = () => this.dialog.getByTestId('document-sources-empty');
  readonly documentSourcesRows = () => this.dialog.getByTestId('document-sources-row');
  readonly documentSourcesRowFor = (providerLabel: string) =>
    this.dialog
      .locator('tr.mat-mdc-row')
      .filter({ has: this.documentSourcesRows().filter({ hasText: providerLabel }) });

  /** Single-provider connect button (when only one provider available). */
  readonly connectButtonSingle = (providerId: string) =>
    this.dialog.getByTestId(`document-sources-connect-${providerId}`);

  /** Multi-provider connect menu trigger + items. */
  readonly connectMenuTrigger = () => this.dialog.getByTestId('document-sources-connect-menu');
  readonly connectMenuItem = (providerId: string) =>
    this.page.getByTestId(`document-sources-connect-${providerId}`);

  readonly unlinkButton = (providerId: string) =>
    this.dialog.getByTestId(`document-sources-unlink-${providerId}`);
  readonly relinkButton = (providerId: string) =>
    this.dialog.getByTestId(`document-sources-relink-${providerId}`);

  // Unlink confirm dialog (sibling mat-dialog-container).
  readonly unlinkConfirmDialog = () =>
    this.page.locator('mat-dialog-container').filter({
      has: this.page.getByTestId('unlink-confirm-button'),
    });
  readonly unlinkConfirmButton = () => this.page.getByTestId('unlink-confirm-button');
  readonly unlinkCancelButton = () => this.page.getByTestId('unlink-cancel-button');

  /** Open the Document sources tab via tab label click. */
  async openDocumentSourcesTab() {
    await this.documentSourcesTab().click();
  }

  async close() {
    await this.closeButton().click();
  }
}
