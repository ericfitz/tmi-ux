import { Locator, Page, expect } from '@playwright/test';

/**
 * Property name set on `window` by hostile payloads if they execute.
 *
 * A window flag (rather than alert()/confirm()) is required here: a real
 * dialog blocks the Playwright driver and hangs the session, so payloads in
 * this file express "I executed" as `window.__xssExecuted = 1` instead.
 */
export const XSS_FLAG_PROP = '__xssExecuted';

export interface XssCase {
  id: string;
  kind: 'link' | 'image';
  markdown: string;
  /** Text (link label or image alt) that must remain visible after sanitization. */
  visibleText: string;
}

/**
 * The minimum hostile-markdown payload set from TMI-UX#818 / TRIAGE.md f001:
 * a javascript: href, a mixed-case + whitespace-smuggled scheme href, a
 * quote-breaking title attribute (anchor attribute breakout), an onerror
 * image, and a data: URI anchor href. `token` scopes visible text to one
 * test run so assertions can target a specific case unambiguously.
 */
export function buildHostileMarkdownCases(token: string): XssCase[] {
  return [
    {
      id: 'javascript-href',
      kind: 'link',
      visibleText: `JsHrefLink-${token}`,
      markdown: `[JsHrefLink-${token}](javascript:window.${XSS_FLAG_PROP}=1)`,
    },
    {
      id: 'obfuscated-scheme-href',
      kind: 'link',
      visibleText: `ObfuscatedLink-${token}`,
      // Deliberately raw HTML, not markdown link syntax: a bracketed
      // `(<...>)` link destination containing a tab gets percent-encoded by
      // marked's tokenizer before it ever reaches DOMPurify (verified via
      // marked.parse()), which would neuter the payload before the
      // sanitizer gets a chance to prove anything. Raw HTML preserves the
      // literal tab and mixed case so this actually exercises the
      // ALLOWED_URI_REGEXP / attribute-whitespace-stripping path.
      markdown: `<a href="JaVa\tSCRIPT:window.${XSS_FLAG_PROP}=1">ObfuscatedLink-${token}</a>`,
    },
    {
      id: 'title-attribute-breakout',
      kind: 'link',
      visibleText: `TitleBreakout-${token}`,
      // The escaped quote in the markdown source becomes a literal `"` in
      // the parsed title token, which the hand-built <a title="..."> string
      // in renderer.link would otherwise close early, injecting a real
      // onmouseover attribute — the exact f001 shape.
      markdown: `[TitleBreakout-${token}](https://example.com/ "breakout\\" onmouseover=\\"window.${XSS_FLAG_PROP}=1")`,
    },
    {
      id: 'onerror-image',
      kind: 'image',
      visibleText: `OnErrorImage-${token}`,
      markdown: `<img src="https://example.invalid/${token}.png" alt="OnErrorImage-${token}" onerror="window.${XSS_FLAG_PROP}=1">`,
    },
    {
      id: 'data-uri-href',
      kind: 'link',
      visibleText: `DataUriLink-${token}`,
      markdown: `[DataUriLink-${token}](data:text/html;base64,${Buffer.from(
        `<script>window.${XSS_FLAG_PROP}=1</script>`,
      ).toString('base64')})`,
    },
  ];
}

/** Joins all payload cases into one markdown document (blank lines force separate blocks). */
export function hostileMarkdownContent(token: string): string {
  return buildHostileMarkdownCases(token)
    .map(c => c.markdown)
    .join('\n\n');
}

/** Schemes that must never survive sanitization on a rendered href/src. */
const DANGEROUS_HREF_PATTERN = /^\s*(javascript|data|vbscript):/i;

/** Matches a surviving `on*="..."` event-handler attribute in serialized HTML. */
const EVENT_HANDLER_ATTR_PATTERN = /\son[a-z]+\s*=/i;

/**
 * Installs `window.__xssExecuted = false` before any page script runs, so a
 * later read reflects whether a payload executed during render rather than
 * some unrelated page state.
 */
export async function installXssFlag(page: Page): Promise<void> {
  await page.addInitScript(prop => {
    (window as unknown as Record<string, unknown>)[prop] = false;
  }, XSS_FLAG_PROP);
}

/** Reads the current value of the window flag payloads set on execution. */
export async function readXssFlag(page: Page): Promise<unknown> {
  return page.evaluate(prop => (window as unknown as Record<string, unknown>)[prop], XSS_FLAG_PROP);
}

/**
 * Backstop for a payload that still manages to pop a native dialog (which
 * would otherwise block the Playwright driver indefinitely). Dismisses any
 * dialog immediately and records it so the caller can fail the test loudly
 * instead of hanging.
 */
export function installDialogBackstop(page: Page): { messages: string[] } {
  const state = { messages: [] as string[] };
  page.on('dialog', dialog => {
    state.messages.push(`${dialog.type()}: ${dialog.message()}`);
    void dialog.dismiss();
  });
  return state;
}

/**
 * Asserts no hostile payload executed script during rendering: no dialog
 * fired (backstop) and the window flag is still false (primary signal).
 */
export async function assertNoScriptExecuted(
  page: Page,
  dialogState: { messages: string[] },
): Promise<void> {
  expect(dialogState.messages, 'a JS dialog fired during render — sanitization regressed').toEqual(
    [],
  );
  const flag = await readXssFlag(page);
  expect(flag, 'window.__xssExecuted was set — a payload executed').toBe(false);
}

/**
 * For each hostile-markdown case, verifies the rendered node exists with its
 * visible text/alt intact (sanitization didn't blank the content) and that
 * no dangerous href/src scheme or event-handler attribute survived.
 */
export async function assertSanitizedRender(container: Locator, cases: XssCase[]): Promise<void> {
  for (const c of cases) {
    if (c.kind === 'link') {
      const anchor = container.locator('a', { hasText: c.visibleText });
      await expect(anchor, `link text "${c.visibleText}" was not preserved`).toHaveCount(1);
      await expect(anchor).toBeVisible();

      const href = await anchor.getAttribute('href');
      if (href) {
        expect(href, `dangerous href survived for ${c.id}: ${href}`).not.toMatch(
          DANGEROUS_HREF_PATTERN,
        );
      }

      const outerHtml = await anchor.evaluate(el => el.outerHTML);
      expect(outerHtml, `event-handler attribute survived for ${c.id}: ${outerHtml}`).not.toMatch(
        EVENT_HANDLER_ATTR_PATTERN,
      );
    } else {
      const img = container.locator(`img[alt="${c.visibleText}"]`);
      await expect(img, `image alt "${c.visibleText}" was not preserved`).toHaveCount(1);

      const src = await img.getAttribute('src');
      if (src) {
        expect(src, `dangerous src survived for ${c.id}: ${src}`).not.toMatch(
          DANGEROUS_HREF_PATTERN,
        );
      }

      const outerHtml = await img.evaluate(el => el.outerHTML);
      expect(outerHtml, `event-handler attribute survived for ${c.id}: ${outerHtml}`).not.toMatch(
        EVENT_HANDLER_ATTR_PATTERN,
      );
    }
  }
}
