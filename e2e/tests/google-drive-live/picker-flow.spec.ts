import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { ConnectedAccountsFlow } from '../../flows/connected-accounts.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DocumentSourceFlow } from '../../flows/document-source.flow';
import { DocumentEditorDialog } from '../../dialogs/document-editor.dialog';
import {
  GOOGLE_DRIVE_SKIP_REASON,
  loadGoogleDriveConfig,
} from '../../helpers/google-drive-config';

/**
 * Test #646 case 2: open the document-editor dialog, switch to Google
 * Drive, open the picker, pick the fixture file, save, and verify the
 * POST request body carries the expected picker_registration payload.
 *
 * Fully independent — does its own OAuth link and unlinks at the end so
 * re-runs start from empty state. Requires human consent + human picker
 * selection.
 */
const config = loadGoogleDriveConfig();

userTest.describe('Google Drive — picker flow attaches with picker_registration', () => {
  userTest.skip(!config, GOOGLE_DRIVE_SKIP_REASON);

  userTest('captures picker_registration in document POST', async ({ userPage }) => {
    const tmFlow = new ThreatModelFlow(userPage);
    const tmName = `E2E Picker Flow ${Date.now()}`;

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
      // Clean slate
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await revokeToken();

      const accounts = new ConnectedAccountsFlow(userPage);
      const sourceFlow = new DocumentSourceFlow(userPage);
      const editor = new DocumentEditorDialog(userPage);

      // Link Google Workspace.
      await accounts.openDocumentSourcesTab();
      console.log(
        `\n[google-drive-live] Step 1: complete Google consent for ${config!.googleAccount}.\n`,
      );
      await accounts.initiateConnect('google_workspace');
      await userPage.waitForURL(/\/dashboard(\?.*)?$/, { timeout: 4 * 60 * 1000 });
      await userPage.waitForLoadState('networkidle');

      // Create TM and open Add Document dialog with Google Drive selected.
      await tmFlow.createFromDashboard(tmName);
      await sourceFlow.openCreateAndSelectSource('google_workspace');

      // Open the picker. Wait for the human to select the fixture file —
      // detected by the picked-file hint appearing in the dialog.
      console.log(
        `\n[google-drive-live] Step 2: in the Google Picker, select "${config!.fixtureFileName}" (file id: ${config!.fixtureFileId}).\n`,
      );
      await sourceFlow.clickPick();
      await expect(editor.pickedFileHint()).toBeVisible({ timeout: 4 * 60 * 1000 });

      // Save and capture both the request body and response status.
      const createRequest = userPage.waitForRequest(
        req =>
          /\/threat_models\/[^/]+\/documents$/.test(new URL(req.url()).pathname) &&
          req.method() === 'POST',
        { timeout: 30000 },
      );
      const createResponse = userPage.waitForResponse(
        resp =>
          /\/threat_models\/[^/]+\/documents$/.test(new URL(resp.url()).pathname) &&
          resp.request().method() === 'POST',
        { timeout: 30000 },
      );
      await editor.save();
      const request = await createRequest;
      const response = await createResponse;
      const body = request.postDataJSON() as {
        picker_registration?: { provider_id: string; file_id: string; mime_type: string };
      };

      expect(response.status()).toBe(201);
      expect(body.picker_registration).toBeDefined();
      expect(body.picker_registration!.provider_id).toBe('google_workspace');
      expect(body.picker_registration!.file_id).toBe(config!.fixtureFileId);
      expect(body.picker_registration!.mime_type).toBe(config!.fixtureMimeType);

      await userPage.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
    } finally {
      await userPage.goto('/dashboard').catch(() => undefined);
      await userPage.waitForLoadState('networkidle').catch(() => undefined);
      await tmFlow.deleteFromDashboard(tmName).catch(() => undefined);
      await revokeToken();
    }
  });
});
