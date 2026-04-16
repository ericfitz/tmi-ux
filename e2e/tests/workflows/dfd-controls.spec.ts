import { expect, BrowserContext, Page } from '@playwright/test';
import { test } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DiagramFlow } from '../../flows/diagram.flow';
import { DashboardPage } from '../../pages/dashboard.page';
import { DfdEditorPage } from '../../pages/dfd-editor.page';

/**
 * DFD editor controls integration test.
 *
 * Verifies that all toolbar controls render and function correctly:
 * node creation buttons, panel toggles, export menu, help dialog,
 * developer tool dialogs, undo/redo states, zoom-to-fit, delete, and save.
 *
 * Creates a fresh TM and diagram in beforeAll, cleans up in afterAll.
 * Tests run serially and share a single browser context.
 */
test.describe.serial('DFD Editor Controls', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  let threatModelFlow: ThreatModelFlow;
  let diagramFlow: DiagramFlow;
  let dashboardPage: DashboardPage;
  let dfdEditorPage: DfdEditorPage;

  const testTmName = `E2E DFD Controls TM ${Date.now()}`;
  const testDiagramName = `E2E DFD Controls Diagram ${Date.now()}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(90000);
    context = await browser.newContext();
    page = await context.newPage();

    await new AuthFlow(page).loginAs('test-reviewer');

    threatModelFlow = new ThreatModelFlow(page);
    diagramFlow = new DiagramFlow(page);
    dashboardPage = new DashboardPage(page);
    dfdEditorPage = new DfdEditorPage(page);

    // Create a fresh TM and diagram, then open the DFD editor
    await threatModelFlow.createFromDashboard(testTmName);
    await diagramFlow.createFromTmEdit(testDiagramName);
    await diagramFlow.openFromTmEdit(testDiagramName);
    await expect(dfdEditorPage.graphContainer()).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(async () => {
    // Clean up: navigate to dashboard and delete the TM
    try {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await threatModelFlow.deleteFromDashboard(testTmName);
      await expect(dashboardPage.tmCard(testTmName)).toHaveCount(0, { timeout: 10000 });
    } catch {
      // Best effort cleanup
    }
    await context.close();
  });

  test('add actor node via toolbar', async () => {
    await expect(dfdEditorPage.addActorButton()).toBeEnabled({ timeout: 15000 });
    const before = await dfdEditorPage.getNodeCount();
    await dfdEditorPage.addActorButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(before + 1, { timeout: 5000 });

    // Verify the new node has the correct shape
    const nodes = await dfdEditorPage.getNodes();
    const actorNodes = nodes.filter(n => n.shape === 'actor');
    expect(actorNodes.length).toBeGreaterThanOrEqual(1);
  });

  test('add process node via toolbar', async () => {
    const before = await dfdEditorPage.getNodeCount();
    await dfdEditorPage.addProcessButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(before + 1, { timeout: 5000 });

    const nodes = await dfdEditorPage.getNodes();
    const processNodes = nodes.filter(n => n.shape === 'process');
    expect(processNodes.length).toBeGreaterThanOrEqual(1);
  });

  test('add store node via toolbar', async () => {
    const before = await dfdEditorPage.getNodeCount();
    await dfdEditorPage.addStoreButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(before + 1, { timeout: 5000 });

    const nodes = await dfdEditorPage.getNodes();
    const storeNodes = nodes.filter(n => n.shape === 'store');
    expect(storeNodes.length).toBeGreaterThanOrEqual(1);
  });

  test('add security boundary node via toolbar', async () => {
    const before = await dfdEditorPage.getNodeCount();
    await dfdEditorPage.addSecurityBoundaryButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(before + 1, { timeout: 5000 });

    const nodes = await dfdEditorPage.getNodes();
    const boundaryNodes = nodes.filter(n => n.shape === 'security-boundary');
    expect(boundaryNodes.length).toBeGreaterThanOrEqual(1);
  });

  test('add text box node via toolbar', async () => {
    const before = await dfdEditorPage.getNodeCount();
    await dfdEditorPage.addTextBoxButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(before + 1, { timeout: 5000 });

    const nodes = await dfdEditorPage.getNodes();
    const textBoxNodes = nodes.filter(n => n.shape === 'text-box');
    expect(textBoxNodes.length).toBeGreaterThanOrEqual(1);
  });

  test('style panel toggle opens and closes', async () => {
    // Open style panel
    await dfdEditorPage.stylePanelToggle().click();
    await expect(dfdEditorPage.stylePanel()).toBeVisible({ timeout: 5000 });

    // Close style panel
    await dfdEditorPage.stylePanelToggle().click();
    await expect(dfdEditorPage.stylePanel()).toBeHidden({ timeout: 5000 });
  });

  test('icon picker toggle opens and closes', async () => {
    // Open icon picker
    await dfdEditorPage.iconPickerToggle().click();
    await expect(dfdEditorPage.iconPickerPanel()).toBeVisible({ timeout: 5000 });

    // Close icon picker
    await dfdEditorPage.iconPickerToggle().click();
    await expect(dfdEditorPage.iconPickerPanel()).toBeHidden({ timeout: 5000 });
  });

  test('export menu shows SVG, PNG, and JPEG options', async () => {
    await dfdEditorPage.exportMenuButton().click();

    await expect(dfdEditorPage.exportSvgOption()).toBeVisible({ timeout: 5000 });
    await expect(dfdEditorPage.exportPngOption()).toBeVisible();
    await expect(dfdEditorPage.exportJpegOption()).toBeVisible();

    // Close the menu by pressing Escape
    await page.keyboard.press('Escape');
  });

  test('help dialog opens, shows content, and closes', async () => {
    await dfdEditorPage.helpButton().click();

    // The help dialog should be visible with dialog content
    const dialogContent = page.locator('mat-dialog-container');
    await expect(dialogContent).toBeVisible({ timeout: 5000 });

    // Verify the dialog has animation labels (pan and zoom help content)
    const animationLabels = page.locator('.animation-label');
    await expect(animationLabels).toHaveCount(2, { timeout: 5000 });

    // Close the dialog via the close button
    const closeButton = page
      .locator('mat-dialog-container')
      .locator('button')
      .filter({ hasText: /close/i });
    await closeButton.click();
    await expect(dialogContent).toBeHidden({ timeout: 5000 });
  });

  test('developer tool buttons conditionally visible', async () => {
    // Dev tools visibility depends on user preferences (showDeveloperTools)
    // Check if any of the dev tool buttons are visible
    const graphDataVisible = await dfdEditorPage.showGraphDataButton().isVisible();
    const historyVisible = await dfdEditorPage.showHistoryButton().isVisible();
    const clipboardVisible = await dfdEditorPage.showClipboardButton().isVisible();

    // All three should have the same visibility state (controlled by single preference)
    expect(graphDataVisible).toBe(historyVisible);
    expect(historyVisible).toBe(clipboardVisible);

    // If visible, verify they open and close dialogs
    if (graphDataVisible) {
      await dfdEditorPage.showGraphDataButton().click();
      const dialog = page.locator('mat-dialog-container');
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 5000 });

      await dfdEditorPage.showHistoryButton().click();
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 5000 });

      await dfdEditorPage.showClipboardButton().click();
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 5000 });
    }
  });

  test('undo and redo button enabled/disabled states', async () => {
    // Prior tests added nodes, so undo should be available
    expect(await dfdEditorPage.canUndo()).toBe(true);
    await expect(dfdEditorPage.undoButton()).toBeEnabled();

    // Add one more node to have a clear undo target
    const countBefore = await dfdEditorPage.getNodeCount();
    await expect(dfdEditorPage.addActorButton()).toBeEnabled({ timeout: 5000 });
    await dfdEditorPage.addActorButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(countBefore + 1, { timeout: 10000 });

    // Undo
    await dfdEditorPage.undoButton().click();
    await dfdEditorPage.waitForGraphSettled(countBefore, 10000);

    // Redo should now be available
    expect(await dfdEditorPage.canRedo()).toBe(true);
    await expect(dfdEditorPage.redoButton()).toBeEnabled();

    // Redo to restore
    await dfdEditorPage.redoButton().click();
    await dfdEditorPage.waitForGraphSettled(countBefore + 1, 10000);
  });

  test('zoom-to-fit does not crash', async () => {
    const nodeCountBefore = await dfdEditorPage.getNodeCount();
    await dfdEditorPage.zoomToFitButton().click();

    // Verify no crash: node count should be unchanged
    const nodeCountAfter = await dfdEditorPage.getNodeCount();
    expect(nodeCountAfter).toBe(nodeCountBefore);
  });

  test('select all and delete removes all nodes', async () => {
    // Ensure we have some nodes to delete
    const nodeCountBefore = await dfdEditorPage.getNodeCount();
    expect(nodeCountBefore).toBeGreaterThan(0);

    // Select all and delete
    await dfdEditorPage.selectAllViaOrchestrator();
    await dfdEditorPage.deleteButton().click();

    await dfdEditorPage.waitForGraphSettled(0, 10000);
    const nodeCountAfter = await dfdEditorPage.getNodeCount();
    expect(nodeCountAfter).toBe(0);
  });

  test('save button does not produce an error', async () => {
    // Add a node so there is something to save
    await dfdEditorPage.addProcessButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(1, { timeout: 5000 });

    // Click save and verify no error dialog appears
    await dfdEditorPage.saveButton().click();

    // Wait briefly for any save operation to complete
    await page.waitForTimeout(2000);

    // No error dialog should be present
    const errorDialog = page.locator('mat-dialog-container .error');
    await expect(errorDialog).toHaveCount(0);
  });
});
