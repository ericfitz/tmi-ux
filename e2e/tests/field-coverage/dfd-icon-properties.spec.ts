import { expect, BrowserContext, Page } from '@playwright/test';
import { test } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DiagramFlow } from '../../flows/diagram.flow';
import { DashboardPage } from '../../pages/dashboard.page';
import { DfdEditorPage } from '../../pages/dfd-editor.page';

/**
 * DFD Icon Picker — Field Coverage Tests
 *
 * Targeted tests for the architecture icon picker panel:
 * - Searching for icons and selecting one
 * - Removing an assigned icon
 *
 * Creates a fresh TM + diagram in beforeAll, cleans up in afterAll.
 * Tests run serially sharing a single browser context.
 */
test.describe.serial('DFD Icon Properties', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  let threatModelFlow: ThreatModelFlow;
  let diagramFlow: DiagramFlow;
  let dashboardPage: DashboardPage;
  let dfdEditorPage: DfdEditorPage;

  const testTmName = `E2E Icon Props TM ${Date.now()}`;
  const testDiagramName = `E2E Icon Props Diagram ${Date.now()}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(90000);
    context = await browser.newContext();
    page = await context.newPage();

    await new AuthFlow(page).loginAs('test-reviewer');

    threatModelFlow = new ThreatModelFlow(page);
    diagramFlow = new DiagramFlow(page);
    dashboardPage = new DashboardPage(page);
    dfdEditorPage = new DfdEditorPage(page);

    // Create fresh TM and diagram, open the DFD editor
    await threatModelFlow.createFromDashboard(testTmName);
    await diagramFlow.createFromTmEdit(testDiagramName);
    await diagramFlow.openFromTmEdit(testDiagramName);
    await expect(dfdEditorPage.graphContainer()).toBeVisible({ timeout: 15000 });
    // Wait for orchestrator to be fully initialized
    await expect(dfdEditorPage.addProcessButton()).toBeEnabled({ timeout: 15000 });
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

  /**
   * Helper: open the icon picker panel if not already open.
   */
  async function ensureIconPickerOpen(): Promise<void> {
    const isVisible = await dfdEditorPage.iconPickerPanel().isVisible();
    if (!isVisible) {
      await dfdEditorPage.iconPickerToggle().click();
      await expect(dfdEditorPage.iconPickerPanel()).toBeVisible({ timeout: 5000 });
    }
  }

  test('icon search and select', async () => {
    // Add a process node and wait for DOM rendering
    const nodeId = await dfdEditorPage.addNodeViaOrchestrator('process');
    expect(nodeId).toBeTruthy();
    await expect(dfdEditorPage.nodes()).toHaveCount(1, { timeout: 10000 });

    await dfdEditorPage.selectNodeByIndex(0);
    await ensureIconPickerOpen();

    // The search field should be visible when an eligible node is selected
    const searchInput = dfdEditorPage.iconPickerPanel().locator('.search-field input');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Search for "compute"
    await searchInput.fill('');
    await searchInput.pressSequentially('compute', { delay: 30 });

    // Wait for search results to appear (debounce + render)
    const iconGrid = dfdEditorPage.iconPickerPanel().locator('.icon-grid');
    await expect(iconGrid.first()).toBeVisible({ timeout: 5000 });

    // Click the first icon result
    const firstIcon = dfdEditorPage.iconPickerPanel().locator('.icon-cell').first();
    await expect(firstIcon).toBeVisible({ timeout: 5000 });
    await firstIcon.click();
    await page.waitForTimeout(500);

    // Verify _arch.icon is set on the node's data
    const archData = await page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      const node = graph?.getCellById(id);
      const data = node?.getData();
      return data?._arch ?? null;
    }, nodeId);

    expect(archData).not.toBeNull();
    expect(archData.icon).toBeTruthy();

    // The current icon section should now be visible
    const currentIconPreview = dfdEditorPage.iconPickerPanel().locator('.current-icon-preview');
    await expect(currentIconPreview).toBeVisible({ timeout: 5000 });
  });

  test('icon removal', async () => {
    // Add a process node and assign an icon programmatically
    const nodeId = await dfdEditorPage.addNodeViaOrchestrator('process');
    expect(nodeId).toBeTruthy();

    // Assign an icon programmatically
    await page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      const node = graph?.getCellById(id);
      if (!node) throw new Error(`Node ${id} not found`);
      const prevData = node.getData() ?? {};
      node.setData({
        ...prevData,
        _arch: {
          provider: 'aws',
          type: 'service',
          subcategory: 'Compute',
          icon: { name: 'Lambda', path: 'aws/Compute/Lambda.svg' },
          placement: { vertical: 'top', horizontal: 'center' },
        },
      });
    }, nodeId);

    await dfdEditorPage.selectNodeByIndex(0);
    await ensureIconPickerOpen();

    // Wait for the current icon section to appear (since we assigned one)
    const currentIconSection = dfdEditorPage.iconPickerPanel().locator('.current-icon-section');
    await expect(currentIconSection).toBeVisible({ timeout: 5000 });

    // Click the remove button (close icon in current-icon-actions)
    const removeButton = dfdEditorPage.iconPickerPanel()
      .locator('.current-icon-actions button');
    await expect(removeButton).toBeVisible({ timeout: 5000 });
    await removeButton.click();
    await page.waitForTimeout(500);

    // Verify _arch is cleared from the node's data
    const archData = await page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      const node = graph?.getCellById(id);
      const data = node?.getData();
      return data?._arch ?? null;
    }, nodeId);

    expect(archData).toBeNull();

    // The current icon section should no longer be visible
    await expect(currentIconSection).toBeHidden({ timeout: 5000 });
  });
});
