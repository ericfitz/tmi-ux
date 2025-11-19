import { Page, Locator } from '@playwright/test';

/**
 * DFD (Data Flow Diagram) helper functions for e2e tests
 */

export type NodeType = 'actor' | 'process' | 'store' | 'security-boundary' | 'text-box';

/**
 * Get the DFD graph container
 */
export function getGraphContainer(page: Page): Locator {
  return page.locator('.x6-graph');
}

/**
 * Click on the graph at specific coordinates
 */
export async function clickGraph(page: Page, x: number, y: number): Promise<void> {
  const graph = getGraphContainer(page);
  await graph.click({ position: { x, y } });
}

/**
 * Select a node creation tool from the toolbar
 */
export async function selectNodeTool(page: Page, nodeType: NodeType): Promise<void> {
  // Map node types to button selectors or text
  const buttonMap: Record<NodeType, string> = {
    actor: 'person',
    process: 'circle',
    store: 'database',
    'security-boundary': 'security',
    'text-box': 'text_fields',
  };

  const iconName = buttonMap[nodeType];
  const button = page.locator(`button mat-icon:has-text("${iconName}")`).first();

  if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
    await button.click();
    await page.waitForTimeout(300);
  } else {
    // Fallback: try to find button by aria-label or title
    const fallbackButton = page
      .getByRole('button', { name: new RegExp(nodeType, 'i') })
      .first();
    await fallbackButton.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Create a node on the graph
 */
export async function createNode(
  page: Page,
  nodeType: NodeType,
  x: number,
  y: number,
): Promise<void> {
  await selectNodeTool(page, nodeType);
  await clickGraph(page, x, y);
  await page.waitForTimeout(500);
}

/**
 * Get all nodes on the graph
 */
export function getGraphNodes(page: Page): Locator {
  return page.locator('.x6-node, [data-cell-id][data-shape]');
}

/**
 * Get all edges on the graph
 */
export function getGraphEdges(page: Page): Locator {
  return page.locator('.x6-edge');
}

/**
 * Select a node by clicking on it
 */
export async function selectNode(page: Page, nodeIndex: number = 0): Promise<void> {
  const nodes = getGraphNodes(page);
  await nodes.nth(nodeIndex).click();
  await page.waitForTimeout(300);
}

/**
 * Delete selected elements
 */
export async function deleteSelected(page: Page): Promise<void> {
  // Press Delete or Backspace key
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
}

/**
 * Undo last action
 */
export async function undo(page: Page): Promise<void> {
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
}

/**
 * Redo last undone action
 */
export async function redo(page: Page): Promise<void> {
  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(300);
}

/**
 * Zoom in on the graph
 */
export async function zoomIn(page: Page): Promise<void> {
  await page.keyboard.press('Control+=');
  await page.waitForTimeout(300);
}

/**
 * Zoom out on the graph
 */
export async function zoomOut(page: Page): Promise<void> {
  await page.keyboard.press('Control+-');
  await page.waitForTimeout(300);
}

/**
 * Fit graph to viewport
 */
export async function fitToViewport(page: Page): Promise<void> {
  // Look for fit-to-viewport button
  const fitButton = page.getByRole('button', { name: /fit|zoom.*fit/i }).first();
  if (await fitButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await fitButton.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Open node properties dialog
 */
export async function openNodeProperties(page: Page, nodeIndex: number = 0): Promise<void> {
  await selectNode(page, nodeIndex);
  // Double-click to open properties
  const nodes = getGraphNodes(page);
  await nodes.nth(nodeIndex).dblclick();
  await page.waitForTimeout(500);
}

/**
 * Export diagram as PNG
 */
export async function exportAsPNG(page: Page): Promise<void> {
  // Look for export menu or button
  const exportButton = page.getByRole('button', { name: /export|download/i }).first();
  await exportButton.click();

  const pngOption = page.getByRole('menuitem', { name: /png/i });
  if (await pngOption.isVisible({ timeout: 1000 }).catch(() => false)) {
    await pngOption.click();
  }
  await page.waitForTimeout(1000);
}
