import { Page } from '@playwright/test';
import { NavbarPage } from '../pages/navbar.page';
import { UserPreferencesDialog } from '../dialogs/user-preferences.dialog';

/**
 * Flows for managing content provider tokens via the user preferences dialog
 * "Document sources" tab.
 */
// SEM@b3ead44cf22347220a308a3b5d954272ebc12eb5: E2E flow for linking and unlinking OAuth provider accounts
export class ConnectedAccountsFlow {
  private navbar: NavbarPage;
  private prefs: UserPreferencesDialog;

  // SEM@b3ead44cf22347220a308a3b5d954272ebc12eb5: initialize navbar and preferences dialog references for connected accounts flow
  constructor(private page: Page) {
    this.navbar = new NavbarPage(page);
    this.prefs = new UserPreferencesDialog(page);
  }

  /** Open user preferences and switch to the Document sources tab. */
  // SEM@b3ead44cf22347220a308a3b5d954272ebc12eb5: open user preferences and navigate to the Document sources tab
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
  // SEM@b3ead44cf22347220a308a3b5d954272ebc12eb5: start OAuth link flow for a provider; returns before consent screen
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
  // SEM@b3ead44cf22347220a308a3b5d954272ebc12eb5: unlink a connected OAuth provider and confirm the unlink dialog
  async unlinkProvider(providerId: string): Promise<void> {
    await this.prefs.unlinkButton(providerId).click();
    await this.prefs.unlinkConfirmDialog().waitFor({ state: 'visible', timeout: 5000 });
    await this.prefs.unlinkConfirmButton().click();
    await this.prefs.unlinkConfirmDialog().waitFor({ state: 'hidden', timeout: 5000 });
  }
}
