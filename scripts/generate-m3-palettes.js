#!/usr/bin/env node

/**
 * Generate Material 3 Tonal Palettes
 *
 * This script generates M3-compatible tonal palettes from hex colors
 * using the Material Color Utilities library.
 *
 * Usage: node scripts/generate-m3-palettes.js
 */

import { argbFromHex, TonalPalette, Hct } from '@material/material-color-utilities';

// Colorblind-friendly colors (Okabe-Ito palette)
const COLORBLIND_PRIMARY = '#0072B2'; // Blue
const COLORBLIND_ACCENT = '#E69F00'; // Orange
const COLORBLIND_WARN = '#D55E00'; // Vermilion

// Regular colors
const REGULAR_PRIMARY = '#1976d2'; // Blue
const REGULAR_ACCENT = '#607d8b'; // Blue Grey
const REGULAR_WARN = '#f44336'; // Red

/**
 * Generate M3 tonal palette from hex color
 */
function generateTonalPalette(hexColor) {
  const argb = argbFromHex(hexColor);
  const hct = Hct.fromInt(argb);
  const palette = TonalPalette.fromHct(hct);

  // M3 required tone values
  const tones = [0, 10, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100];

  const result = {};
  for (const tone of tones) {
    const argbValue = palette.tone(tone);
    result[tone] = argbToHex(argbValue);
  }

  return result;
}

/**
 * Convert ARGB to hex color
 */
function argbToHex(argb) {
  const r = (argb >> 16) & 0xff;
  const g = (argb >> 8) & 0xff;
  const b = argb & 0xff;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Format palette as SCSS map
 */
function formatScssMap(palette, name) {
  let scss = `$${name}: (\n`;
  for (const [tone, hex] of Object.entries(palette)) {
    scss += `  ${tone}: ${hex},\n`;
  }
  scss += ');\n';
  return scss;
}

/**
 * Generate all palettes
 */
function generateAllPalettes() {
  console.log('// =============================================================================');
  console.log('// MATERIAL 3 TONAL PALETTES');
  console.log('// Generated using @material/material-color-utilities');
  console.log('// =============================================================================');
  console.log('');

  console.log('// -----------------------------------------------------------------------------');
  console.log('// COLORBLIND-FRIENDLY PALETTES (Okabe-Ito)');
  console.log('// -----------------------------------------------------------------------------');
  console.log('');

  const colorblindPrimary = generateTonalPalette(COLORBLIND_PRIMARY);
  console.log(`// Primary: ${COLORBLIND_PRIMARY} (Okabe-Ito Blue)`);
  console.log(formatScssMap(colorblindPrimary, 'colorblind-primary-m3'));

  const colorblindAccent = generateTonalPalette(COLORBLIND_ACCENT);
  console.log(`// Tertiary: ${COLORBLIND_ACCENT} (Okabe-Ito Orange)`);
  console.log(formatScssMap(colorblindAccent, 'colorblind-tertiary-m3'));

  const colorblindWarn = generateTonalPalette(COLORBLIND_WARN);
  console.log(`// Error: ${COLORBLIND_WARN} (Okabe-Ito Vermilion)`);
  console.log(formatScssMap(colorblindWarn, 'colorblind-error-m3'));

  console.log('// -----------------------------------------------------------------------------');
  console.log('// REGULAR PALETTES');
  console.log('// -----------------------------------------------------------------------------');
  console.log('');

  const regularPrimary = generateTonalPalette(REGULAR_PRIMARY);
  console.log(`// Primary: ${REGULAR_PRIMARY} (Blue)`);
  console.log(formatScssMap(regularPrimary, 'tmi-primary-m3'));

  const regularAccent = generateTonalPalette(REGULAR_ACCENT);
  console.log(`// Tertiary: ${REGULAR_ACCENT} (Blue Grey)`);
  console.log(formatScssMap(regularAccent, 'tmi-tertiary-m3'));

  const regularWarn = generateTonalPalette(REGULAR_WARN);
  console.log(`// Error: ${REGULAR_WARN} (Red)`);
  console.log(formatScssMap(regularWarn, 'tmi-error-m3'));
}

// Run the generator
generateAllPalettes();
