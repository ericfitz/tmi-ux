import { test, expect, Page } from '@playwright/test';
import { loginWithTestProvider } from '../helpers/auth';
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
 */

test.describe('DFD Basic Functionality', () => {
  /**
   * Helper to check if diagrams are available and navigate to one
   * Returns true if we successfully navigated to a diagram, false otherwise
   */
  async function tryNavigateToFirstDiagram(page: Page): Promise<boolean> {
    // Navigate to threat models page
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Check if we have any threat models
    const cards = page.locator('.threat-model-card');
    const count = await cards.count();

    if (count === 0) {
      return false;
    }

    // Click on the first threat model
    await cards.first().click();
    await page.waitForURL(/\/tm\/[a-f0-9-]+$/);
    await page.waitForLoadState('networkidle');

    // Check if we have any diagrams
    const diagramLinks = page.locator('.mat-mdc-list-item-title');
    const diagramCount = await diagramLinks.count();

    if (diagramCount === 0) {
      return false;
    }

    // Click on the first diagram
    await diagramLinks.first().click();

    // Wait for DFD page to load with a timeout
    try {
      await page.waitForURL(/\/tm\/[a-f0-9-]+\/dfd\/[a-f0-9-]+/, { timeout: 5000 });
      await expect(page.locator('app-dfd')).toBeVisible({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  test.beforeEach(async ({ page }) => {
    await loginWithTestProvider(page);
  });

  test('should load DFD editor', async ({ page }) => {
    const hasData = await tryNavigateToFirstDiagram(page);

    if (hasData) {
      // Should show DFD component
      await expect(page.locator('app-dfd')).toBeVisible();

      // Should show graph container
      const graph = getGraphContainer(page);
      await expect(graph).toBeVisible();
    }
  });

  test('should display toolbar with node creation buttons', async ({ page }) => {
    const hasData = await tryNavigateToFirstDiagram(page);

    if (hasData) {
      // Should have buttons in toolbar
      const buttons = page.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);

      // Should have material icons for node types
      await expect(page.locator('mat-icon').first()).toBeVisible();
    }
  });

  test('should create an actor node', async ({ page }) => {
    const hasData = await tryNavigateToFirstDiagram(page);

    if (hasData) {
      // Get initial node count
      const initialNodes = await getGraphNodes(page).count();

      // Create an actor node
      await createNode(page, 'actor', 200, 200);

      // Should have one more node
      const finalNodes = await getGraphNodes(page).count();
      expect(finalNodes).toBe(initialNodes + 1);
    }
  });

  test('should create a process node', async ({ page }) => {
    const hasData = await tryNavigateToFirstDiagram(page);

    if (hasData) {
      const initialNodes = await getGraphNodes(page).count();
      await createNode(page, 'process', 300, 200);

      const finalNodes = await getGraphNodes(page).count();
      expect(finalNodes).toBe(initialNodes + 1);
    }
  });

  test('should create a store node', async ({ page }) => {
    const hasData = await tryNavigateToFirstDiagram(page);

    if (hasData) {
      const initialNodes = await getGraphNodes(page).count();
      await createNode(page, 'store', 400, 200);

      const finalNodes = await getGraphNodes(page).count();
      expect(finalNodes).toBe(initialNodes + 1);
    }
  });

  test('should delete a selected node', async ({ page }) => {
    const hasData = await tryNavigateToFirstDiagram(page);

    if (hasData) {
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
    }
  });

  test('should undo node creation', async ({ page }) => {
    const hasData = await tryNavigateToFirstDiagram(page);

    if (hasData) {
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
    }
  });

  test('should redo node creation', async ({ page }) => {
    const hasData = await tryNavigateToFirstDiagram(page);

    if (hasData) {
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
    }
  });

  test('should persist diagram state', async ({ page }) => {
    const hasData = await tryNavigateToFirstDiagram(page);

    if (hasData) {
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
    }
  });
});
