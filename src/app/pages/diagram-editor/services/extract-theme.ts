import { serializeDefaultTheme } from './serialize-theme';

/**
 * Run this in the console to extract the theme:
 * 
 * const extractTheme = require('./extract-theme');
 * extractTheme();
 */
export function extractTheme(): string {
  // Get the serialized theme JSON
  const themeJson = serializeDefaultTheme();
  
  // Log it to the console for debugging/copying
  // Using allowed console methods (debug) instead of console.log
  console.debug('THEME JSON:');
  console.debug(themeJson);
  
  return themeJson;
}