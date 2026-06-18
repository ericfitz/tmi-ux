import { Page } from '@playwright/test';

/**
 * Serializable graph node data returned from page.evaluate().
 * Contains only plain data — no live X6 references.
 */
export interface GraphNodeData {
  id: string;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  parentId: string | null;
  zIndex: number;
}

/**
 * Serializable graph edge data returned from page.evaluate().
 */
export interface GraphEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  labels: string[];
}

// SEM@23452d4b0c244e162aa7e3b871d29b0c81a18fda: page object exposing locators and graph helpers for the DFD editor (pure)
export class DfdEditorPage {
  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: bind a Playwright page instance to the DFD editor page object (pure)
  constructor(readonly page: Page) {}

  // --- Locators: existing ---
  readonly graphContainer = () => this.page.getByTestId('graph-container');
  readonly addActorButton = () => this.page.getByTestId('add-actor-button');
  readonly addProcessButton = () => this.page.getByTestId('add-process-button');
  readonly addStoreButton = () => this.page.getByTestId('add-store-button');
  readonly closeButton = () => this.page.getByTestId('close-diagram-button');

  // --- Locators: node creation ---
  readonly addSecurityBoundaryButton = () =>
    this.page.getByTestId('add-security-boundary-button');
  readonly addTextBoxButton = () => this.page.getByTestId('add-text-box-button');

  // --- Locators: panel toggles ---
  readonly stylePanelToggle = () => this.page.getByTestId('style-panel-toggle');
  readonly iconPickerToggle = () => this.page.getByTestId('icon-picker-toggle');

  // --- Locators: edit operations ---
  readonly cutButton = () => this.page.getByTestId('cut-button');
  readonly copyButton = () => this.page.getByTestId('copy-button');
  readonly pasteButton = () => this.page.getByTestId('paste-button');
  readonly deleteButton = () => this.page.getByTestId('delete-button');

  // --- Locators: history/view ---
  readonly undoButton = () => this.page.getByTestId('undo-button');
  readonly redoButton = () => this.page.getByTestId('redo-button');
  readonly zoomToFitButton = () => this.page.getByTestId('zoom-to-fit-button');
  readonly saveButton = () => this.page.getByTestId('save-button');
  readonly helpButton = () => this.page.getByTestId('help-button');

  // --- Locators: developer tools ---
  readonly showGraphDataButton = () => this.page.getByTestId('show-graph-data-button');
  readonly showHistoryButton = () => this.page.getByTestId('show-history-button');
  readonly showClipboardButton = () => this.page.getByTestId('show-clipboard-button');

  // --- Locators: threats/metadata ---
  readonly manageMetadataButton = () => this.page.getByTestId('manage-metadata-button');
  readonly addThreatButton = () => this.page.getByTestId('add-threat-button');
  readonly manageThreatsButton = () => this.page.getByTestId('manage-threats-button');

  // --- Locators: export ---
  readonly exportMenuButton = () => this.page.getByTestId('export-menu-button');
  readonly exportSvgOption = () => this.page.getByTestId('export-svg-option');
  readonly exportPngOption = () => this.page.getByTestId('export-png-option');
  readonly exportJpegOption = () => this.page.getByTestId('export-jpeg-option');

  // --- Locators: DOM elements ---
  readonly nodes = () => this.page.locator('.x6-node');
  readonly edges = () => this.page.locator('.x6-edge');
  readonly stylePanel = () => this.page.locator('app-style-panel .style-panel');
  readonly iconPickerPanel = () => this.page.locator('app-icon-picker-panel .icon-picker-panel');

  /**
   * Select a node in the graph via the X6 graph API.
   * Uses graph.select() for stability over DOM clicks during layout animations.
   */
  // SEM@44bd53efcecf91cbf0bb74fe65b4c58a42305808: select a graph node by ordinal position via the X6 graph API
  async selectNodeByIndex(index: number): Promise<void> {
    // Select via the graph API to avoid SVG element stability issues
    // during X6 layout animations
    await this.page.evaluate((idx) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      if (!graph) throw new Error('Graph not available');
      const nodes = graph.getNodes();
      if (idx >= nodes.length) throw new Error(`Node index ${idx} out of range (${nodes.length} nodes)`);
      graph.cleanSelection();
      graph.select(nodes[idx]);
    }, index);
    await this.page.waitForTimeout(300);
  }

  /**
   * Select a node by its ID. Prefer this over selectNodeByIndex when running
   * serial tests that share graph state, where index-based lookup may pick
   * a leftover node from an earlier test.
   */
  // SEM@23452d4b0c244e162aa7e3b871d29b0c81a18fda: select a graph node by its stable ID via the X6 graph API
  async selectNodeById(nodeId: string): Promise<void> {
    await this.page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      if (!graph) throw new Error('Graph not available');
      const node = graph.getCellById(id);
      if (!node) throw new Error(`Node ${id} not found`);
      graph.cleanSelection();
      graph.select(node);
    }, nodeId);
    await this.page.waitForTimeout(300);
  }

  // --- Graph query methods (thin page.evaluate wrappers) ---

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: fetch the total number of nodes in the diagram graph (pure)
  async getNodeCount(): Promise<number> {
    return this.page.evaluate(() => {
      const graph = (window as any).__e2e?.dfd?.graph;
      return graph ? graph.getNodes().length : 0;
    });
  }

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: fetch the total number of edges in the diagram graph (pure)
  async getEdgeCount(): Promise<number> {
    return this.page.evaluate(() => {
      const graph = (window as any).__e2e?.dfd?.graph;
      return graph ? graph.getEdges().length : 0;
    });
  }

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: fetch all diagram nodes with position, size, label, and parent (pure)
  async getNodes(): Promise<GraphNodeData[]> {
    return this.page.evaluate(() => {
      const graph = (window as any).__e2e?.dfd?.graph;
      if (!graph) return [];
      return graph.getNodes().map((node: any) => ({
        id: node.id,
        shape: node.shape,
        x: node.getPosition().x,
        y: node.getPosition().y,
        width: node.getSize().width,
        height: node.getSize().height,
        label: node.getAttrByPath('text/text') || node.getAttrByPath('label/text') || '',
        parentId: node.getParentId?.() || null,
        zIndex: node.getZIndex() ?? 0,
      }));
    });
  }

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: fetch all diagram edges with source, target, and labels (pure)
  async getEdges(): Promise<GraphEdgeData[]> {
    return this.page.evaluate(() => {
      const graph = (window as any).__e2e?.dfd?.graph;
      if (!graph) return [];
      return graph.getEdges().map((edge: any) => ({
        id: edge.id,
        sourceId: edge.getSourceCellId() || '',
        targetId: edge.getTargetCellId() || '',
        labels: (edge.getLabels() || []).map((l: any) => l.attrs?.label?.text || ''),
      }));
    });
  }

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: fetch a single diagram node by ID, returning null if absent (pure)
  async getNodeById(nodeId: string): Promise<GraphNodeData | null> {
    return this.page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      if (!graph) return null;
      const node = graph.getCellById(id);
      if (!node || !node.isNode()) return null;
      return {
        id: node.id,
        shape: node.shape,
        x: node.getPosition().x,
        y: node.getPosition().y,
        width: node.getSize().width,
        height: node.getSize().height,
        label: node.getAttrByPath('text/text') || node.getAttrByPath('label/text') || '',
        parentId: node.getParentId?.() || null,
        zIndex: node.getZIndex() ?? 0,
      };
    }, nodeId);
  }

  // SEM@44bd53efcecf91cbf0bb74fe65b4c58a42305808: fetch IDs of child nodes embedded within a parent node (pure)
  async getEmbeddedChildren(parentId: string): Promise<string[]> {
    return this.page.evaluate((pid) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      if (!graph) return [];
      const parent = graph.getCellById(pid);
      if (!parent) return [];
      // Try getChildren() first, fall back to scanning all nodes by parentId
      const children = (parent.getChildren() || []).map((c: any) => c.id);
      if (children.length > 0) return children;
      // Fallback: find nodes whose parentId matches
      return graph.getNodes()
        .filter((n: any) => n.getParentId?.() === pid)
        .map((n: any) => n.id);
    }, parentId);
  }

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: fetch IDs of currently selected diagram cells (pure)
  async getSelectedCells(): Promise<string[]> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      return orchestrator ? orchestrator.getSelectedCells() : [];
    });
  }

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: check whether the diagram orchestrator has an undo operation available (pure)
  async canUndo(): Promise<boolean> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      return orchestrator ? orchestrator.canUndo() : false;
    });
  }

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: check whether the diagram orchestrator has a redo operation available (pure)
  async canRedo(): Promise<boolean> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      return orchestrator ? orchestrator.canRedo() : false;
    });
  }

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: check whether the diagram has unsaved changes pending (pure)
  async hasUnsavedChanges(): Promise<boolean> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      return orchestrator ? orchestrator.getState().hasUnsavedChanges : false;
    });
  }

  // SEM@730d3939c8add6cb89b4fd69c42938e4725d420f: fetch a serializable snapshot of the diagram orchestrator state (pure)
  async getState(): Promise<any> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (!orchestrator) return null;
      const state = orchestrator.getState();
      return JSON.parse(JSON.stringify(state));
    });
  }

  // SEM@730d3939c8add6cb89b4fd69c42938e4725d420f: fetch a serializable snapshot of the diagram undo/redo history state (pure)
  async getHistoryState(): Promise<any> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (!orchestrator) return null;
      const state = orchestrator.getHistoryState();
      return JSON.parse(JSON.stringify(state));
    });
  }

  // --- Graph mutation methods (thin wrappers through orchestrator, for test setup) ---

  // SEM@44bd53efcecf91cbf0bb74fe65b4c58a42305808: add a diagram node of a given type via the orchestrator and return its ID (mutates shared state)
  async addNodeViaOrchestrator(nodeType: string): Promise<string> {
    const nodeId = await this.page.evaluate(async (type) => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (!orchestrator) throw new Error('E2E bridge not available');
      return new Promise<string>((resolve, reject) => {
        orchestrator.addNode(type).subscribe({
          next: (result: any) => resolve(result?.affectedCellIds?.[0] || result?.nodeId || result?.id || ''),
          error: (err: any) => reject(err),
        });
      });
    }, nodeType);
    // Allow X6 to render the node to the DOM and the retroactive
    // history handler to complete
    await this.page.waitForTimeout(1000);
    return nodeId;
  }

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: delete all currently selected diagram cells via the orchestrator (mutates shared state)
  async deleteSelectedViaOrchestrator(): Promise<void> {
    return this.page.evaluate(async () => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (!orchestrator) throw new Error('E2E bridge not available');
      return new Promise<void>((resolve, reject) => {
        orchestrator.deleteSelectedCells().subscribe({
          next: () => resolve(),
          error: (err: any) => reject(err),
        });
      });
    });
  }

  // SEM@44bd53efcecf91cbf0bb74fe65b4c58a42305808: undo the last diagram operation via the orchestrator (mutates shared state)
  async undoViaOrchestrator(): Promise<void> {
    await this.page.evaluate(async () => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (!orchestrator) throw new Error('E2E bridge not available');
      return new Promise<void>((resolve, reject) => {
        orchestrator.undo().subscribe({
          next: () => resolve(),
          error: (err: any) => reject(err),
        });
      });
    });
    // Allow graph to settle after undo operation
    await this.page.waitForTimeout(500);
  }

  // SEM@44bd53efcecf91cbf0bb74fe65b4c58a42305808: redo the previously undone diagram operation via the orchestrator (mutates shared state)
  async redoViaOrchestrator(): Promise<void> {
    await this.page.evaluate(async () => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (!orchestrator) throw new Error('E2E bridge not available');
      return new Promise<void>((resolve, reject) => {
        orchestrator.redo().subscribe({
          next: () => resolve(),
          error: (err: any) => reject(err),
        });
      });
    });
    // Allow graph to settle after redo operation
    await this.page.waitForTimeout(500);
  }

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: select all diagram cells via the orchestrator (mutates shared state)
  async selectAllViaOrchestrator(): Promise<void> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (orchestrator) orchestrator.selectAll();
    });
  }

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: clear the diagram cell selection via the orchestrator (mutates shared state)
  async clearSelectionViaOrchestrator(): Promise<void> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (orchestrator) orchestrator.clearSelection();
    });
  }

  // Playwright cannot simulate X6-recognizable mouse drags: page.mouse.* is
  // intercepted by the .dfd-container, and locator.dragTo() uses HTML5 DnD
  // events that X6 ignores. These helpers drive the same UpdateNodeOperation
  // that a real drag or resize produces at the app layer.
  // SEM@1806fa624a4ed61d940b72150f00a316059fd393: update a diagram node's position via the orchestrator (mutates shared state)
  async moveNodeViaOrchestrator(
    nodeId: string,
    position: { x: number; y: number },
  ): Promise<void> {
    await this._updateNodeViaOrchestrator(nodeId, { position });
  }

  // SEM@1806fa624a4ed61d940b72150f00a316059fd393: update a diagram node's size via the orchestrator (mutates shared state)
  async resizeNodeViaOrchestrator(
    nodeId: string,
    size: { width: number; height: number },
  ): Promise<void> {
    await this._updateNodeViaOrchestrator(nodeId, { size });
  }

  // SEM@1806fa624a4ed61d940b72150f00a316059fd393: dispatch an update-node operation to the orchestrator for position or size changes (mutates shared state)
  private async _updateNodeViaOrchestrator(
    nodeId: string,
    updates: {
      position?: { x: number; y: number };
      size?: { width: number; height: number };
    },
  ): Promise<void> {
    await this.page.evaluate(
      async ({ id, upd }) => {
        const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
        if (!orchestrator) throw new Error('E2E bridge not available');
        const operation = {
          id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          type: 'update-node',
          source: 'test',
          priority: 'normal',
          timestamp: Date.now(),
          nodeId: id,
          updates: upd,
        };
        return new Promise<void>((resolve, reject) => {
          orchestrator.executeOperation(operation).subscribe({
            next: (result: any) => {
              if (result?.success === false) {
                reject(new Error(result?.error || 'update-node operation failed'));
              } else {
                resolve();
              }
            },
            error: (err: any) => reject(err),
          });
        });
      },
      { id: nodeId, upd: updates },
    );
  }

  // --- Utility methods ---

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: wait until the diagram node count matches the expected value or timeout (pure)
  async waitForGraphSettled(expectedNodeCount: number, timeoutMs = 10000): Promise<void> {
    const pollInterval = 200;
    const maxAttempts = Math.ceil(timeoutMs / pollInterval);
    for (let i = 0; i < maxAttempts; i++) {
      const count = await this.getNodeCount();
      if (count === expectedNodeCount) return;
      await this.page.waitForTimeout(pollInterval);
    }
    const finalCount = await this.getNodeCount();
    if (finalCount !== expectedNodeCount) {
      throw new Error(
        `Graph did not settle: expected ${expectedNodeCount} nodes, got ${finalCount} after ${timeoutMs}ms`,
      );
    }
  }

  // SEM@983bf3bdc607227f89bbe35498c49fedf98cfb05: map a node type string to its toolbar add-node button locator (pure)
  nodeButton(type: string) {
    const buttonMap: Record<string, () => ReturnType<typeof this.addActorButton>> = {
      actor: () => this.addActorButton(),
      process: () => this.addProcessButton(),
      store: () => this.addStoreButton(),
      'security-boundary': () => this.addSecurityBoundaryButton(),
      'text-box': () => this.addTextBoxButton(),
    };
    const getter = buttonMap[type];
    if (!getter) throw new Error(`Unknown node type: ${type}`);
    return getter();
  }
}
