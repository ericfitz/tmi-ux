import { Page } from '@playwright/test';

interface TranslationFailure {
  element: string;
  text: string;
  selector: string;
}

/**
 * Scans the page DOM for unresolved Transloco translation keys.
 *
 * Detection:
 * 1. Text nodes matching the pattern of a dotted key path
 *    (3+ dot-separated segments, alphanumeric/camelCase, no spaces)
 * 2. Elements with [transloco] attribute that have empty text content
 *
 * Throws with a descriptive error listing all missing translations.
 */
export async function assertNoMissingTranslations(
  page: Page,
  options?: { ignoreSelectors?: string[] },
): Promise<void> {
  const ignoreSelectors = options?.ignoreSelectors ?? [];
  const failures = await page.evaluate(
    (ignored: string[]): TranslationFailure[] => {
      const results: TranslationFailure[] = [];

      // Pattern: 3+ dot-separated segments, each alphanumeric/camelCase
      const keyPattern = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){2,}$/;

      const isIgnored = (el: Element | null): boolean => {
        if (!el || ignored.length === 0) return false;
        return ignored.some(sel => el.closest(sel) !== null);
      };

      // Walk all text nodes
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
      );

      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim();
        if (text && keyPattern.test(text)) {
          const parent = node.parentElement;
          if (isIgnored(parent)) continue;
          const tagName = parent?.tagName?.toLowerCase() ?? 'unknown';
          const testId = parent?.getAttribute('data-testid') ?? '';
          const selector = testId ? `[data-testid="${testId}"]` : tagName;

          results.push({
            element: tagName,
            text,
            selector,
          });
        }
      }

      // Check elements with [transloco] attribute that are empty
      const translocoElements = document.querySelectorAll('[transloco]');
      for (const el of translocoElements) {
        if (isIgnored(el)) continue;
        const text = el.textContent?.trim();
        if (!text) {
          const tagName = el.tagName.toLowerCase();
          const testId = el.getAttribute('data-testid') ?? '';
          const translocoKey = el.getAttribute('transloco') ?? '';
          const selector = testId
            ? `[data-testid="${testId}"]`
            : `${tagName}[transloco="${translocoKey}"]`;

          results.push({
            element: tagName,
            text: `(empty) key=${translocoKey}`,
            selector,
          });
        }
      }

      return results;
    },
    ignoreSelectors,
  );

  if (failures.length > 0) {
    const details = failures.map(f => `  - ${f.selector}: "${f.text}"`).join('\n');
    throw new Error(`Found ${failures.length} unresolved translation key(s):\n${details}`);
  }
}
