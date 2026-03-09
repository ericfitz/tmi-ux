/**
 * Default Color Palette for the DFD Style Panel
 *
 * Provides a curated set of 16 colors for the style panel color picker.
 * Colors are sourced from Material Design palette with consideration for
 * accessibility and visual distinction.
 *
 * All colors use lowercase 6-digit hex to match server convention.
 *
 * Implementation is encapsulated in a class so the sourcing mechanism
 * can be changed later without affecting consumers.
 */

const DEFAULT_PALETTE: readonly string[] = [
  '#000000', // Black
  '#ffffff', // White
  '#f44336', // Red
  '#e91e63', // Pink
  '#9c27b0', // Purple
  '#3f51b5', // Indigo
  '#2196f3', // Blue
  '#03a9f4', // Light Blue
  '#009688', // Teal
  '#4caf50', // Green
  '#8bc34a', // Light Green
  '#ffeb3b', // Yellow
  '#ffc107', // Amber
  '#ff9800', // Orange
  '#795548', // Brown
  '#9e9e9e', // Grey
] as const;

export class DefaultColorsConfig {
  static getColors(): readonly string[] {
    return DEFAULT_PALETTE;
  }
}
