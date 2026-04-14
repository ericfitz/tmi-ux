import { Locator } from '@playwright/test';

/**
 * Sets an input value atomically, bypassing Angular's change detection
 * race condition with Playwright's keystroke-based input methods.
 *
 * Uses evaluate() to set the value via the native HTMLInputElement.prototype.value
 * setter and dispatch an input event in a single synchronous browser operation.
 * Angular's change detection cannot interleave.
 *
 * Use for [value], [(ngModel)], or any input where pressSequentially() drops
 * characters. For formControlName inputs, use Playwright's fill() instead.
 *
 * @param locator - Playwright locator for the input element
 * @param value - The value to set
 * @param options - Optional settings
 * @param options.clear - Whether to clear existing value first (default: true)
 */
export async function angularFill(
  locator: Locator,
  value: string,
  options?: { clear?: boolean },
): Promise<void> {
  const clear = options?.clear ?? true;

  await locator.waitFor({ state: 'visible' });

  if (clear) {
    // Select all existing text so the new value replaces it
    await locator.click({ clickCount: 3 });
  }

  // Set value and dispatch input event atomically within a single
  // synchronous browser operation. Angular's change detection cannot
  // run between setting the value and dispatching the event.
  await locator.evaluate((el, val) => {
    const input = el as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    nativeSetter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

  // Verify the value persisted after Angular's change detection cycle.
  // If [value] binding overwrote it, retry once.
  const actual = await locator.inputValue();
  if (actual !== value) {
    await locator.evaluate((el, val) => {
      const input = el as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!;
      nativeSetter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }
}
