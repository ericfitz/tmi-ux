import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { ConnectedAccountsFlow } from '../../flows/connected-accounts.flow';
import { UserPreferencesDialog } from '../../dialogs/user-preferences.dialog';
import {
  GOOGLE_DRIVE_SKIP_REASON,
  loadGoogleDriveConfig,
} from '../../helpers/google-drive-config';

/**
 * Test #646 case 1: link a Google Workspace account via the Document
 * sources tab in user preferences. Performs the full OAuth round trip
 * through Google's consent screen — the test pauses while the human
 * completes consent, then resumes once the page has navigated back.
 *
 * Requires e2e/config/google-drive.local.json. Skipped otherwise.
 */
const config = loadGoogleDriveConfig();

userTest.describe('Google Workspace — link account via Document sources tab', () => {
  userTest.skip(!config, GOOGLE_DRIVE_SKIP_REASON);

  userTest('completes OAuth round trip and shows token row', async ({ userPage }) => {
    const revokeToken = async () => {
      await userPage
        .evaluate(async () => {
          await fetch('http://localhost:8080/me/content_tokens/google_workspace', {
            method: 'DELETE',
            credentials: 'include',
          });
        })
        .catch(() => undefined);
    };

    try {
      // Clean slate — revoke any prior token so the consent screen always shows.
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await revokeToken();

      const accounts = new ConnectedAccountsFlow(userPage);
      const prefs = new UserPreferencesDialog(userPage);

      await accounts.openDocumentSourcesTab();

      // Empty-state should render before linking.
      await expect(prefs.documentSourcesEmpty()).toBeVisible({ timeout: 5000 });

      console.log(
        `\n[google-drive-live] Click through Google's consent screen using ${config!.googleAccount}. The test will resume automatically.\n`,
      );

      await accounts.initiateConnect('google_workspace');

      // Wait for the round trip to complete and land back on the app. The
      // ContentCallbackComponent navigates to the returnTo (/dashboard) after
      // refreshing tokens.
      await userPage.waitForURL(/\/dashboard(\?.*)?$/, { timeout: 4 * 60 * 1000 });
      await userPage.waitForLoadState('networkidle');

      // Re-open prefs — the token row should now show.
      await accounts.openDocumentSourcesTab();
      await expect(prefs.documentSourcesRows().first()).toBeVisible({ timeout: 10000 });
    } finally {
      await revokeToken();
    }
  });
});
