import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DiagramFlow } from '../../flows/diagram.flow';
import { DashboardPage } from '../../pages/dashboard.page';
import { TmEditPage } from '../../pages/tm-edit.page';
import { DfdEditorPage } from '../../pages/dfd-editor.page';

/**
 * Core lifecycle integration test.
 *
 * Tests the primary user flow against a live backend:
 *   login → create TM → open TM → create diagram → open DFD editor →
 *   add nodes → close diagram → delete diagram → delete TM
 *
 * Tests run serially and share a single browser context (httpOnly session cookie).
 * All test data is created and cleaned up within the suite.
 */
test.describe.serial('Core Lifecycle', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  // Page objects and flows — instantiated manually for serial shared context
  let threatModelFlow: ThreatModelFlow;
  let diagramFlow: DiagramFlow;
  let dashboardPage: DashboardPage;
  let tmEditPage: TmEditPage;
  let dfdEditorPage: DfdEditorPage;

  // State shared across tests
  const testTmName = `E2E Test TM ${Date.now()}`;
  const testDiagramName = `E2E Test Diagram ${Date.now()}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();

    await new AuthFlow(page).loginAs('test-user');

    threatModelFlow = new ThreatModelFlow(page);
    diagramFlow = new DiagramFlow(page);
    dashboardPage = new DashboardPage(page);
    tmEditPage = new TmEditPage(page);
    dfdEditorPage = new DfdEditorPage(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('login completed successfully', async () => {
    const url = page.url();
    expect(url).not.toContain('/login');
    expect(url).not.toContain('/oauth2/callback');
  });

  test('create a threat model', async () => {
    await threatModelFlow.createFromDashboard(testTmName);

    await expect(tmEditPage.tmName()).toHaveText(testTmName);
  });

  test('verify threat model appears in list', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(dashboardPage.tmCard(testTmName)).toBeVisible({ timeout: 10000 });
  });

  test('open the threat model', async () => {
    await threatModelFlow.openFromDashboard(testTmName);

    await expect(tmEditPage.tmName()).toHaveText(testTmName);
  });

  test('create a diagram', async () => {
    await diagramFlow.createFromTmEdit(testDiagramName);

    await expect(tmEditPage.diagramRow(testDiagramName)).toBeVisible({ timeout: 15000 });
  });

  test('open the DFD editor', async () => {
    await diagramFlow.openFromTmEdit(testDiagramName);

    await expect(dfdEditorPage.graphContainer()).toBeVisible();
  });

  test('add nodes to the diagram', async () => {
    await expect(dfdEditorPage.addActorButton()).toBeEnabled({ timeout: 15000 });

    const initialNodeCount = await dfdEditorPage.nodes().count();

    await dfdEditorPage.addActorButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(initialNodeCount + 1, { timeout: 5000 });

    await dfdEditorPage.addProcessButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(initialNodeCount + 2, { timeout: 5000 });

    await dfdEditorPage.addStoreButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(initialNodeCount + 3, { timeout: 5000 });
  });

  test('close the diagram', async () => {
    await diagramFlow.closeDiagram();

    await expect(tmEditPage.tmName()).toHaveText(testTmName);
  });

  test('delete the diagram', async () => {
    await diagramFlow.deleteFromTmEdit(testDiagramName);

    await expect(
      tmEditPage.diagramRow(testDiagramName),
    ).toHaveCount(0, { timeout: 10000 });
  });

  test('delete the threat model', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(dashboardPage.tmCard(testTmName)).toBeVisible({ timeout: 10000 });
    await threatModelFlow.deleteFromDashboard(testTmName);

    await expect(
      dashboardPage.tmCard(testTmName),
    ).toHaveCount(0, { timeout: 10000 });
  });
});
