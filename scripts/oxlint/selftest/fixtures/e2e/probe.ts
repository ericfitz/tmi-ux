import type { Page } from '@playwright/test';

export async function probe(page: Page): Promise<void> {
  await page.locator('x');
  console.log('allowed in e2e');
  const loose: any = await page.evaluate(() => 1);
  loose.anything();
}
