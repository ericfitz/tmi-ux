import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DocumentFlow } from '../../flows/document.flow';
import { DocumentEditorDialog } from '../../dialogs/document-editor.dialog';

/**
 * Test #646 case 4: a document whose URL points at a Google Drive file the
 * service account can't reach renders the diagnostics panel and at least one
 * remediation control when re-opened in the editor.
 *
 * The local TMI dev backend has the google_drive service-account source
 * enabled (see CLAUDE.md / dev config). Creating a doc with a Google Drive
 * URL pointing at a non-existent file triggers ValidateAccess to return
 * (false, nil), which the create handler maps to access_status=pending_access
 * with a diagnostic reason_code persisted on the row. On subsequent GET, the
 * handler builds and returns access_diagnostics, which the editor dialog
 * uses to render the AccessDiagnosticsPanel.
 */
userTest.describe('Document access diagnostics panel', () => {
  userTest.setTimeout(120000);

  userTest('renders diagnostics + remediation for unreachable Drive URL', async ({ userPage }) => {
    const tmFlow = new ThreatModelFlow(userPage);
    const docFlow = new DocumentFlow(userPage);
    const editor = new DocumentEditorDialog(userPage);
    const tmName = `E2E Diagnostics ${Date.now()}`;
    const docName = 'Bogus Drive Doc';
    // Drive file IDs are typically ~33 chars; this synthetic id will
    // resolve to a 404 from Drive's metadata API.
    const bogusUri = `https://docs.google.com/document/d/E2ETEST${Date.now()}NONEXISTENT/edit`;

    await tmFlow.createFromDashboard(tmName);

    // Create the document via the dialog. Wait for the POST so the server
    // has completed access validation before we proceed.
    const createResponse = userPage.waitForResponse(
      resp =>
        resp.url().includes('/threat_models/') &&
        resp.url().includes('/documents') &&
        resp.request().method() === 'POST',
      { timeout: 60000 },
    );
    await docFlow.createFromTmEdit({ name: docName, uri: bogusUri });
    const response = await createResponse;
    expect(response.status()).toBe(201);

    // Re-open the document in edit mode. The GET handler populates
    // access_diagnostics on the response, which the dialog reads to
    // render the panel.
    const documentRow = userPage.getByTestId('document-row').filter({ hasText: docName });
    await documentRow.click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible', timeout: 5000 });

    await expect(editor.diagnosticsBanner()).toBeVisible({ timeout: 10000 });

    // At least one remediation surface must be present. Either a generic
    // remediation button (data-testid="remediation-<action>") or the
    // share-with-application sub-component.
    const remediationCount = await userPage.locator('[data-testid^="remediation-"]').count();
    const shareApp = await userPage.locator('app-share-with-application-remediation').count();
    expect(remediationCount + shareApp).toBeGreaterThan(0);

    await editor.cancel();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 5000 });

    // Cleanup
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await tmFlow.deleteFromDashboard(tmName).catch(() => undefined);
  });
});
