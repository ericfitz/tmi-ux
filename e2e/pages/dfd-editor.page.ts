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

export class DfdEditorPage {
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

  async getNodeCount(): Promise<number> {
    return this.page.evaluate(() => {
      const graph = (window as any).__e2e?.dfd?.graph;
      return graph ? graph.getNodes().length : 0;
    });
  }

  async getEdgeCount(): Promise<number> {
    return this.page.evaluate(() => {
      const graph = (window as any).__e2e?.dfd?.graph;
      return graph ? graph.getEdges().length : 0;
    });
  }

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

  async getSelectedCells(): Promise<string[]> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      return orchestrator ? orchestrator.getSelectedCells() : [];
    });
  }

  async canUndo(): Promise<boolean> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      return orchestrator ? orchestrator.canUndo() : false;
    });
  }

  async canRedo(): Promise<boolean> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      return orchestrator ? orchestrator.canRedo() : false;
    });
  }

  async hasUnsavedChanges(): Promise<boolean> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      return orchestrator ? orchestrator.getState().hasUnsavedChanges : false;
    });
  }

  async getState(): Promise<any> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (!orchestrator) return null;
      const state = orchestrator.getState();
      return JSON.parse(JSON.stringify(state));
    });
  }

  async getHistoryState(): Promise<any> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (!orchestrator) return null;
      const state = orchestrator.getHistoryState();
      return JSON.parse(JSON.stringify(state));
    });
  }

  // --- Graph mutation methods (thin wrappers through orchestrator, for test setup) ---

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

  async selectAllViaOrchestrator(): Promise<void> {
    return this.page.evaluate(() => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (orchestrator) orchestrator.selectAll();
    });
  }

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
  async moveNodeViaOrchestrator(
    nodeId: string,
    position: { x: number; y: number },
  ): Promise<void> {
    await this._updateNodeViaOrchestrator(nodeId, { position });
  }

  async resizeNodeViaOrchestrator(
    nodeId: string,
    size: { width: number; height: number },
  ): Promise<void> {
    await this._updateNodeViaOrchestrator(nodeId, { size });
  }

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
