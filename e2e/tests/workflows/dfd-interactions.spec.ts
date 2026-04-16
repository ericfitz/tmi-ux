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
 * - Node move via mouse drag
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
      await page.waitForLoadState('networkidle');
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

    // Unembed via graph API
    await page.evaluate(
      ({ pid, cid }) => {
        const graph = (window as any).__e2e?.dfd?.graph;
        if (!graph) throw new Error('Graph not available');
        const parent = graph.getCellById(pid);
        const child = graph.getCellById(cid);
        if (!parent || !child) throw new Error('Cells not found');
        parent.removeChild(child);
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

  test('multi-select and delete with undo restores nodes', async () => {
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
    await dfdEditorPage.waitForGraphSettled(0, 5000);

    const countAfterDelete = await dfdEditorPage.getNodeCount();
    expect(countAfterDelete).toBe(0);

    // Undo to restore nodes
    await dfdEditorPage.undoViaOrchestrator();

    // After undoing the batch delete, all 3 nodes should be restored
    await dfdEditorPage.waitForGraphSettled(3, 10000);
    const countAfterUndo = await dfdEditorPage.getNodeCount();
    expect(countAfterUndo).toBe(3);

    // Clean up
    await dfdEditorPage.selectAllViaOrchestrator();
    await dfdEditorPage.deleteSelectedViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(0, 5000);
  });

  test('node move via mouse drag changes position', async () => {
    // Add a single node
    const nodeId = await dfdEditorPage.addNodeViaOrchestrator('process');
    expect(nodeId).toBeTruthy();
    await expect(dfdEditorPage.nodes()).toHaveCount(1, { timeout: 5000 });

    // Get initial position
    const nodeBefore = await dfdEditorPage.getNodeById(nodeId);
    expect(nodeBefore).not.toBeNull();
    const initialX = nodeBefore!.x;
    const initialY = nodeBefore!.y;

    // Get the DOM bounding box of the node element
    const nodeElement = dfdEditorPage.nodes().first();
    const boundingBox = await nodeElement.boundingBox();
    expect(boundingBox).not.toBeNull();

    // Perform a mouse drag: click center of node, drag 100px right and 50px down
    const startX = boundingBox!.x + boundingBox!.width / 2;
    const startY = boundingBox!.y + boundingBox!.height / 2;
    const deltaX = 100;
    const deltaY = 50;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
    await page.mouse.up();

    // Wait for position to update
    await page.waitForTimeout(500);

    // Verify position changed
    const nodeAfter = await dfdEditorPage.getNodeById(nodeId);
    expect(nodeAfter).not.toBeNull();

    // The position should be different from the initial position
    // (exact offset depends on zoom level, so just verify it moved)
    const moved =
      Math.abs(nodeAfter!.x - initialX) > 10 || Math.abs(nodeAfter!.y - initialY) > 10;
    expect(moved).toBe(true);

    // Clean up
    await dfdEditorPage.selectAllViaOrchestrator();
    await dfdEditorPage.deleteSelectedViaOrchestrator();
    await dfdEditorPage.waitForGraphSettled(0, 5000);
  });

  test('node resize via drag handle changes dimensions', async () => {
    const nodeId = await dfdEditorPage.addNodeViaOrchestrator('process');
    await dfdEditorPage.waitForGraphSettled(1);

    const nodeBefore = await dfdEditorPage.getNodeById(nodeId);
    expect(nodeBefore).not.toBeNull();

    // Select the node to show resize handles
    await dfdEditorPage.selectNodeByIndex(0);

    // Find the node's bottom-right resize handle
    // X6 resize handles are typically positioned at the node's corners
    const nodeEl = dfdEditorPage.nodes().first();
    const box = await nodeEl.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Drag from bottom-right corner outward to resize
      const handleX = box.x + box.width;
      const handleY = box.y + box.height;
      await page.mouse.move(handleX, handleY);
      await page.mouse.down();
      await page.mouse.move(handleX + 50, handleY + 30, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);

      const nodeAfter = await dfdEditorPage.getNodeById(nodeId);
      expect(nodeAfter).not.toBeNull();
      // Dimensions should have changed (either width or height or both)
      const widthChanged = nodeAfter!.width !== nodeBefore!.width;
      const heightChanged = nodeAfter!.height !== nodeBefore!.height;
      expect(widthChanged || heightChanged).toBe(true);
    }

    // Clean up
    await dfdEditorPage.selectAllViaOrchestrator();
    await dfdEditorPage.deleteSelectedViaOrchestrator();
  });
});
