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
 * Test #646 case 5: unlinking the Google Workspace source clears picker
 * metadata on existing documents — the access_status transitions to
 * 'unknown' and the picker fields are nulled (server-side cascade).
 *
 * Fully independent — does its own link + pick + unlink. Requires human
 * consent + human picker selection.
 */
const config = loadGoogleDriveConfig();

userTest.describe('Google Drive — unlink clears picker metadata cascade', () => {
  userTest.skip(!config, GOOGLE_DRIVE_SKIP_REASON);

  userTest('document access_status reverts to unknown after unlink', async ({ userPage }) => {
    const tmFlow = new ThreatModelFlow(userPage);
    const tmName = `E2E Unlink Cascade ${Date.now()}`;

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

      // Create TM and add a picker-attached document.
      await tmFlow.createFromDashboard(tmName);
      await sourceFlow.openCreateAndSelectSource('google_workspace');
      console.log(
        `\n[google-drive-live] Step 2: select "${config!.fixtureFileName}" in the picker.\n`,
      );
      await sourceFlow.clickPick();
      await expect(editor.pickedFileHint()).toBeVisible({ timeout: 4 * 60 * 1000 });

      const tmIdAndDocId = userPage.waitForResponse(
        resp =>
          /\/threat_models\/[^/]+\/documents$/.test(new URL(resp.url()).pathname) &&
          resp.request().method() === 'POST',
        { timeout: 30000 },
      );
      await editor.save();
      const docResponse = await tmIdAndDocId;
      const docBody = (await docResponse.json()) as { id?: string };
      const documentId = docBody.id;
      const tmMatch = docResponse.url().match(/\/threat_models\/([^/]+)\/documents$/);
      const threatModelId = tmMatch?.[1];
      if (!threatModelId) {
        throw new Error(`Failed to extract threat model id from URL: ${docResponse.url()}`);
      }
      if (!documentId) {
        throw new Error(
          `Failed to extract document id from response body: ${JSON.stringify(docBody)}`,
        );
      }

      await userPage.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });

      // Unlink Google Workspace via prefs UI.
      await accounts.openDocumentSourcesTab();
      await accounts.unlinkProvider('google_workspace');

      // Verify the cascade: GET the document by id, assert access_status is
      // 'unknown'. Use the browser fetch so cookies/bearer flow.
      const updated = await userPage.evaluate(
        async ({ tmId, docId }) => {
          const resp = await fetch(
            `http://localhost:8080/threat_models/${tmId}/documents/${docId}`,
            { credentials: 'include' },
          );
          if (!resp.ok) return { ok: false, status: resp.status };
          const body = (await resp.json()) as { access_status?: string };
          return { ok: true, access_status: body.access_status };
        },
        { tmId: threatModelId, docId: documentId },
      );

      expect(updated.ok).toBe(true);
      expect(updated.access_status).toBe('unknown');
    } finally {
      await userPage.goto('/dashboard').catch(() => undefined);
      await userPage.waitForLoadState('networkidle').catch(() => undefined);
      await tmFlow.deleteFromDashboard(tmName).catch(() => undefined);
      await revokeToken();
    }
  });
});
