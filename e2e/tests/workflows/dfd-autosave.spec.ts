import { expect, BrowserContext, Page } from '@playwright/test';
import { test } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DiagramFlow } from '../../flows/diagram.flow';
import { DashboardPage } from '../../pages/dashboard.page';
import { DfdEditorPage } from '../../pages/dfd-editor.page';

/**
 * DFD editor auto-save persistence test.
 *
 * Verifies that diagram changes persist across page reloads:
 * - Add nodes via toolbar
 * - Wait for auto-save (poll hasUnsavedChanges) or trigger manual save
 * - Reload the page
 * - Verify nodes are still present after reload
 *
 * Creates a fresh TM and diagram in beforeAll, cleans up in afterAll.
 * Tests run serially and share a single browser context.
 */
test.describe.serial('DFD Editor Auto-Save', () => {
  test.setTimeout(90000);

  let context: BrowserContext;
  let page: Page;

  let threatModelFlow: ThreatModelFlow;
  let diagramFlow: DiagramFlow;
  let dashboardPage: DashboardPage;
  let dfdEditorPage: DfdEditorPage;

  const testTmName = `E2E DFD Autosave TM ${Date.now()}`;
  const testDiagramName = `E2E DFD Autosave Diagram ${Date.now()}`;
  let diagramUrl: string;

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

    // Capture the diagram URL for reloading
    diagramUrl = page.url();
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

  test('nodes persist across page reload after save', async () => {
    // Add 3 nodes via toolbar
    await dfdEditorPage.addActorButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(1, { timeout: 5000 });

    await dfdEditorPage.addProcessButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(2, { timeout: 5000 });

    await dfdEditorPage.addStoreButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(3, { timeout: 5000 });

    // Ensure all 3 nodes are registered in the graph before saving
    expect(await dfdEditorPage.getNodeCount()).toBe(3);

    // Manually save to ensure all nodes are persisted reliably
    await dfdEditorPage.saveButton().click();
    await page.waitForTimeout(3000);

    // Verify save completed (no unsaved changes)
    try {
      await page.waitForFunction(
        () => {
          const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
          return orchestrator ? !orchestrator.getState().hasUnsavedChanges : false;
        },
        { timeout: 10000, polling: 500 },
      );
    } catch {
      // If still showing unsaved changes, save again
      await dfdEditorPage.saveButton().click();
      await page.waitForTimeout(3000);
    }

    // Reload the page and wait for the DFD editor to re-initialize
    await page.goto(diagramUrl);
    await page.waitForLoadState('networkidle');
    await expect(dfdEditorPage.graphContainer()).toBeVisible({ timeout: 15000 });

    // Wait for the graph to finish loading nodes
    await dfdEditorPage.waitForGraphSettled(3, 15000);

    // Verify all 3 nodes persisted
    const nodeCount = await dfdEditorPage.getNodeCount();
    expect(nodeCount).toBe(3);

    // Verify node types are correct
    const nodes = await dfdEditorPage.getNodes();
    const shapes = nodes.map(n => n.shape).sort();
    expect(shapes).toContain('actor');
    expect(shapes).toContain('process');
    expect(shapes).toContain('store');
  });

  test('style changes persist through auto-save and reload', async () => {
    // Add a process so we have a node to style
    await dfdEditorPage.addProcessButton().click();
    await dfdEditorPage.waitForGraphSettled(4);

    // Change fill color via X6 API on a specific node, mark as custom styles,
    // and flip the unsaved-changes flag so the save button actually persists.
    const targetId = await page.evaluate(() => {
      const graph = (window as any).__e2e?.dfd?.graph;
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (!graph) return null;
      const nodes = graph.getNodes();
      if (!nodes.length) return null;
      const node = nodes[0];
      node.setAttrByPath('body/fill', '#00ff00');
      const prevData = node.getData?.() ?? {};
      node.setData({ ...prevData, customStyles: true });
      if (orchestrator && !orchestrator.getState().hasUnsavedChanges) {
        orchestrator._markUnsavedChanges?.();
      }
      return node.id as string;
    });
    expect(targetId).toBeTruthy();

    await dfdEditorPage.saveButton().click();
    await page.waitForTimeout(3000);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(dfdEditorPage.graphContainer()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    const result = await page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      if (!graph) return null;
      const node = graph.getCellById(id);
      if (!node) return { missing: true };
      return {
        fill: node.getAttrByPath('body/fill') || null,
        customStyles: !!node.getData?.()?.customStyles,
      };
    }, targetId);

    expect(result).not.toBeNull();
    expect((result as any).missing).toBeFalsy();
    expect((result as any).customStyles).toBe(true);
    expect((result as any).fill).toBe('#00ff00');
  });
});
