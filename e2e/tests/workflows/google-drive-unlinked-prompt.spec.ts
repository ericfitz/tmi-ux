import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DocumentSourceFlow } from '../../flows/document-source.flow';
import { DocumentEditorDialog } from '../../dialogs/document-editor.dialog';

/**
 * Test #646 case 3: an unlinked user who switches the source selector to
 * Google Drive sees the inline link-account prompt (and the link button)
 * rather than the picker button. Pure client-state assertion — no live
 * Google account required.
 */
userTest.describe('Google Drive — unlinked user shows link prompt', () => {
  userTest.setTimeout(60000);

  userTest('shows link prompt when no google_workspace token', async ({ userPage }) => {
    // Ensure clean state: revoke any pre-existing google_workspace token. The
    // server returns 204 whether or not the row existed.
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await userPage.evaluate(async () => {
      await fetch('http://localhost:8080/me/content_tokens/google_workspace', {
        method: 'DELETE',
        credentials: 'include',
      });
    });

    const tmFlow = new ThreatModelFlow(userPage);
    const sourceFlow = new DocumentSourceFlow(userPage);
    const editor = new DocumentEditorDialog(userPage);
    const tmName = `E2E GDrive Unlinked Prompt ${Date.now()}`;

    await tmFlow.createFromDashboard(tmName);

    // The radio only renders if the picker provider registry includes
    // google_workspace with supportsPicker=true. Guard explicitly so a
    // registry change produces a clear failure rather than a misleading
    // selectSource timeout.
    await sourceFlow.openCreateAndSelectSource('google_workspace');
    await expect(editor.sourceRadio('google_workspace')).toBeVisible();

    await expect(editor.linkSourceButton()).toBeVisible({ timeout: 5000 });
    await expect(editor.pickButton()).toHaveCount(0);

    await editor.cancel();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 5000 });

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await tmFlow.deleteFromDashboard(tmName).catch(() => undefined);
  });
});
