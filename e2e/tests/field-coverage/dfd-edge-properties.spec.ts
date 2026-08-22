import { expect, BrowserContext, Page } from '@playwright/test';
import { test } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DiagramFlow } from '../../flows/diagram.flow';
import { DfdEditorPage } from '../../pages/dfd-editor.page';

/**
 * DFD Edge Properties — Field Coverage Tests
 *
 * Targeted tests for edge properties: labels and vertices.
 * Edges are created programmatically via page.evaluate against the X6 graph,
 * then verified through the DfdEditorPage helpers.
 *
 * Creates a fresh TM + diagram in beforeAll, cleans up in afterAll.
 * Tests run serially sharing a single browser context.
 */
test.describe.serial('DFD Edge Properties', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  let threatModelFlow: ThreatModelFlow;
  let diagramFlow: DiagramFlow;
  let dfdEditorPage: DfdEditorPage;

  const testTmName = `E2E Edge Props TM ${Date.now()}`;
  const testDiagramName = `E2E Edge Props Diagram ${Date.now()}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(90000);
    context = await browser.newContext();
    page = await context.newPage();

    await new AuthFlow(page).loginAs('test-reviewer');

    threatModelFlow = new ThreatModelFlow(page);
    diagramFlow = new DiagramFlow(page);
    dfdEditorPage = new DfdEditorPage(page);

    // Create fresh TM and diagram, open the DFD editor
    await threatModelFlow.createFromDashboard(testTmName);
    await diagramFlow.createFromTmEdit(testDiagramName);
    await diagramFlow.openFromTmEdit(testDiagramName);
    await expect(dfdEditorPage.graphContainer()).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(async () => {
    // Clean up over the API rather than through the dashboard. These specs end
    // on the DFD editor, which holds a collaboration WebSocket open, so
    // waitForLoadState('networkidle') never settles and the hook died on its
    // 30s timeout -- reported as a failure of whichever test happened to run
    // last, not of the teardown that actually hung.
    //
    // Surface cleanup failures instead of swallowing them: a leaked TM is not
    // harmless, it accumulates on the dashboard until the seeded TM that other
    // field-coverage specs look for is pushed off the first page. Close the
    // context first so a cleanup failure cannot also leak a browser context.
    let cleanupError: Error | undefined;
    try {
      await threatModelFlow.deleteByNameViaApi(testTmName);
    } catch (err) {
      cleanupError = err instanceof Error ? err : new Error(String(err));
    }
    await context.close();
    if (cleanupError) {
      throw cleanupError;
    }
  });

  /**
   * Helper: create two nodes and an edge between them via page.evaluate.
   * Returns { sourceId, targetId, edgeId }.
   *
   * Setup: creates edges directly via X6 graph API — the orchestrator doesn't expose
   * a direct edge creation method (edges are created via port interactions in the UI).
   */
  // SEM@38825d5b1f74ab2614157cd169abaeb8088fd09b: build two DFD nodes and a connecting edge in the live graph (mutates shared state)
  async function createNodesAndEdge(options?: {
    label?: string;
    labels?: string[];
    vertices?: Array<{ x: number; y: number }>;
  }): Promise<{ sourceId: string; targetId: string; edgeId: string }> {
    return page.evaluate((opts) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      if (!graph) throw new Error('Graph not available');

      // Create source and target nodes
      const source = graph.addNode({
        shape: 'process',
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        width: 120,
        height: 60,
        attrs: { text: { text: 'Source' } },
      });

      const target = graph.addNode({
        shape: 'process',
        x: 400 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        width: 120,
        height: 60,
        attrs: { text: { text: 'Target' } },
      });

      // Build edge configuration
      const edgeConfig: any = {
        source: { cell: source.id },
        target: { cell: target.id },
      };

      // Single label
      if (opts?.label) {
        edgeConfig.labels = [{
          attrs: { label: { text: opts.label } },
        }];
      }

      // Multiple labels
      if (opts?.labels) {
        edgeConfig.labels = opts.labels.map((text: string) => ({
          attrs: { label: { text } },
        }));
      }

      // Vertices (intermediate points)
      if (opts?.vertices) {
        edgeConfig.vertices = opts.vertices;
      }

      const edge = graph.addEdge(edgeConfig);

      return {
        sourceId: source.id as string,
        targetId: target.id as string,
        edgeId: edge.id as string,
      };
    }, options ?? {});
  }

  test('edge with single label', async () => {
    const labelText = 'Data Flow';
    const { edgeId } = await createNodesAndEdge({ label: labelText });

    // Verify via getEdges helper
    const edges = await dfdEditorPage.getEdges();
    const edge = edges.find(e => e.id === edgeId);
    expect(edge).toBeDefined();
    expect(edge!.labels).toContain(labelText);
    expect(edge!.labels.length).toBe(1);
  });

  test('edge with multiple labels', async () => {
    const labelTexts = ['Request', 'Response'];
    const { edgeId } = await createNodesAndEdge({ labels: labelTexts });

    const edges = await dfdEditorPage.getEdges();
    const edge = edges.find(e => e.id === edgeId);
    expect(edge).toBeDefined();
    expect(edge!.labels.length).toBe(2);
    expect(edge!.labels).toContain('Request');
    expect(edge!.labels).toContain('Response');
  });

  test('edge with vertices', async () => {
    const vertices = [
      { x: 250, y: 50 },
      { x: 350, y: 250 },
    ];
    const { edgeId } = await createNodesAndEdge({ vertices });

    // Verify vertex count via page.evaluate since getEdges() doesn't expose vertices
    const vertexCount = await page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      const edge = graph?.getCellById(id);
      return edge?.getVertices()?.length ?? 0;
    }, edgeId);

    expect(vertexCount).toBe(2);
  });

  test('edge source and target connections', async () => {
    const { sourceId, targetId, edgeId } = await createNodesAndEdge({ label: 'Connected' });

    const edges = await dfdEditorPage.getEdges();
    const edge = edges.find(e => e.id === edgeId);
    expect(edge).toBeDefined();
    expect(edge!.sourceId).toBe(sourceId);
    expect(edge!.targetId).toBe(targetId);
  });
});
