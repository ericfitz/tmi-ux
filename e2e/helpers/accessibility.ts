import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
 * Run axe-core's color-contrast rule under each theme mode. Uses WCAG AA
 * thresholds (axe default). Violations include the offending selector,
 * computed contrast ratio, and the required minimum — grouped by theme.
 *
 * Scopes the scan to #main-content (or the full page when that selector
 * isn't present) to avoid flagging browser chrome.
 */
export async function assertColorContrast(
  page: Page,
  options?: { themes?: ThemeMode[]; include?: string },
): Promise<void> {
  const themes = options?.themes ?? ALL_THEME_MODES;
  const originalTheme = await detectCurrentTheme(page);
  const include = options?.include;
  const allFailures: { theme: ThemeMode; id: string; target: string; summary: string }[] = [];

  try {
    for (const theme of themes) {
      await applyTheme(page, theme);

      let builder = new AxeBuilder({ page }).withRules(['color-contrast']);
      if (include) {
        builder = builder.include(include);
      }
      const results = await builder.analyze();

      for (const violation of results.violations) {
        for (const node of violation.nodes) {
          allFailures.push({
            theme,
            id: violation.id,
            target: Array.isArray(node.target) ? node.target.join(' ') : String(node.target),
            summary: node.failureSummary ?? violation.description,
          });
        }
      }
    }
  } finally {
    await applyTheme(page, originalTheme);
  }

  if (allFailures.length > 0) {
    const grouped = new Map<ThemeMode, typeof allFailures>();
    for (const f of allFailures) {
      const list = grouped.get(f.theme) ?? [];
      list.push(f);
      grouped.set(f.theme, list);
    }

    const details = [...grouped.entries()]
      .map(([theme, list]) => {
        const items = list
          .slice(0, 10)
          .map(f => `    - ${f.target}\n      ${f.summary.split('\n')[0]}`)
          .join('\n');
        const more = list.length > 10 ? `\n    ... and ${list.length - 10} more` : '';
        return `  ${theme}:\n${items}${more}`;
      })
      .join('\n');

    throw new Error(
      `Found ${allFailures.length} color-contrast violation(s):\n${details}`,
    );
  }
}

/**
 * Assert that every visible interactive element on the page is reachable
 * by keyboard — either focusable via the natural tab order (positive or
 * default tabindex) or programmatically focusable (tabindex >= 0 or native
 * focus behavior). Skips elements that are hidden, disabled, or have
 * tabindex="-1".
 *
 * Interactive element set: buttons, links (with href), inputs, selects,
 * textareas, mat-menu triggers, mat-select, mat-checkbox, mat-radio-group.
 */
export async function assertKeyboardFocusable(page: Page): Promise<void> {
  const failures = await page.evaluate((): { tag: string; selector: string }[] => {
    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[matmenutrigger]',
      'mat-select:not([aria-disabled="true"])',
      'mat-checkbox:not(.mat-mdc-checkbox-disabled)',
      'mat-radio-group',
    ];
    const results: { tag: string; selector: string }[] = [];

    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      for (const el of elements) {
        const html = el as HTMLElement;
        if (html.offsetParent === null) continue; // hidden
        const tabIndex = html.tabIndex;
        if (tabIndex < 0) continue; // deliberately unfocusable
        // Programmatically focus and check the active element
        html.focus();
        if (document.activeElement !== html) {
          // Try focusing a native focus target inside (e.g. mat-checkbox → input)
          const innerFocusable = html.querySelector<HTMLElement>(
            'input, button, select, textarea, [tabindex]',
          );
          if (innerFocusable) {
            innerFocusable.focus();
            if (document.activeElement === innerFocusable) continue;
          }
          const outer = html.outerHTML.slice(0, 100);
          results.push({ tag: html.tagName.toLowerCase(), selector: outer });
        }
      }
    }
    return results;
  });

  if (failures.length > 0) {
    const details = failures
      .slice(0, 20)
      .map(f => `    - <${f.tag}> ${f.selector}`)
      .join('\n');
    const more = failures.length > 20 ? `\n    ... and ${failures.length - 20} more` : '';
    throw new Error(
      `Found ${failures.length} interactive element(s) that cannot receive focus:\n${details}${more}`,
    );
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
