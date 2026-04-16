import { expect, BrowserContext, Page } from '@playwright/test';
import { test } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DiagramFlow } from '../../flows/diagram.flow';
import { DashboardPage } from '../../pages/dashboard.page';
import { DfdEditorPage } from '../../pages/dfd-editor.page';
import { assertNoMissingTranslations } from '../../helpers/translation-scanner';
import { assertIconsRendered } from '../../helpers/icon-checker';

/**
 * DFD Translation & Icon Integrity Tests
 *
 * Verifies that the DFD editor, style panel, and icon picker panel
 * have no unresolved translation keys and all Material icons render
 * correctly (non-zero bounding box, visible content).
 *
 * Creates a fresh TM + diagram, opens the editor, then checks
 * each panel state in sequence.
 */
test.describe.serial('DFD Translation & Icon Integrity', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  let threatModelFlow: ThreatModelFlow;
  let diagramFlow: DiagramFlow;
  let dashboardPage: DashboardPage;
  let dfdEditorPage: DfdEditorPage;

  const testTmName = `E2E DFD i18n TM ${Date.now()}`;
  const testDiagramName = `E2E DFD i18n Diagram ${Date.now()}`;

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

  test('no missing translations on DFD editor toolbar', async () => {
    await assertNoMissingTranslations(page);
  });

  test('all icons render on DFD editor toolbar', async () => {
    await assertIconsRendered(page);
  });

  test('no missing translations with style panel open', async () => {
    // Add a node and select it so the style panel shows controls (not "no selection")
    const nodeId = await dfdEditorPage.addNodeViaOrchestrator('process');
    await page.evaluate((id) => {
      const graph = (window as any).__e2e?.dfd?.graph;
      if (!graph) return;
      const cell = graph.getCellById(id);
      if (cell) {
        graph.cleanSelection();
        graph.select(cell);
      }
    }, nodeId);
    await page.waitForTimeout(300);

    // Open style panel
    await dfdEditorPage.stylePanelToggle().click();
    await expect(dfdEditorPage.stylePanel()).toBeVisible({ timeout: 5000 });

    await assertNoMissingTranslations(page);
  });

  test('all icons render with style panel open', async () => {
    // Style panel should still be open from previous test
    await expect(dfdEditorPage.stylePanel()).toBeVisible({ timeout: 5000 });
    await assertIconsRendered(page);

    // Close style panel for next test
    await dfdEditorPage.stylePanelToggle().click();
    await expect(dfdEditorPage.stylePanel()).toBeHidden({ timeout: 5000 });
  });

  test('no missing translations with icon picker open', async () => {
    // Open icon picker
    await dfdEditorPage.iconPickerToggle().click();
    await expect(dfdEditorPage.iconPickerPanel()).toBeVisible({ timeout: 5000 });

    await assertNoMissingTranslations(page);
  });

  test('all icons render with icon picker open', async () => {
    // Icon picker should still be open from previous test
    await expect(dfdEditorPage.iconPickerPanel()).toBeVisible({ timeout: 5000 });
    await assertIconsRendered(page);

    // Close icon picker
    await dfdEditorPage.iconPickerToggle().click();
    await expect(dfdEditorPage.iconPickerPanel()).toBeHidden({ timeout: 5000 });
  });
});
