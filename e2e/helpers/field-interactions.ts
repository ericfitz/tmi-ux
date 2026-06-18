import { expect, Locator, Page } from '@playwright/test';
import { angularFill } from './angular-fill';
import { FieldDef } from '../schema/field-definitions';

/**
 * Verify a field displays the expected value.
 */
// SEM@af061892e6a50f3d1743a570b24732c7581ca394: validate a form field displays the expected value by field type (pure)
export async function verifyFieldValue(
  page: Page,
  field: FieldDef,
  expected: string | string[] | boolean,
): Promise<void> {
  const locator = page.locator(field.uiSelector);

  switch (field.type) {
    case 'text':
    case 'textarea':
      await expect(locator).toHaveValue(expected as string, { timeout: 5000 });
      break;
    case 'select':
      await expect(locator).toContainText(expected as string, { timeout: 5000 });
      break;
    case 'multiselect':
    case 'chips': {
      const values = Array.isArray(expected) ? expected : [expected as string];
      for (const v of values) {
        await expect(locator).toContainText(v, { timeout: 5000 });
      }
      break;
    }
    case 'checkbox':
    case 'toggle': {
      const checkbox = locator.locator('input[type="checkbox"]');
      if (expected) {
        await expect(checkbox).toBeChecked({ timeout: 5000 });
      } else {
        await expect(checkbox).not.toBeChecked({ timeout: 5000 });
      }
      break;
    }
  }
}

/**
 * Edit a field to a new value.
 */
// SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: update a form field to a new value dispatching appropriate UI interactions (mutates shared state)
export async function editField(
  page: Page,
  field: FieldDef,
  newValue: string | boolean,
): Promise<void> {
  const locator = page.locator(field.uiSelector);

  switch (field.type) {
    case 'text':
    case 'textarea':
      await angularFill(locator, newValue as string);
      break;
    case 'select':
      await locator.click();
      await page.locator('mat-option').filter({ hasText: newValue as string }).click();
      break;
    case 'checkbox':
    case 'toggle': {
      const checkbox = locator.locator('input[type="checkbox"]');
      const isChecked = await checkbox.isChecked();
      if (isChecked !== newValue) {
        await locator.click();
      }
      break;
    }
    case 'chips': {
      const chipInput = locator.locator('input');
      await chipInput.fill(newValue as string);
      await chipInput.press('Enter');
      break;
    }
    case 'multiselect': {
      await locator.click();
      await page.locator('mat-option').filter({ hasText: newValue as string }).click();
      await page.keyboard.press('Escape');
      break;
    }
  }
}
