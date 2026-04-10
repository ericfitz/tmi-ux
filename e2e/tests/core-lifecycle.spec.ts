import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../flows/auth.flow';

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
  // Give each test enough time for Angular bootstrap + API calls
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  // State shared across tests
  const testTmName = `E2E Test TM ${Date.now()}`;
  const testDiagramName = `E2E Test Diagram ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('login via OAuth', async () => {
    await new AuthFlow(page).login();

    // Verify we landed on a protected page (not login, not callback)
    const url = page.url();
    expect(url).not.toContain('/login');
    expect(url).not.toContain('/oauth2/callback');
  });

  test('create a threat model', async () => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Click create button
    await page.locator('[data-testid="create-threat-model-button"]').click();

    // Fill the create dialog
    const nameInput = page.locator('[data-testid="create-tm-name-input"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill(testTmName);

    // Submit
    await page.locator('[data-testid="create-tm-submit"]').click();

    // Wait for navigation to the new threat model's edit page
    await page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });

    // Verify we're on the TM edit page with the correct name
    const tmName = page.locator('[data-testid="threat-model-name"]');
    await expect(tmName).toHaveText(testTmName);
  });

  test('verify threat model appears in list', async () => {
    // Navigate back to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find our card by name
    const cards = page.locator('[data-testid="threat-model-card"]');
    const ourCard = cards.filter({ hasText: testTmName });
    await expect(ourCard).toBeVisible({ timeout: 10000 });
  });

  test('open the threat model', async () => {
    // Click on our card (we're already on the dashboard from previous test)
    const cards = page.locator('[data-testid="threat-model-card"]');
    const ourCard = cards.filter({ hasText: testTmName });
    await ourCard.click();

    // Wait for TM edit page
    await page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });

    // Verify name
    const tmName = page.locator('[data-testid="threat-model-name"]');
    await expect(tmName).toHaveText(testTmName);
  });

  test('create a diagram', async () => {
    // Click add diagram button (scroll into view — it may be below the fold)
    const addButton = page.locator('[data-testid="add-diagram-button"]');
    await addButton.waitFor({ state: 'visible', timeout: 15000 });
    await addButton.scrollIntoViewIfNeeded();
    // Small delay to ensure Angular rendering is complete after scroll
    await page.waitForTimeout(500);
    await addButton.click();

    // Wait for the create diagram dialog to appear
    const nameInput = page.locator('[data-testid="diagram-name-input"]');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(testDiagramName);

    // Submit
    await page.locator('[data-testid="create-diagram-submit"]').click();

    // Wait for the dialog to close and diagram to appear in table
    const diagramRow = page.locator('[data-testid="diagram-row"]').filter({
      hasText: testDiagramName,
    });
    await expect(diagramRow).toBeVisible({ timeout: 10000 });
  });

  test('open the DFD editor', async () => {
    // Click on the diagram row to navigate to the DFD editor
    const diagramRow = page.locator('[data-testid="diagram-row"]').filter({
      hasText: testDiagramName,
    });
    await diagramRow.click();

    // Wait for DFD page to load
    await page.waitForURL(/\/tm\/[a-f0-9-]+\/dfd\/[a-f0-9-]+/, { timeout: 10000 });

    // Verify graph container is visible
    const graphContainer = page.locator('[data-testid="graph-container"]');
    await expect(graphContainer).toBeVisible({ timeout: 15000 });
  });

  test('add nodes to the diagram', async () => {
    // Wait for the graph to initialize (toolbar buttons become enabled)
    const actorButton = page.locator('[data-testid="add-actor-button"]');
    await expect(actorButton).toBeEnabled({ timeout: 15000 });

    // Count initial nodes
    const initialNodeCount = await page.locator('.x6-node').count();

    // Clicking toolbar buttons creates nodes directly (no canvas click needed)
    await actorButton.click();
    await expect(page.locator('.x6-node')).toHaveCount(initialNodeCount + 1, {
      timeout: 5000,
    });

    await page.locator('[data-testid="add-process-button"]').click();
    await expect(page.locator('.x6-node')).toHaveCount(initialNodeCount + 2, {
      timeout: 5000,
    });

    await page.locator('[data-testid="add-store-button"]').click();
    await expect(page.locator('.x6-node')).toHaveCount(initialNodeCount + 3, {
      timeout: 5000,
    });
  });

  test('close the diagram', async () => {
    // Click close button
    await page.locator('[data-testid="close-diagram-button"]').click();

    // Should navigate back to TM edit page
    await page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });

    // Verify we're on the TM detail page
    const tmName = page.locator('[data-testid="threat-model-name"]');
    await expect(tmName).toHaveText(testTmName);
  });

  test('delete the diagram', async () => {
    // Find our diagram row
    const diagramRow = page.locator('[data-testid="diagram-row"]').filter({
      hasText: testDiagramName,
    });
    await expect(diagramRow).toBeVisible();

    // The delete button is inside a kebab menu on the diagram row.
    // Click the kebab menu (more_vert) button on the row to open it.
    const kebabButton = diagramRow.locator('button[mat-icon-button]').filter({
      has: page.locator('mat-icon:has-text("more_vert")'),
    });
    await kebabButton.click();

    // Click delete in the menu
    const deleteMenuItem = page.locator('[data-testid="diagram-delete-button"]');
    await deleteMenuItem.waitFor({ state: 'visible' });
    await deleteMenuItem.click();

    // Handle delete confirmation dialog — type "gone forever"
    const confirmInput = page.locator('[data-testid="delete-confirm-input"]');
    await confirmInput.waitFor({ state: 'visible' });
    await confirmInput.fill('gone forever');

    // Click the delete confirm button
    const confirmButton = page.locator('[data-testid="delete-confirm-button"]');
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Wait for dialog to close and diagram to disappear
    await expect(
      page.locator('[data-testid="diagram-row"]').filter({
        hasText: testDiagramName,
      }),
    ).toHaveCount(0, { timeout: 10000 });
  });

  test('delete the threat model', async () => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find our card
    const ourCard = page.locator('[data-testid="threat-model-card"]').filter({
      hasText: testTmName,
    });
    await expect(ourCard).toBeVisible({ timeout: 10000 });

    // Click the delete button on our card
    const deleteButton = ourCard.locator(
      '[data-testid="threat-model-delete-button"]',
    );
    await deleteButton.click();

    // Handle delete confirmation dialog — type "gone forever"
    const confirmInput = page.locator('[data-testid="delete-confirm-input"]');
    await confirmInput.waitFor({ state: 'visible' });
    await confirmInput.fill('gone forever');

    // Click the delete confirm button
    const confirmButton = page.locator('[data-testid="delete-confirm-button"]');
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Wait for dialog to close and card to disappear
    await expect(
      page.locator('[data-testid="threat-model-card"]').filter({
        hasText: testTmName,
      }),
    ).toHaveCount(0, { timeout: 10000 });
  });
});
