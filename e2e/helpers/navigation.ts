import { Page, expect } from '@playwright/test';

/**
 * Navigation helper functions for e2e tests
 */

/**
 * Navigate to threat models list page
 */
export async function navigateToThreatModels(page: Page): Promise<void> {
  await page.goto('/tm');
  await expect(page).toHaveURL(/\/tm/);
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a specific threat model by clicking on its card
 */
export async function navigateToThreatModel(page: Page, threatModelName: string): Promise<void> {
  await navigateToThreatModels(page);
  const card = page.locator('.threat-model-card').filter({ hasText: threatModelName });
  await card.click();
  await page.waitForURL(/\/tm\/[a-f0-9-]+$/);
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to DFD editor for a specific diagram
 */
export async function navigateToDfdDiagram(
  page: Page,
  threatModelName: string,
  diagramName: string,
): Promise<void> {
  await navigateToThreatModel(page, threatModelName);

  // Click on the diagram name in the list
  const diagramLink = page
    .locator('.mat-mdc-list-item-title')
    .filter({ hasText: diagramName });
  await diagramLink.click();

  // Wait for DFD page to load
  await page.waitForURL(/\/tm\/[a-f0-9-]+\/dfd\/[a-f0-9-]+/);
  await expect(page.locator('app-dfd')).toBeVisible({ timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Wait for graph to initialize
  await page.waitForTimeout(2000);
}

/**
 * Navigate to home page
 */
export async function navigateToHome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL('/');
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to about page
 */
export async function navigateToAbout(page: Page): Promise<void> {
  await page.goto('/about');
  await expect(page).toHaveURL('/about');
  await page.waitForLoadState('networkidle');
}
