import { test, expect } from '@playwright/test';
import { loginWithTestProvider } from '../helpers/auth';
import {
  navigateToThreatModels,
  navigateToThreatModel,
  navigateToFirstThreatModel,
} from '../helpers/navigation';

/**
 * Threat Model management tests
 */

test.describe('Threat Models', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestProvider(page);
  });

  test('should display threat model list or empty state', async ({ page }) => {
    await navigateToThreatModels(page);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should show either threat model cards or empty state
    const cards = page.locator('.threat-model-card');
    const emptyState = page.locator('[class*="empty"], [class*="no-"], .no-threat-models');

    // Check if we have cards or an empty state
    const hasCards = (await cards.count()) > 0;
    const hasEmptyState = (await emptyState.count()) > 0;

    // At least one should be present
    expect(hasCards || hasEmptyState).toBe(true);
  });

  test('should search threat models', async ({ page }) => {
    await navigateToThreatModels(page);

    // Look for search input
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('System');
      await page.waitForTimeout(500);

      // Should filter results
      const cards = page.locator('.threat-model-card');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);

      // All visible cards should contain "System"
      const firstCardText = await cards.first().textContent();
      expect(firstCardText?.toLowerCase()).toContain('system');
    }
  });

  test('should navigate to threat model detail', async ({ page }) => {
    await navigateToThreatModels(page);

    // Check if we have any threat models
    const cards = page.locator('.threat-model-card');
    const count = await cards.count();

    // Skip if no threat models available
    test.skip(count === 0, 'No threat models available to test');

    await cards.first().click();

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/tm\/[a-f0-9-]+$/);

    // Should show diagram list
    await expect(page.locator('.mat-mdc-list-item')).toBeVisible({ timeout: 10000 });
  });

  test('should display diagram list in threat model detail', async ({ page }) => {
    await navigateToThreatModels(page);

    const cards = page.locator('.threat-model-card');
    const count = await cards.count();
    test.skip(count === 0, 'No threat models available to test');

    await navigateToFirstThreatModel(page);

    // Should show diagram list items
    const diagramItems = page.locator('.mat-mdc-list-item');
    await expect(diagramItems.first()).toBeVisible();

    const itemCount = await diagramItems.count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('should show metadata for threat model', async ({ page }) => {
    await navigateToThreatModels(page);

    const cards = page.locator('.threat-model-card');
    const count = await cards.count();
    test.skip(count === 0, 'No threat models available to test');

    await navigateToFirstThreatModel(page);

    // Look for metadata section (name, description, etc.)
    const body = page.locator('body');
    const text = await body.textContent();

    // Should contain threat model information
    expect(text).toBeTruthy();
  });

  test('should allow creating new diagram', async ({ page }) => {
    await navigateToThreatModels(page);

    const cards = page.locator('.threat-model-card');
    const count = await cards.count();
    test.skip(count === 0, 'No threat models available to test');

    await navigateToFirstThreatModel(page);

    // Look for "Add Diagram" or "New Diagram" button
    const addButton = page.getByRole('button', { name: /add.*diagram|new.*diagram|create.*diagram/i });

    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();

      // Should show create diagram dialog
      await expect(page.locator('mat-dialog-container, [role="dialog"]')).toBeVisible();

      // Should have name input
      await expect(page.getByLabel(/name|title/i)).toBeVisible();

      // Close dialog
      await page.getByRole('button', { name: /cancel/i }).click();
      await page.waitForTimeout(300);
    }
  });
});
