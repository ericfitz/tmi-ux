import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../helpers/auth';
import { navigateToThreatModels, navigateToFirstDiagram } from '../helpers/navigation';
import {
  getGraphContainer,
  getGraphNodes,
  createNode,
  deleteSelected,
  undo,
  redo,
} from '../helpers/dfd';

/**
 * DFD (Data Flow Diagram) basic functionality tests
 * NOTE: These tests require at least one threat model with a diagram to be available
 * If no data is available, all tests in this suite will be skipped
 */

test.describe('DFD Basic Functionality', () => {
  let hasData = false;

  test.beforeAll(async ({ browser }) => {
    // Check if we have any threat models available
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupMockAuth(page);
      await navigateToThreatModels(page);
      const cards = page.locator('.threat-model-card');
      hasData = (await cards.count()) > 0;
    } catch {
      hasData = false;
    } finally {
      await context.close();
    }
  });

  test.beforeEach(async ({ page }, testInfo) => {
    // Skip entire suite if no data
    if (!hasData) {
      testInfo.skip(true, 'No threat models available - skipping DFD tests');
      return;
    }

    await setupMockAuth(page);
  });

  test('should load DFD editor', async ({ page }) => {
    await navigateToFirstDiagram(page);

    // Should show DFD component
    await expect(page.locator('app-dfd')).toBeVisible();

    // Should show graph container
    const graph = getGraphContainer(page);
    await expect(graph).toBeVisible();
  });

  test('should display toolbar with node creation buttons', async ({ page }) => {
    await navigateToFirstDiagram(page);

    // Should have buttons in toolbar
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    // Should have material icons for node types
    await expect(page.locator('mat-icon').first()).toBeVisible();
  });

  test('should create an actor node', async ({ page }) => {
    await navigateToFirstDiagram(page);

    // Get initial node count
    const initialNodes = await getGraphNodes(page).count();

    // Create an actor node
    await createNode(page, 'actor', 200, 200);

    // Should have one more node
    const finalNodes = await getGraphNodes(page).count();
    expect(finalNodes).toBe(initialNodes + 1);
  });

  test('should create a process node', async ({ page }) => {
    await navigateToFirstDiagram(page);

    const initialNodes = await getGraphNodes(page).count();
    await createNode(page, 'process', 300, 200);

    const finalNodes = await getGraphNodes(page).count();
    expect(finalNodes).toBe(initialNodes + 1);
  });

  test('should create a store node', async ({ page }) => {
    await navigateToFirstDiagram(page);

    const initialNodes = await getGraphNodes(page).count();
    await createNode(page, 'store', 400, 200);

    const finalNodes = await getGraphNodes(page).count();
    expect(finalNodes).toBe(initialNodes + 1);
  });

  test('should delete a selected node', async ({ page }) => {
    await navigateToFirstDiagram(page);

    // Create a node
    await createNode(page, 'actor', 200, 200);
    const nodesAfterCreate = await getGraphNodes(page).count();

    // Select and delete the node
    const nodes = getGraphNodes(page);
    await nodes.last().click();
    await deleteSelected(page);

    // Should have one fewer node
    const nodesAfterDelete = await getGraphNodes(page).count();
    expect(nodesAfterDelete).toBe(nodesAfterCreate - 1);
  });

  test('should undo node creation', async ({ page }) => {
    await navigateToFirstDiagram(page);

    const initialNodes = await getGraphNodes(page).count();

    // Create a node
    await createNode(page, 'actor', 200, 200);
    const nodesAfterCreate = await getGraphNodes(page).count();
    expect(nodesAfterCreate).toBe(initialNodes + 1);

    // Undo
    await undo(page);

    // Should be back to initial count
    const nodesAfterUndo = await getGraphNodes(page).count();
    expect(nodesAfterUndo).toBe(initialNodes);
  });

  test('should redo node creation', async ({ page }) => {
    await navigateToFirstDiagram(page);

    const initialNodes = await getGraphNodes(page).count();

    // Create a node
    await createNode(page, 'actor', 200, 200);

    // Undo
    await undo(page);
    const nodesAfterUndo = await getGraphNodes(page).count();
    expect(nodesAfterUndo).toBe(initialNodes);

    // Redo
    await redo(page);

    // Should have the node again
    const nodesAfterRedo = await getGraphNodes(page).count();
    expect(nodesAfterRedo).toBe(initialNodes + 1);
  });

  test('should persist diagram state', async ({ page }) => {
    await navigateToFirstDiagram(page);

    // Create nodes
    await createNode(page, 'actor', 200, 200);
    await createNode(page, 'process', 400, 200);

    const nodesBeforeReload = await getGraphNodes(page).count();

    // Reload page
    await page.reload();
    await page.waitForTimeout(3000);

    // Nodes should still be there
    const nodesAfterReload = await getGraphNodes(page).count();
    expect(nodesAfterReload).toBe(nodesBeforeReload);
  });
});
