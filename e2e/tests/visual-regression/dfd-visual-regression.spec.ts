import { expect, BrowserContext, Page } from '@playwright/test';
import { test } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DiagramFlow } from '../../flows/diagram.flow';
import { DashboardPage } from '../../pages/dashboard.page';
import { DfdEditorPage } from '../../pages/dfd-editor.page';
import { TmEditPage } from '../../pages/tm-edit.page';
import { takeThemeScreenshots } from '../../helpers/screenshot';

const SEEDED_TM = 'Seed TM - Full Fields';

/**
 * DFD Visual Regression — Composite Screenshot Plates
 *
 * Each test sets up a specific visual state in the DFD editor,
 * zooms to fit, then captures theme screenshots for comparison.
 *
 * Plates 1-4 and 6 create their own TM + diagram for isolation.
 * Plate 5 uses the seeded "Complex DFD" from "Seed TM - Full Fields".
 */
test.describe('DFD Visual Regression', () => {
  test.setTimeout(90000);

  /**
   * Helper: set up an isolated browser context with a fresh TM + diagram.
   * Returns the context, page, and page objects.
   */
  async function setupFreshDiagram(browser: any): Promise<{
    context: BrowserContext;
    page: Page;
    dfdEditorPage: DfdEditorPage;
    threatModelFlow: ThreatModelFlow;
    dashboardPage: DashboardPage;
    tmName: string;
  }> {
    const context = await browser.newContext();
    const page = await context.newPage();
    await new AuthFlow(page).loginAs('test-reviewer');

    const threatModelFlow = new ThreatModelFlow(page);
    const diagramFlow = new DiagramFlow(page);
    const dashboardPage = new DashboardPage(page);
    const dfdEditorPage = new DfdEditorPage(page);

    const tmName = `E2E VR DFD ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const diagramName = `VR Diagram`;

    await threatModelFlow.createFromDashboard(tmName);
    await diagramFlow.createFromTmEdit(diagramName);
    await diagramFlow.openFromTmEdit(diagramName);
    await expect(dfdEditorPage.graphContainer()).toBeVisible({ timeout: 15000 });
    // Wait for orchestrator to be fully initialized
    await expect(dfdEditorPage.addActorButton()).toBeEnabled({ timeout: 15000 });

    return { context, page, dfdEditorPage, threatModelFlow, dashboardPage, tmName };
  }

  /**
   * Helper: clean up a fresh diagram's TM.
   */
  async function cleanupFreshDiagram(
    page: Page,
    threatModelFlow: ThreatModelFlow,
    dashboardPage: DashboardPage,
    tmName: string,
    context: BrowserContext,
  ): Promise<void> {
    try {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await threatModelFlow.deleteFromDashboard(tmName);
      await expect(dashboardPage.tmCard(tmName)).toHaveCount(0, { timeout: 10000 });
    } catch {
      // Best effort cleanup
    }
    await context.close();
  }

  test('plate 1 — node types', async ({ browser }) => {
    const { context, page, dfdEditorPage, threatModelFlow, dashboardPage, tmName } =
      await setupFreshDiagram(browser);

    try {
      // Add one of each node type
      const nodeTypes = ['actor', 'process', 'store', 'security-boundary', 'text-box'];
      for (const type of nodeTypes) {
        await dfdEditorPage.addNodeViaOrchestrator(type);
      }

      await dfdEditorPage.waitForGraphSettled(5, 10000);
      await dfdEditorPage.zoomToFitButton().click();
      await page.waitForTimeout(500);

      await takeThemeScreenshots(page, 'dfd-node-types');
    } finally {
      await cleanupFreshDiagram(page, threatModelFlow, dashboardPage, tmName, context);
    }
  });

  test('plate 2 — style variations', async ({ browser }) => {
    const { context, page, dfdEditorPage, threatModelFlow, dashboardPage, tmName } =
      await setupFreshDiagram(browser);

    try {
      // Add 5 process nodes and apply different styles to each
      const nodeIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = await dfdEditorPage.addNodeViaOrchestrator('process');
        nodeIds.push(id);
      }
      await dfdEditorPage.waitForGraphSettled(5, 10000);

      // Apply styles programmatically via the graph
      await page.evaluate((ids: string[]) => {
        const graph = (window as any).__e2e?.dfd?.graph;
        if (!graph) return;

        // Node 0: red stroke
        const n0 = graph.getCellById(ids[0]);
        if (n0) {
          n0.setAttrByPath('body/stroke', '#ff0000');
          n0.setAttrByPath('text/text', 'Red Stroke');
        }

        // Node 1: blue fill
        const n1 = graph.getCellById(ids[1]);
        if (n1) {
          n1.setAttrByPath('body/fill', '#0000ff');
          n1.setAttrByPath('text/text', 'Blue Fill');
        }

        // Node 2: semi-transparent (50% opacity)
        const n2 = graph.getCellById(ids[2]);
        if (n2) {
          n2.setAttrByPath('body/fill', '#00cc00');
          n2.setAttrByPath('body/fillOpacity', 0.5);
          n2.setAttrByPath('text/text', 'Semi-Transparent');
        }

        // Node 3: label top-left
        const n3 = graph.getCellById(ids[3]);
        if (n3) {
          n3.setAttrByPath('text/text', 'Top-Left Label');
          n3.setAttrByPath('text/refX', 0.05);
          n3.setAttrByPath('text/refY', 0.2);
          n3.setAttrByPath('text/textAnchor', 'start');
        }

        // Node 4: label bottom-right
        const n4 = graph.getCellById(ids[4]);
        if (n4) {
          n4.setAttrByPath('text/text', 'Bottom-Right Label');
          n4.setAttrByPath('text/refX', 0.95);
          n4.setAttrByPath('text/refY', 0.8);
          n4.setAttrByPath('text/textAnchor', 'end');
        }
      }, nodeIds);

      await dfdEditorPage.zoomToFitButton().click();
      await page.waitForTimeout(500);

      await takeThemeScreenshots(page, 'dfd-style-variations');
    } finally {
      await cleanupFreshDiagram(page, threatModelFlow, dashboardPage, tmName, context);
    }
  });

  test('plate 3 — edge variations', async ({ browser }) => {
    const { context, page, dfdEditorPage, threatModelFlow, dashboardPage, tmName } =
      await setupFreshDiagram(browser);

    try {
      // Build a small network with different edge types
      await page.evaluate(() => {
        const graph = (window as any).__e2e?.dfd?.graph;
        if (!graph) return;

        // Create 4 nodes
        const n1 = graph.addNode({
          shape: 'actor', x: 50, y: 200, width: 80, height: 80,
          attrs: { text: { text: 'User' } },
        });
        const n2 = graph.addNode({
          shape: 'process', x: 250, y: 100, width: 120, height: 60,
          attrs: { text: { text: 'API' } },
        });
        const n3 = graph.addNode({
          shape: 'process', x: 250, y: 300, width: 120, height: 60,
          attrs: { text: { text: 'Worker' } },
        });
        const n4 = graph.addNode({
          shape: 'store', x: 500, y: 200, width: 120, height: 60,
          attrs: { text: { text: 'Database' } },
        });

        // Labeled edge
        graph.addEdge({
          source: { cell: n1.id },
          target: { cell: n2.id },
          labels: [{ attrs: { label: { text: 'HTTP Request' } } }],
        });

        // Unlabeled edge
        graph.addEdge({
          source: { cell: n2.id },
          target: { cell: n4.id },
        });

        // Multi-vertex edge (curved path)
        graph.addEdge({
          source: { cell: n1.id },
          target: { cell: n3.id },
          vertices: [{ x: 150, y: 350 }],
          labels: [{ attrs: { label: { text: 'Event' } } }],
        });

        // Edge from worker to database
        graph.addEdge({
          source: { cell: n3.id },
          target: { cell: n4.id },
          vertices: [{ x: 400, y: 350 }, { x: 450, y: 280 }],
        });
      });

      await page.waitForTimeout(300);
      await dfdEditorPage.zoomToFitButton().click();
      await page.waitForTimeout(500);

      await takeThemeScreenshots(page, 'dfd-edge-variations');
    } finally {
      await cleanupFreshDiagram(page, threatModelFlow, dashboardPage, tmName, context);
    }
  });

  test('plate 4 — embedding', async ({ browser }) => {
    const { context, page, dfdEditorPage, threatModelFlow, dashboardPage, tmName } =
      await setupFreshDiagram(browser);

    try {
      // Create a security boundary with an embedded process + a process outside
      await page.evaluate(() => {
        const graph = (window as any).__e2e?.dfd?.graph;
        if (!graph) return;

        // Security boundary (parent)
        const boundary = graph.addNode({
          shape: 'security-boundary',
          x: 100, y: 100,
          width: 300, height: 200,
          attrs: { text: { text: 'Trust Zone' } },
        });

        // Embedded process inside the boundary
        const embedded = graph.addNode({
          shape: 'process',
          x: 150, y: 160,
          width: 120, height: 60,
          attrs: { text: { text: 'Internal Service' } },
        });
        boundary.addChild(embedded);

        // Process outside the boundary
        graph.addNode({
          shape: 'process',
          x: 500, y: 180,
          width: 120, height: 60,
          attrs: { text: { text: 'External Service' } },
        });

        // Edge from external to internal
        graph.addEdge({
          source: { cell: embedded.id },
          target: { cell: graph.getNodes()[2].id },
          labels: [{ attrs: { label: { text: 'Cross-Boundary' } } }],
        });
      });

      await page.waitForTimeout(300);
      await dfdEditorPage.zoomToFitButton().click();
      await page.waitForTimeout(500);

      await takeThemeScreenshots(page, 'dfd-embedding');
    } finally {
      await cleanupFreshDiagram(page, threatModelFlow, dashboardPage, tmName, context);
    }
  });

  test('plate 5 — seeded Complex DFD', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await new AuthFlow(page).loginAs('test-reviewer');

    const diagramFlow = new DiagramFlow(page);
    const dashboardPage = new DashboardPage(page);
    const tmEditPage = new TmEditPage(page);
    const dfdEditorPage = new DfdEditorPage(page);

    try {
      // Navigate to seeded TM
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await dashboardPage.tmCard(SEEDED_TM).first().click();
      await page.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
      await expect(tmEditPage.tmName()).toContainText('Seed TM');

      // Open the Complex DFD
      await diagramFlow.openFromTmEdit('Complex DFD');
      await dfdEditorPage.waitForGraphSettled(10, 15000);

      await dfdEditorPage.zoomToFitButton().click();
      await page.waitForTimeout(500);

      await takeThemeScreenshots(page, 'dfd-seeded-complex');
    } finally {
      await context.close();
    }
  });

  test('plate 6 — after operations (move + resize)', async ({ browser }) => {
    const { context, page, dfdEditorPage, threatModelFlow, dashboardPage, tmName } =
      await setupFreshDiagram(browser);

    try {
      // Add 2 nodes
      const id1 = await dfdEditorPage.addNodeViaOrchestrator('process');
      const id2 = await dfdEditorPage.addNodeViaOrchestrator('actor');
      await dfdEditorPage.waitForGraphSettled(2, 10000);

      // Move node 1 and resize node 2 programmatically
      await page.evaluate(({ nodeId1, nodeId2 }) => {
        const graph = (window as any).__e2e?.dfd?.graph;
        if (!graph) return;

        const n1 = graph.getCellById(nodeId1);
        if (n1) {
          n1.setPosition(300, 200);
          n1.setAttrByPath('text/text', 'Moved');
        }

        const n2 = graph.getCellById(nodeId2);
        if (n2) {
          n2.resize(160, 100);
          n2.setAttrByPath('text/text', 'Resized');
        }
      }, { nodeId1: id1, nodeId2: id2 });

      await dfdEditorPage.zoomToFitButton().click();
      await page.waitForTimeout(500);

      await takeThemeScreenshots(page, 'dfd-after-operations');
    } finally {
      await cleanupFreshDiagram(page, threatModelFlow, dashboardPage, tmName, context);
    }
  });
});
