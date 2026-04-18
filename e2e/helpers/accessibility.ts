import { Page } from '@playwright/test';
import { type ThemeMode, ALL_THEME_MODES, applyTheme, detectCurrentTheme } from './theme-utils';

interface AccessibilityFailure {
  theme: ThemeMode;
  check: string;
  details: string;
}

export interface AccessibilityOptions {
  skipThemes?: ThemeMode[];
}

/**
 * Run accessibility checks across all theme modes.
 *
 * Checks per mode:
 * - All form fields have label or aria-label
 * - No duplicate id attributes
 *
 * Throws with failures grouped by theme mode.
 */
export async function assertAccessibility(
  page: Page,
  options?: AccessibilityOptions,
): Promise<void> {
  const skipThemes = new Set(options?.skipThemes ?? []);
  const modes = ALL_THEME_MODES.filter(m => !skipThemes.has(m));
  const originalTheme = await detectCurrentTheme(page);
  const allFailures: AccessibilityFailure[] = [];

  try {
    for (const mode of modes) {
      await applyTheme(page, mode);

      const modeFailures = await page.evaluate((): { check: string; details: string }[] => {
        const failures: { check: string; details: string }[] = [];

        // Check 1: Form fields must have labels
        const formFields = document.querySelectorAll(
          'input, select, textarea, mat-select, mat-checkbox, mat-radio-group',
        );
        for (const field of Array.from(formFields)) {
          const el = field as HTMLElement;
          if (el.offsetParent === null && el.getAttribute('type') !== 'hidden') continue;
          if (el.getAttribute('type') === 'hidden') continue;

          const hasLabel =
            !!el.getAttribute('aria-label') ||
            !!el.getAttribute('aria-labelledby') ||
            !!document.querySelector(`label[for="${el.id}"]`);

          if (!hasLabel && el.id) {
            failures.push({
              check: 'missing-label',
              details: `${el.tagName.toLowerCase()}#${el.id} has no label or aria-label`,
            });
          }
        }

        // Check 2: No duplicate IDs
        const allIds = document.querySelectorAll('[id]');
        const idCounts = new Map<string, number>();
        for (const el of Array.from(allIds)) {
          const id = el.id;
          if (id) {
            idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
          }
        }
        for (const [id, count] of idCounts) {
          if (count > 1) {
            failures.push({
              check: 'duplicate-id',
              details: `id="${id}" appears ${count} times`,
            });
          }
        }

        return failures;
      });

      for (const f of modeFailures) {
        allFailures.push({ theme: mode, ...f });
      }
    }
  } finally {
    await applyTheme(page, originalTheme);
  }

  if (allFailures.length > 0) {
    const grouped = new Map<ThemeMode, AccessibilityFailure[]>();
    for (const f of allFailures) {
      const list = grouped.get(f.theme) ?? [];
      list.push(f);
      grouped.set(f.theme, list);
    }

    const details = [...grouped.entries()]
      .map(([theme, failures]) => {
        const items = failures.map(f => `    - [${f.check}] ${f.details}`).join('\n');
        return `  ${theme}:\n${items}`;
      })
      .join('\n');

    throw new Error(`Found ${allFailures.length} accessibility issue(s):\n${details}`);
  }
}

/**
 * Assert that status/severity/priority/CVSS indicators are distinguishable
 * without relying on color alone. Each element matched by a selector must
 * either contain a <mat-icon> descendant or carry non-whitespace text content.
 *
 * Runs under both colorblind theme modes so regressions that depend on color
 * encoding surface in the colorblind palettes we ship.
 */
export async function assertColorIndependentIndicators(
  page: Page,
  selectors: string[],
  options?: { themes?: ThemeMode[] },
): Promise<void> {
  const themes = options?.themes ?? (['light-colorblind', 'dark-colorblind'] as ThemeMode[]);
  const originalTheme = await detectCurrentTheme(page);
  const failures: { theme: ThemeMode; selector: string; details: string }[] = [];

  try {
    for (const theme of themes) {
      await applyTheme(page, theme);

      for (const selector of selectors) {
        const results = await page.evaluate(
          (sel: string): { hasIndicator: boolean; text: string; html: string }[] => {
            const elements = Array.from(document.querySelectorAll(sel));
            return elements
              .filter(el => (el as HTMLElement).offsetParent !== null)
              .map(el => {
                const hasIcon = !!el.querySelector('mat-icon');
                const text = (el.textContent ?? '').trim();
                return {
                  hasIndicator: hasIcon || text.length > 0,
                  text,
                  html: el.outerHTML.slice(0, 120),
                };
              });
          },
          selector,
        );

        if (results.length === 0) {
          // Not a failure — selectors are tolerated-missing across pages.
          continue;
        }

        for (const r of results) {
          if (!r.hasIndicator) {
            failures.push({
              theme,
              selector,
              details: `no mat-icon and no text content (${r.html})`,
            });
          }
        }
      }
    }
  } finally {
    await applyTheme(page, originalTheme);
  }

  if (failures.length > 0) {
    const grouped = new Map<ThemeMode, typeof failures>();
    for (const f of failures) {
      const list = grouped.get(f.theme) ?? [];
      list.push(f);
      grouped.set(f.theme, list);
    }

    const details = [...grouped.entries()]
      .map(([theme, list]) => {
        const items = list.map(f => `    - [${f.selector}] ${f.details}`).join('\n');
        return `  ${theme}:\n${items}`;
      })
      .join('\n');

    throw new Error(
      `Found ${failures.length} indicator(s) relying on color alone:\n${details}`,
    );
  }
}
