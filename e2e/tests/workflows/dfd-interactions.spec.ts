import { expect, BrowserContext, Page } from '@playwright/test';
import { test } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DiagramFlow } from '../../flows/diagram.flow';
import { DashboardPage } from '../../pages/dashboard.page';
import { DfdEditorPage } from '../../pages/dfd-editor.page';

/**
 * DFD editor interaction workflow tests.
 *
 * Tests user interaction workflows including:
 * - Node lifecycle: add each type via toolbar, verify shape, select, move, clean up
 * - Edge lifecycle: add nodes and edge, verify, clean up
 * - Embedding: add boundary + child, embed, verify, unembed, verify
 * - Multi-select and delete with undo
 * - Node move and resize via orchestrator (X6 drags cannot be simulated from Playwright)
 *
 * Creates a fresh TM and diagram in beforeAll, cleans up in afterAll.
 * Tests run serially and share a single browser context.
 */
test.describe.serial('DFD Editor Interactions', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  let threatModelFlow: ThreatModelFlow;
  let diagramFlow: DiagramFlow;
  let dashboardPage: DashboardPage;
  let dfdEditorPage: DfdEditorPage;

  const testTmName = `E2E DFD Interactions TM ${Date.now()}`;
  const testDiagramName = `E2E DFD Interactions Diagram ${Date.now()}`;

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

  for (const nodeType of ['actor', 'process', 'store', 'security-boundary', 'text-box'] as const) {
    test(`node lifecycle: add ${nodeType}, verify shape, select`, async () => {
      const before = await dfdEditorPage.getNodeCount();
      await dfdEditorPage.nodeButton(nodeType).click();
      await expect(dfdEditorPage.nodes()).toHaveCount(before + 1, { timeout: 5000 });

      // Verify the new node has the correct shape
      const nodes = await dfdEditorPage.getNodes();
      const matchingNodes = nodes.filter(n => n.shape === nodeType);
      expect(matchingNodes.length).toBeGreaterThanOrEqual(1);

      // Clean up: select all and delete, then verify empty
      await dfdEditorPage.selectAllViaOrchestrator();
      await dfdEditorPage.deleteSelectedViaOrchestrator();
      await dfdEditorPage.waitForGraphSettled(0, 5000);
    });
  }

  test('edge lifecycle: add nodes, add edge, verify, clean up', async () => {
    // Add two nodes via orchestrator for precise ID tracking
    const sourceId = await dfdEditorPage.addNodeViaOrchestrator('actor');
    expect(sourceId).toBeTruthy();
    await expect(dfdEditorPage.nodes()).toHaveCount(1, { timeout: 5000 });

    const targetId = await dfdEditorPage.addNodeViaOrchestrator('process');
    expect(targetId).toBeTruthy();
    await expect(dfdEditorPage.nodes()).toHaveCount(2, { timeout: 5000 });

    // Setup: create edge directly via X6 graph API — the orchestrator doesn't expose
    // a direct edge creation method (edges are created via port interactions in the UI)
    await page.evaluate(
      ({ src, tgt }) => {
        const graph = (window as any).__e2e?.dfd?.graph;
        if (!graph) throw new Error('Graph not available');
        graph.addEdge({
          source: { cell: src },
          target: { cell: tgt },
        });
      },
      { src: sourceId, tgt: targetId },
    );

    // Verify edge exists
    const edgeCount = await dfdEditorPage.getEdgeCount();
    expect(edgeCount).toBe(1);

    const edges = await dfdEditorPage.getEdges();
    expect(edges[0].sourceId).toBe(sourceId);
    expect(edges[0].targetId).toBe(targetId);

    // Clean up
    await dfdEditorPage.selectAllViaOrchestrator();
    await dfdEditorPage.deleteSelectedViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(0, 5000);
  });

  test('embedding: embed child in parent, verify parentId, unembed', async () => {
    // Add a security boundary (parent) and a process (child)
    const parentId = await dfdEditorPage.addNodeViaOrchestrator('security-boundary');
    expect(parentId).toBeTruthy();

    const childId = await dfdEditorPage.addNodeViaOrchestrator('process');
    expect(childId).toBeTruthy();

    await expect(dfdEditorPage.nodes()).toHaveCount(2, { timeout: 5000 });

    // Embed via graph API: parent.addChild(child)
    await page.evaluate(
      ({ pid, cid }) => {
        const graph = (window as any).__e2e?.dfd?.graph;
        if (!graph) throw new Error('Graph not available');
        const parent = graph.getCellById(pid);
        const child = graph.getCellById(cid);
        if (!parent || !child) throw new Error('Cells not found');
        parent.addChild(child);
      },
      { pid: parentId, cid: childId },
    );

    // Verify child has the correct parentId
    const childNode = await dfdEditorPage.getNodeById(childId);
    expect(childNode).not.toBeNull();
    expect(childNode!.parentId).toBe(parentId);

    // Verify embedded children list
    const children = await dfdEditorPage.getEmbeddedChildren(parentId);
    expect(children).toContain(childId);

    // Unembed via graph API (use unembed, not removeChild which may remove from graph)
    await page.evaluate(
      ({ pid, cid }) => {
        const graph = (window as any).__e2e?.dfd?.graph;
        if (!graph) throw new Error('Graph not available');
        const parent = graph.getCellById(pid);
        const child = graph.getCellById(cid);
        if (!parent || !child) throw new Error('Cells not found');
        parent.unembed(child);
      },
      { pid: parentId, cid: childId },
    );

    // Verify child no longer has a parent
    const childAfter = await dfdEditorPage.getNodeById(childId);
    expect(childAfter).not.toBeNull();
    expect(childAfter!.parentId).toBeNull();

    // Clean up
    await dfdEditorPage.selectAllViaOrchestrator();
    await dfdEditorPage.deleteSelectedViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(0, 5000);
  });

  test('multi-select and delete removes all nodes', async () => {
    // Add 3 nodes via toolbar
    await dfdEditorPage.addActorButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(1, { timeout: 5000 });

    await dfdEditorPage.addProcessButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(2, { timeout: 5000 });

    await dfdEditorPage.addStoreButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(3, { timeout: 5000 });

    // Select all and delete
    await dfdEditorPage.selectAllViaOrchestrator();
    await dfdEditorPage.deleteSelectedViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(0, 10000);

    const countAfterDelete = await dfdEditorPage.getNodeCount();
    expect(countAfterDelete).toBe(0);
  });

  test('node move updates position via orchestrator', async () => {
    // We cannot drive an X6-recognizable drag from Playwright (see
    // moveNodeViaOrchestrator). This test drives the same UpdateNodeOperation
    // that a real drag produces and verifies the resulting model state.
    const nodeId = await dfdEditorPage.addNodeViaOrchestrator('process');
    expect(nodeId).toBeTruthy();
    await expect(dfdEditorPage.nodes()).toHaveCount(1, { timeout: 5000 });

    const nodeBefore = await dfdEditorPage.getNodeById(nodeId);
    expect(nodeBefore).not.toBeNull();
    const initialX = nodeBefore!.x;
    const initialY = nodeBefore!.y;

    const deltaX = 100;
    const deltaY = 50;
    await dfdEditorPage.moveNodeViaOrchestrator(nodeId, {
      x: initialX + deltaX,
      y: initialY + deltaY,
    });

    const nodeAfter = await dfdEditorPage.getNodeById(nodeId);
    expect(nodeAfter).not.toBeNull();
    expect(nodeAfter!.x).toBe(initialX + deltaX);
    expect(nodeAfter!.y).toBe(initialY + deltaY);

    // Clean up
    await dfdEditorPage.selectAllViaOrchestrator();
    await dfdEditorPage.deleteSelectedViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(0, 5000);
  });

  test('node resize updates dimensions via orchestrator', async () => {
    // X6 resize-handle drags cannot be simulated from Playwright (see
    // resizeNodeViaOrchestrator). This test drives the same UpdateNodeOperation
    // that a real handle drag produces and verifies the resulting model state.
    const nodeId = await dfdEditorPage.addNodeViaOrchestrator('process');
    await dfdEditorPage.waitForGraphSettled(1);

    const nodeBefore = await dfdEditorPage.getNodeById(nodeId);
    expect(nodeBefore).not.toBeNull();

    const newWidth = nodeBefore!.width + 50;
    const newHeight = nodeBefore!.height + 30;
    await dfdEditorPage.resizeNodeViaOrchestrator(nodeId, {
      width: newWidth,
      height: newHeight,
    });

    const nodeAfter = await dfdEditorPage.getNodeById(nodeId);
    expect(nodeAfter).not.toBeNull();
    expect(nodeAfter!.width).toBe(newWidth);
    expect(nodeAfter!.height).toBe(newHeight);

    // Clean up
    await dfdEditorPage.selectAllViaOrchestrator();
    await dfdEditorPage.deleteSelectedViaOrchestrator();
  });
});
