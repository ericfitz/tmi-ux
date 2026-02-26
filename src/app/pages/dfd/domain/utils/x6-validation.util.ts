/**
 * Shared validation and comparison utilities for X6 cell properties.
 * Used by NodeInfo and EdgeInfo value objects.
 */

import { Metadata } from '../value-objects/metadata';
import { MarkupElement, CellTool } from '../value-objects/x6-types';

/**
 * Validates an array of X6 markup elements.
 * Throws on invalid structure.
 */
export function validateMarkupElements(
  markup: MarkupElement[] | undefined,
  errorPrefix: string = 'Markup element',
): void {
  if (!markup) return;

  markup.forEach((element, index) => {
    if (!element.tagName || typeof element.tagName !== 'string') {
      throw new Error(`${errorPrefix} at index ${index} must have a valid tagName`);
    }
    if (element.selector && typeof element.selector !== 'string') {
      throw new Error(`${errorPrefix} at index ${index} selector must be a string`);
    }
    if (element.attrs && typeof element.attrs !== 'object') {
      throw new Error(`${errorPrefix} at index ${index} attrs must be an object`);
    }
    if (element.children) {
      if (!Array.isArray(element.children)) {
        throw new Error(`${errorPrefix} at index ${index} children must be an array`);
      }
    }
  });
}

/**
 * Validates an array of X6 cell tools.
 * Throws on invalid structure.
 */
export function validateCellTools(
  tools: CellTool[] | undefined,
  errorPrefix: string = 'Tool',
): void {
  if (!tools) return;

  tools.forEach((tool, index) => {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error(`${errorPrefix} at index ${index} must have a valid name`);
    }
    if (tool.args && typeof tool.args !== 'object') {
      throw new Error(`${errorPrefix} at index ${index} args must be an object`);
    }
  });
}

/**
 * Compares metadata arrays and custom data for equality.
 * Used by both NodeInfo and EdgeInfo metadataEquals methods.
 */
export function hybridDataEquals(
  thisMetadata: Metadata[],
  otherMetadata: Metadata[],
  thisCustomData: Record<string, any>,
  otherCustomData: Record<string, any>,
): boolean {
  if (thisMetadata.length !== otherMetadata.length) {
    return false;
  }

  // Sort both arrays by key for comparison
  const thisSorted = [...thisMetadata].sort((a, b) => a.key.localeCompare(b.key));
  const otherSorted = [...otherMetadata].sort((a, b) => a.key.localeCompare(b.key));

  // Check metadata equality
  const metadataEqual = thisSorted.every((entry, index) => {
    const otherEntry = otherSorted[index];
    return entry.key === otherEntry.key && entry.value === otherEntry.value;
  });

  return metadataEqual && JSON.stringify(thisCustomData) === JSON.stringify(otherCustomData);
}
