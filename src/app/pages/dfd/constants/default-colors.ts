/**
 * Default Color Palette for the DFD Style Panel
 *
 * Provides a curated set of 16 colors for the style panel color picker.
 * Colors are sourced from Material Design palette with consideration for
 * accessibility and visual distinction.
 *
 * Implementation is encapsulated in a class so the sourcing mechanism
 * can be changed later without affecting consumers.
 */

const DEFAULT_PALETTE: readonly string[] = [
  '#000000', // Black
  '#FFFFFF', // White
  '#F44336', // Red
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#3F51B5', // Indigo
  '#2196F3', // Blue
  '#03A9F4', // Light Blue
  '#009688', // Teal
  '#4CAF50', // Green
  '#8BC34A', // Light Green
  '#FFEB3B', // Yellow
  '#FFC107', // Amber
  '#FF9800', // Orange
  '#795548', // Brown
  '#9E9E9E', // Grey
] as const;

export class DefaultColorsConfig {
  static getColors(): readonly string[] {
    return DEFAULT_PALETTE;
  }
}
