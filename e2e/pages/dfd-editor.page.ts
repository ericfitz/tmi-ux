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
  readonly stylePanel = () => this.page.locator('app-style-panel');
  readonly iconPickerPanel = () => this.page.locator('app-icon-picker-panel');

  /**
   * Select a node in the graph by clicking its DOM element.
   * Uses the node's bounding box center for the click.
   */
  async selectNodeByIndex(index: number): Promise<void> {
    const node = this.nodes().nth(index);
    await node.click();
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
      return (parent.getChildren() || []).map((c: any) => c.id);
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
    return this.page.evaluate(async (type) => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (!orchestrator) throw new Error('E2E bridge not available');
      return new Promise<string>((resolve, reject) => {
        orchestrator.addNode(type).subscribe({
          next: (result: any) => resolve(result?.nodeId || result?.id || ''),
          error: (err: any) => reject(err),
        });
      });
    }, nodeType);
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
    return this.page.evaluate(async () => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (!orchestrator) throw new Error('E2E bridge not available');
      return new Promise<void>((resolve, reject) => {
        orchestrator.undo().subscribe({
          next: () => resolve(),
          error: (err: any) => reject(err),
        });
      });
    });
  }

  async redoViaOrchestrator(): Promise<void> {
    return this.page.evaluate(async () => {
      const orchestrator = (window as any).__e2e?.dfd?.orchestrator;
      if (!orchestrator) throw new Error('E2E bridge not available');
      return new Promise<void>((resolve, reject) => {
        orchestrator.redo().subscribe({
          next: () => resolve(),
          error: (err: any) => reject(err),
        });
      });
    });
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
