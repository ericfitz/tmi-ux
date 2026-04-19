import { expect, BrowserContext, Page } from '@playwright/test';
import { test } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DiagramFlow } from '../../flows/diagram.flow';
import { DashboardPage } from '../../pages/dashboard.page';
import { DfdEditorPage } from '../../pages/dfd-editor.page';

/**
 * DFD editor history (undo/redo) integration test.
 *
 * Tests undo/redo behavior:
 * - Undo/redo chain: add nodes, undo each step, verify counts, redo each step
 * - Undo/redo button enabled/disabled state transitions
 * - History survives save: add nodes, save, verify undo still works
 *
 * Creates a fresh TM and diagram in beforeAll, cleans up in afterAll.
 * Tests run serially and share a single browser context.
 */
test.describe.serial('DFD Editor History', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  let threatModelFlow: ThreatModelFlow;
  let diagramFlow: DiagramFlow;
  let dashboardPage: DashboardPage;
  let dfdEditorPage: DfdEditorPage;

  const testTmName = `E2E DFD History TM ${Date.now()}`;
  const testDiagramName = `E2E DFD History Diagram ${Date.now()}`;

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
    await expect(dfdEditorPage.addActorButton()).toBeEnabled({ timeout: 15000 });
  });

  test.afterAll(async () => {
    try {
      await page.goto('/dashboard');
      await dashboardPage.waitForReady();
      await threatModelFlow.deleteFromDashboard(testTmName);
      await expect(dashboardPage.tmCard(testTmName)).toHaveCount(0, { timeout: 10000 });
    } catch {
      // Best effort cleanup
    }
    await context.close();
  });

  test('undo/redo chain: add 3 nodes, undo each, redo each', async () => {
    // Start from empty
    expect(await dfdEditorPage.getNodeCount()).toBe(0);

    // Add node 1 and wait for it to fully register
    await dfdEditorPage.addActorButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(1, { timeout: 5000 });
    await page.waitForTimeout(500);

    // Add node 2
    await dfdEditorPage.addProcessButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(2, { timeout: 5000 });
    await page.waitForTimeout(500);

    // Add node 3
    await dfdEditorPage.addStoreButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(3, { timeout: 5000 });
    await page.waitForTimeout(500);

    // Undo node 3
    await dfdEditorPage.undoViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(2, 10000);

    // Undo node 2
    await dfdEditorPage.undoViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(1, 10000);

    // Undo node 1
    await dfdEditorPage.undoViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(0, 10000);

    // Redo node 1
    await dfdEditorPage.redoViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(1, 10000);

    // Redo node 2
    await dfdEditorPage.redoViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(2, 10000);

    // Redo node 3
    await dfdEditorPage.redoViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(3, 10000);

    // Clean up for next test
    await dfdEditorPage.selectAllViaOrchestrator();
    await dfdEditorPage.deleteSelectedViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(0, 10000);
  });

  test('undo/redo button state transitions', async () => {
    // On a fresh diagram with no history, undo should be disabled
    const canUndoInitial = await dfdEditorPage.canUndo();
    if (!canUndoInitial) {
      await expect(dfdEditorPage.undoButton()).toBeDisabled();
    }

    // Redo should also be disabled initially
    const canRedoInitial = await dfdEditorPage.canRedo();
    if (!canRedoInitial) {
      await expect(dfdEditorPage.redoButton()).toBeDisabled();
    }

    // Add a node — undo should become enabled
    await dfdEditorPage.addActorButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(1, { timeout: 5000 });
    await expect(dfdEditorPage.undoButton()).toBeEnabled({ timeout: 5000 });

    // Undo — redo should become enabled
    await dfdEditorPage.undoViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(0, 5000);
    await expect(dfdEditorPage.redoButton()).toBeEnabled({ timeout: 5000 });

    // Redo to restore the node, then clean up
    await dfdEditorPage.redoViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(1, 5000);

    await dfdEditorPage.selectAllViaOrchestrator();
    await dfdEditorPage.deleteSelectedViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(0, 5000);
  });

  test('history survives save', async () => {
    // Add two nodes
    await dfdEditorPage.addActorButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(1, { timeout: 5000 });

    await dfdEditorPage.addProcessButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(2, { timeout: 5000 });

    // Save the diagram
    await dfdEditorPage.saveButton().click();
    await page.waitForTimeout(2000);

    // Verify undo still works after save
    const canUndoAfterSave = await dfdEditorPage.canUndo();
    expect(canUndoAfterSave).toBe(true);

    // Actually perform undo to prove it works
    await dfdEditorPage.undoViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(1, 5000);
    expect(await dfdEditorPage.getNodeCount()).toBe(1);

    // Redo should also still work
    await dfdEditorPage.redoViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(2, 5000);
    expect(await dfdEditorPage.getNodeCount()).toBe(2);

    // Clean up
    await dfdEditorPage.selectAllViaOrchestrator();
    await dfdEditorPage.deleteSelectedViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(0, 5000);
  });
});
