import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { AssetFlow } from '../../flows/asset.flow';
import { DocumentFlow } from '../../flows/document.flow';
import { RepositoryFlow } from '../../flows/repository.flow';
import { NoteFlow } from '../../flows/note.flow';
import { MetadataFlow } from '../../flows/metadata.flow';
import { PermissionsFlow } from '../../flows/permissions.flow';
import { MetadataDialog } from '../../dialogs/metadata.dialog';
import { PermissionsDialog } from '../../dialogs/permissions.dialog';
import { DashboardPage } from '../../pages/dashboard.page';
import { NotePage } from '../../pages/note-page.page';

test.describe.serial('Child Entity CRUD', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let tmFlow: ThreatModelFlow;
  let dashboard: DashboardPage;

  const testTmName = `E2E Entity CRUD TM ${Date.now()}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    tmFlow = new ThreatModelFlow(page);
    dashboard = new DashboardPage(page);

    await new AuthFlow(page).loginAs('test-user');
    await tmFlow.createFromDashboard(testTmName);
  });

  test.afterAll(async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    try {
      await tmFlow.deleteFromDashboard(testTmName);
      await expect(dashboard.tmCard(testTmName)).toHaveCount(0, { timeout: 10000 });
    } catch {
      /* best effort */
    }
    await context.close();
  });

  test('asset CRUD', async () => {
    const assetFlow = new AssetFlow(page);
    const assetName = `E2E Asset ${Date.now()}`;
    const updatedName = `${assetName} Updated`;

    await assetFlow.createFromTmEdit({
      name: assetName,
      type: 'data',
      criticality: 'high',
      classification: ['confidential', 'pii'],
      sensitivity: 'high',
    });
    await expect(page.getByTestId('asset-row').filter({ hasText: assetName })).toBeVisible({
      timeout: 10000,
    });

    await assetFlow.editFromTmEdit(assetName, { name: updatedName });
    await expect(page.getByTestId('asset-row').filter({ hasText: updatedName })).toBeVisible({
      timeout: 10000,
    });

    await assetFlow.deleteFromTmEdit(updatedName);
    await expect(page.getByTestId('asset-row').filter({ hasText: updatedName })).toHaveCount(0, {
      timeout: 10000,
    });
  });

  test('document CRUD', async () => {
    const docFlow = new DocumentFlow(page);
    const docName = `E2E Doc ${Date.now()}`;

    await docFlow.createFromTmEdit({
      name: docName,
      uri: 'https://example.com/doc.pdf',
      description: 'Test document',
    });
    await expect(page.getByTestId('document-row').filter({ hasText: docName })).toBeVisible({
      timeout: 10000,
    });

    await docFlow.editFromTmEdit(docName, { description: 'Updated description' });

    await docFlow.deleteFromTmEdit(docName);
    await expect(page.getByTestId('document-row').filter({ hasText: docName })).toHaveCount(0, {
      timeout: 10000,
    });
  });

  test('repository CRUD', async () => {
    const repoFlow = new RepositoryFlow(page);
    const repoName = `E2E Repo ${Date.now()}`;

    await repoFlow.createFromTmEdit({
      name: repoName,
      type: 'Git',
      uri: 'https://github.com/example/repo',
      refType: 'branch',
      refValue: 'main',
      subPath: 'src/',
    });
    await expect(page.getByTestId('repository-row').filter({ hasText: repoName })).toBeVisible({
      timeout: 10000,
    });

    await repoFlow.editFromTmEdit(repoName, { refValue: 'develop' });

    await repoFlow.deleteFromTmEdit(repoName);
    await expect(page.getByTestId('repository-row').filter({ hasText: repoName })).toHaveCount(0, {
      timeout: 10000,
    });
  });

  test('note CRUD', async () => {
    const noteFlow = new NoteFlow(page);
    const notePage = new NotePage(page);
    const noteName = `E2E Note ${Date.now()}`;

    // Create note via dialog (stays on TM edit page)
    await noteFlow.createFromTmEdit(noteName);
    await expect(page.getByTestId('note-row').filter({ hasText: noteName })).toBeVisible({
      timeout: 10000,
    });

    // Open note to navigate to full note page
    await noteFlow.openFromTmEdit(noteName);
    await expect(notePage.nameInput()).toHaveValue(noteName, { timeout: 10000 });

    // Wait for the API save response to confirm persistence
    const saveResponse = page.waitForResponse(
      resp => resp.url().includes('/notes/') && resp.request().method() === 'PUT',
    );
    await noteFlow.editNote({
      description: 'Test note description',
      content: '## Test Content\n\nSome markdown here.',
    });
    await saveResponse;

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(notePage.descriptionInput()).toHaveValue('Test note description', {
      timeout: 10000,
    });

    await noteFlow.closeNote();
    await expect(page.getByTestId('note-row').filter({ hasText: noteName })).toBeVisible({
      timeout: 10000,
    });

    await noteFlow.openFromTmEdit(noteName);
    await noteFlow.deleteNote();
    await page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
    await expect(page.getByTestId('note-row').filter({ hasText: noteName })).toHaveCount(0, {
      timeout: 10000,
    });
  });

  test('metadata CRUD', async () => {
    const metadataFlow = new MetadataFlow(page);
    const metadataDialog = new MetadataDialog(page);

    // tm-metadata-button is a standalone action button — click directly.
    await page.getByTestId('tm-metadata-button').click();
    await page.locator('mat-dialog-container').waitFor({ state: 'visible', timeout: 5000 });

    await metadataFlow.addEntry('test-key', 'test-value');
    await metadataFlow.saveAndClose();
    await page.waitForLoadState('networkidle');

    await page.getByTestId('tm-metadata-button').click();
    await page.locator('mat-dialog-container').waitFor({ state: 'visible', timeout: 5000 });
    await expect(metadataDialog.keyInputs().last()).toHaveValue('test-key', { timeout: 10000 });
    await expect(metadataDialog.valueInputs().last()).toHaveValue('test-value');

    const lastIndex = (await metadataDialog.valueInputs().count()) - 1;
    await metadataFlow.editEntry(lastIndex, undefined, 'updated-value');
    await metadataFlow.saveAndClose();

    await page.getByTestId('tm-metadata-button').click();
    await expect(metadataDialog.valueInputs().last()).toHaveValue('updated-value', {
      timeout: 5000,
    });

    const deleteIndex = (await metadataDialog.deleteButtons().count()) - 1;
    await metadataFlow.deleteEntry(deleteIndex);
    await metadataFlow.saveAndClose();
  });

  test('permissions CRUD', async () => {
    const permissionsFlow = new PermissionsFlow(page);
    const permissionsDialog = new PermissionsDialog(page);

    // tm-permissions-button is inside the detailsKebabMenu (mat-menu).
    // Locate the kebab trigger by scoping to .details-card and matching the more_vert icon.
    const kebabButton = page
      .locator('.details-card .action-buttons button')
      .filter({ has: page.locator('mat-icon:text("more_vert")') });

    await kebabButton.click();
    await page.getByTestId('tm-permissions-button').waitFor({ state: 'visible' });
    await page.getByTestId('tm-permissions-button').click();

    const initialCount = await permissionsDialog.rows().count();

    await permissionsFlow.addPermission('user', 'TMI Provider', 'test-reviewer', 'reader');
    await permissionsFlow.saveAndClose();

    await kebabButton.click();
    await page.getByTestId('tm-permissions-button').waitFor({ state: 'visible' });
    await page.getByTestId('tm-permissions-button').click();
    await expect(permissionsDialog.rows()).toHaveCount(initialCount + 1, { timeout: 5000 });

    const lastIndex = (await permissionsDialog.deleteButtons().count()) - 1;
    await permissionsFlow.deletePermission(lastIndex);
    await permissionsFlow.saveAndClose();
  });
});
