import { expect, BrowserContext, Page } from '@playwright/test';
import { test } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { DiagramFlow } from '../../flows/diagram.flow';
import { DashboardPage } from '../../pages/dashboard.page';
import { TmEditPage } from '../../pages/tm-edit.page';
import { DfdEditorPage } from '../../pages/dfd-editor.page';

const SEEDED_TM = 'Seed TM - Full Fields';

/**
 * Pre-seeded diagram verification tests.
 *
 * Verifies that seeded diagrams load correctly with the expected
 * node counts, edge counts, node types, labels, and embedding hierarchy.
 *
 * Uses the "Seed TM - Full Fields" threat model which contains:
 * - "Simple DFD": 3 nodes (actor, process, store), 2 edges
 * - "Complex DFD": 10 nodes (2 actors, 4 processes, 3 stores), 10 edges,
 *   1 embedded node (Validator inside API Gateway)
 *
 * Opens each seeded diagram and validates its structure.
 * Tests run serially and share a single browser context.
 */
test.describe.serial('DFD Seeded Diagram Verification', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  let diagramFlow: DiagramFlow;
  let dashboardPage: DashboardPage;
  let tmEditPage: TmEditPage;
  let dfdEditorPage: DfdEditorPage;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();

    await new AuthFlow(page).loginAs('test-reviewer');

    diagramFlow = new DiagramFlow(page);
    dashboardPage = new DashboardPage(page);
    tmEditPage = new TmEditPage(page);
    dfdEditorPage = new DfdEditorPage(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  /** Navigate to the seeded TM edit page */
  async function openSeededTm() {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await dashboardPage.tmCard(SEEDED_TM).first().click();
    await page.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await expect(tmEditPage.tmName()).toContainText('Seed TM');
  }

  test('Complex DFD: verify node and edge counts and types', async () => {
    await openSeededTm();
    await diagramFlow.openSeededDiagram('Complex DFD');

    // Wait for all 10 nodes to load
    await dfdEditorPage.waitForGraphSettled(10, 15000);

    const nodeCount = await dfdEditorPage.getNodeCount();
    expect(nodeCount).toBe(10);

    const edgeCount = await dfdEditorPage.getEdgeCount();
    expect(edgeCount).toBe(10);

    // Verify node type counts
    const nodes = await dfdEditorPage.getNodes();
    const actorNodes = nodes.filter(n => n.shape === 'actor');
    const processNodes = nodes.filter(n => n.shape === 'process');
    const storeNodes = nodes.filter(n => n.shape === 'store');

    expect(actorNodes.length).toBe(2);
    expect(processNodes.length).toBe(4);
    expect(storeNodes.length).toBe(3);
  });

  test('Complex DFD: verify Validator is embedded in API Gateway', async () => {
    // Still on the Complex DFD from the previous test
    const nodes = await dfdEditorPage.getNodes();

    // Find the "Validator" process node (embedded child)
    const validatorNode = nodes.find(n => n.label === 'Validator');
    expect(validatorNode).toBeDefined();

    // Find the "API Gateway" process node (parent)
    const gatewayNode = nodes.find(n => n.label === 'API Gateway');
    expect(gatewayNode).toBeDefined();

    // Verify the Validator is embedded in API Gateway
    expect(validatorNode!.parentId).toBe(gatewayNode!.id);

    // Verify via getEmbeddedChildren as well
    const children = await dfdEditorPage.getEmbeddedChildren(gatewayNode!.id);
    expect(children).toContain(validatorNode!.id);
  });

  test('Complex DFD: zoom-to-fit does not crash', async () => {
    // Still on the Complex DFD
    const nodeCountBefore = await dfdEditorPage.getNodeCount();
    await dfdEditorPage.zoomToFitButton().click();

    // Verify no crash: node count should be unchanged
    await page.waitForTimeout(500);
    const nodeCountAfter = await dfdEditorPage.getNodeCount();
    expect(nodeCountAfter).toBe(nodeCountBefore);

    // Close the diagram to navigate back to TM edit page
    await diagramFlow.closeDiagram();
  });

  test('Simple DFD: verify node and edge counts', async () => {
    // We're on the TM edit page after closing the Complex DFD
    await diagramFlow.openSeededDiagram('Simple DFD');

    // Wait for all 3 nodes to load
    await dfdEditorPage.waitForGraphSettled(3, 15000);

    const nodeCount = await dfdEditorPage.getNodeCount();
    expect(nodeCount).toBe(3);

    const edgeCount = await dfdEditorPage.getEdgeCount();
    expect(edgeCount).toBe(2);
  });

  test('Simple DFD: verify node labels', async () => {
    // Still on the Simple DFD from the previous test
    const nodes = await dfdEditorPage.getNodes();

    const labels = nodes.map(n => n.label).sort();
    expect(labels).toContain('End User');
    expect(labels).toContain('Web App');
    expect(labels).toContain('Database');

    // Close the diagram
    await diagramFlow.closeDiagram();
  });
});
