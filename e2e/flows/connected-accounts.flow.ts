import { Page } from '@playwright/test';
import { NavbarPage } from '../pages/navbar.page';
import { UserPreferencesDialog } from '../dialogs/user-preferences.dialog';

/**
 * Flows for managing content provider tokens via the user preferences dialog
 * "Document sources" tab.
 */
export class ConnectedAccountsFlow {
  private navbar: NavbarPage;
  private prefs: UserPreferencesDialog;

  constructor(private page: Page) {
    this.navbar = new NavbarPage(page);
    this.prefs = new UserPreferencesDialog(page);
  }

  /** Open user preferences and switch to the Document sources tab. */
  async openDocumentSourcesTab(): Promise<void> {
    await this.navbar.userMenu().click();
    await this.prefs.documentSourcesTab().waitFor({ state: 'visible', timeout: 5000 });
    await this.prefs.openDocumentSourcesTab();
  }

  /**
   * Initiate the OAuth link flow for a provider. Returns immediately after
   * navigation begins — the caller is responsible for handling the consent
   * screen (manual interaction in google-drive-live tests).
   */
  async initiateConnect(providerId: string): Promise<void> {
    const single = this.prefs.connectButtonSingle(providerId);
    if (await single.isVisible().catch(() => false)) {
      await single.click();
      return;
    }
    await this.prefs.connectMenuTrigger().click();
    const menuItem = this.prefs.connectMenuItem(providerId);
    await menuItem.waitFor({ state: 'visible', timeout: 5000 });
    await menuItem.dispatchEvent('click');
  }

  /** Click unlink + confirm. Resolves once the unlink dialog has closed. */
  async unlinkProvider(providerId: string): Promise<void> {
    await this.prefs.unlinkButton(providerId).click();
    await this.prefs.unlinkConfirmDialog().waitFor({ state: 'visible', timeout: 5000 });
    await this.prefs.unlinkConfirmButton().click();
    await this.prefs.unlinkConfirmDialog().waitFor({ state: 'hidden', timeout: 5000 });
  }
}
