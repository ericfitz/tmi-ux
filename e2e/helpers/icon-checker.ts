import { Page } from '@playwright/test';

interface IconFailure {
  iconName: string;
  selector: string;
  reason: string;
}

/**
 * Verifies all Material icons on the page rendered correctly.
 *
 * For each mat-icon element, asserts:
 * - Non-zero bounding box (width > 0, height > 0)
 * - Visible content: SVG child element or non-empty text content (ligature)
 *
 * Throws with a descriptive error listing all broken icons.
 */
export async function assertIconsRendered(page: Page): Promise<void> {
  const icons = page.locator('mat-icon');
  const count = await icons.count();

  if (count === 0) {
    return; // No icons on page — nothing to check
  }

  const failures: IconFailure[] = [];

  for (let i = 0; i < count; i++) {
    const icon = icons.nth(i);

    // Skip hidden icons (e.g., in collapsed menus)
    const isVisible = await icon.isVisible().catch(() => false);
    if (!isVisible) {
      continue;
    }

    const box = await icon.boundingBox();
    const iconName = (await icon.textContent()) ?? '';
    const testId = (await icon.getAttribute('data-testid')) ?? '';
    const selector = testId ? `[data-testid="${testId}"]` : `mat-icon:nth(${i})`;

    if (!box || box.width === 0 || box.height === 0) {
      failures.push({
        iconName: iconName.trim(),
        selector,
        reason: 'Zero-size bounding box',
      });
      continue;
    }

    // Check for content: SVG child or text ligature
    const hasSvg = (await icon.locator('svg').count()) > 0;
    const hasText = iconName.trim().length > 0;

    if (!hasSvg && !hasText) {
      failures.push({
        iconName: '(empty)',
        selector,
        reason: 'No SVG child and no text content',
      });
    }
  }

  if (failures.length > 0) {
    const details = failures
      .map(f => `  - ${f.selector} [${f.iconName}]: ${f.reason}`)
      .join('\n');
    throw new Error(`Found ${failures.length} broken icon(s):\n${details}`);
  }
}
