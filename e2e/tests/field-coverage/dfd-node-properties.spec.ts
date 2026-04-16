import { expect, BrowserContext, Page } from '@playwright/test';
import { test } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DiagramFlow } from '../../flows/diagram.flow';
import { DashboardPage } from '../../pages/dashboard.page';
import { DfdEditorPage } from '../../pages/dfd-editor.page';

/**
 * DFD Node Properties — Field Coverage Tests
 *
 * Targeted tests for node property editing through the style panel and
 * in-place label editing. Each test creates its own node, interacts
 * with it, then verifies the graph model reflects the change.
 *
 * Creates a fresh TM + diagram in beforeAll, cleans up in afterAll.
 * Tests run serially sharing a single browser context.
 */
test.describe.serial('DFD Node Properties', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  let threatModelFlow: ThreatModelFlow;
  let diagramFlow: DiagramFlow;
  let dashboardPage: DashboardPage;
  let dfdEditorPage: DfdEditorPage;

  const testTmName = `E2E Node Props TM ${Date.now()}`;
  const testDiagramName = `E2E Node Props Diagram ${Date.now()}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(90000);
    context = await browser.newContext();
    page = await context.newPage();

    await new AuthFlow(page).loginAs('test-reviewer');

    threatModelFlow = new ThreatModelFlow(page);
    diagramFlow = new DiagramFlow(page);
    dashboardPage = new DashboardPage(page);
    dfdEditorPage = new DfdEditorPage(page);

    // Create fresh TM and diagram, open the DFD editor
    await threatModelFlow.createFromDashboard(testTmName);
    await diagramFlow.createFromTmEdit(testDiagramName);
    await diagramFlow.openFromTmEdit(testDiagramName);
    await expect(dfdEditorPage.graphContainer()).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(async () => {
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

  /**
   * Helper: add a process node, wait for it to appear, and return its ID.
   */
  async function addProcessAndGetId(): Promise<string> {
    const nodeId = await dfdEditorPage.addNodeViaOrchestrator('process');
    expect(nodeId).toBeTruthy();
    return nodeId;
  }

  /**
   * Helper: select a node by ID via the graph.
   */
  async function selectNode(nodeId: string): Promise<void> {
    await page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      if (!graph) throw new Error('Graph not available');
      const cell = graph.getCellById(id);
      if (!cell) throw new Error(`Cell ${id} not found`);
      graph.cleanSelection();
      graph.select(cell);
    }, nodeId);
    // Allow Angular change detection to propagate
    await page.waitForTimeout(300);
  }

  /**
   * Helper: open the style panel if not already open.
   */
  async function ensureStylePanelOpen(): Promise<void> {
    const isVisible = await dfdEditorPage.stylePanel().isVisible();
    if (!isVisible) {
      await dfdEditorPage.stylePanelToggle().click();
      await expect(dfdEditorPage.stylePanel()).toBeVisible({ timeout: 5000 });
    }
  }

  test('label editing via double-click', async () => {
    const nodeId = await addProcessAndGetId();
    await selectNode(nodeId);

    // Double-click the node to enter edit mode
    const nodeElement = page.locator(`.x6-node[data-cell-id="${nodeId}"]`);
    await expect(nodeElement).toBeVisible({ timeout: 5000 });
    await nodeElement.dblclick();

    // Look for the X6 cell editor or contenteditable element
    const editor = page.locator('.x6-cell-editor, [contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Clear existing text and type new label
    const newLabel = `Edited Label ${Date.now()}`;
    await editor.fill('');
    await editor.pressSequentially(newLabel, { delay: 30 });

    // Click outside to commit the edit
    await dfdEditorPage.graphContainer().click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);

    // Verify the label was updated in the graph model
    const updatedNode = await dfdEditorPage.getNodeById(nodeId);
    expect(updatedNode).not.toBeNull();
    expect(updatedNode!.label).toBe(newLabel);
  });

  test('stroke color via style panel', async () => {
    const nodeId = await addProcessAndGetId();
    await selectNode(nodeId);
    await ensureStylePanelOpen();

    // The stroke tab should be visible by default (first tab)
    // Find the hex input in the style panel and set a color
    const hexInput = dfdEditorPage.stylePanel().locator('input[placeholder="#000000"]');
    await expect(hexInput).toBeVisible({ timeout: 5000 });

    // Clear and type a red color
    await hexInput.fill('');
    await hexInput.pressSequentially('#ff0000', { delay: 30 });
    await hexInput.press('Enter');
    await page.waitForTimeout(500);

    // Verify the stroke color was applied to the node's body/stroke attr
    const strokeColor = await page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      const node = graph?.getCellById(id);
      return node?.getAttrByPath('body/stroke') ?? null;
    }, nodeId);

    expect(strokeColor).toBe('#ff0000');
  });

  test('fill color via style panel', async () => {
    const nodeId = await addProcessAndGetId();
    await selectNode(nodeId);
    await ensureStylePanelOpen();

    // Click the fill tab (second tab — format_color_fill icon)
    const fillTab = dfdEditorPage.stylePanel().locator('.mat-mdc-tab').nth(1);
    await fillTab.click();
    await page.waitForTimeout(300);

    // Find the hex input and set blue color
    const hexInput = dfdEditorPage.stylePanel().locator('input[placeholder="#000000"]');
    await expect(hexInput).toBeVisible({ timeout: 5000 });

    await hexInput.fill('');
    await hexInput.pressSequentially('#0000ff', { delay: 30 });
    await hexInput.press('Enter');
    await page.waitForTimeout(500);

    // Verify the fill color
    const fillColor = await page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      const node = graph?.getCellById(id);
      return node?.getAttrByPath('body/fill') ?? null;
    }, nodeId);

    expect(fillColor).toBe('#0000ff');
  });

  test('fill opacity via style panel slider', async () => {
    const nodeId = await addProcessAndGetId();
    await selectNode(nodeId);
    await ensureStylePanelOpen();

    // Click the fill tab
    const fillTab = dfdEditorPage.stylePanel().locator('.mat-mdc-tab').nth(1);
    await fillTab.click();
    await page.waitForTimeout(300);

    // The opacity slider thumb is an input[matSliderThumb]
    const sliderInput = dfdEditorPage.stylePanel().locator('input[matSliderThumb]');
    await expect(sliderInput).toBeVisible({ timeout: 5000 });

    // Set opacity to 50 (out of 100) by filling the input directly
    await sliderInput.fill('50');
    await sliderInput.dispatchEvent('input');
    await sliderInput.dispatchEvent('change');
    await page.waitForTimeout(500);

    // Verify fill opacity on the node (should be 0.5 = 50/100)
    const fillOpacity = await page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      const node = graph?.getCellById(id);
      return node?.getAttrByPath('body/fillOpacity') ?? null;
    }, nodeId);

    expect(fillOpacity).toBe(0.5);
  });

  test('label position via style panel grid', async () => {
    const nodeId = await addProcessAndGetId();
    await selectNode(nodeId);
    await ensureStylePanelOpen();

    // Click the label position tab (third tab — "title" icon)
    const labelTab = dfdEditorPage.stylePanel().locator('.mat-mdc-tab').nth(2);
    await labelTab.click();
    await page.waitForTimeout(300);

    // The label position grid has 9 cells (3x3). Click the top-left cell.
    const positionCells = dfdEditorPage.stylePanel().locator('.label-position-cell');
    await expect(positionCells).toHaveCount(9, { timeout: 5000 });

    // First cell = top-left
    await positionCells.first().click();
    await page.waitForTimeout(500);

    // Verify the position cell became active
    await expect(positionCells.first()).toHaveClass(/active/);

    // Verify via the graph model that text refX/refY changed
    const textAttrs = await page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      const node = graph?.getCellById(id);
      const textAttr = node?.getAttrs()?.['text'] ?? {};
      return {
        refX: textAttr.refX ?? textAttr['ref-x'] ?? null,
        refY: textAttr.refY ?? textAttr['ref-y'] ?? null,
        textAnchor: textAttr.textAnchor ?? textAttr['text-anchor'] ?? null,
      };
    }, nodeId);

    // Top-left position should result in start text-anchor
    expect(textAttrs.textAnchor).toBe('start');
  });
});
