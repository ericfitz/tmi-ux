/**
 * Utility for validating CSS color values.
 * Consolidates the common color validation pattern used in DFD validators.
 */

/**
 * Common named CSS colors supported by browsers
 */
const NAMED_COLORS = [
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'brown',
  'black',
  'white',
  'gray',
  'grey',
];

/**
 * Regex pattern for hex color validation (3 or 6 digit hex)
 */
const HEX_COLOR_PATTERN = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

/**
 * Validates if a string is a valid CSS color value.
 * Supports hex colors (#RGB, #RRGGBB) and common named colors.
 *
 * @param color - The color string to validate
 * @returns true if the color is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidColor('#FF0000');  // true
 * isValidColor('#F00');     // true
 * isValidColor('red');      // true
 * isValidColor('invalid');  // false
 * ```
 */
export function isValidColor(color: string): boolean {
  // Check for hex color
  if (HEX_COLOR_PATTERN.test(color)) {
    return true;
  }

  // Check for named color
  if (NAMED_COLORS.includes(color.toLowerCase())) {
    return true;
  }

  return false;
}
