/**
 * Cell Property Filter Utility
 *
 * Provides centralized filtering of cell properties for history and persistence.
 * Implements two-tier filtering:
 *
 * 1. Trigger Filtering: Determines if property changes should trigger history/save
 * 2. Sanitization: Removes excluded properties from cells before storage
 *
 * Uses JSON path notation for property matching.
 */

import { Cell } from '../../../core/types/websocket-message.types';

/**
 * Properties that should NOT trigger history recording or persistence
 * when they are the ONLY properties changed.
 *
 * Uses JSON path notation with wildcards:
 * - $.attrs.body.filter -> matches attrs.body.filter
 * - $.ports.items[*].attrs.circle.style.visibility -> matches any port visibility
 * - $.attrs.*.filter -> matches filter property in any attrs subobject
 */
export const EXCLUDE_FROM_HISTORY_TRIGGERS = [
  // Selection and hover visual effects (any filter in attrs)
  '$.attrs.*.filter',

  // Port visibility (any port in any group)
  '$.ports.items[*].attrs.circle.style.visibility',
  '$.ports.groups.*.attrs.circle.style.visibility',

  // Z-order (always a side effect of other operations)
  '$.zIndex',

  // Tools (AntV X6 selection/manipulation UI)
  '$.tools',
  '$.tools[*]',
] as const;

/**
 * Properties that should be REMOVED from cells before adding to history or persistence.
 * These are stripped from the cell data entirely.
 *
 * Uses JSON path notation with wildcards.
 */
export const SANITIZE_FROM_CELLS = [
  // Visual effect filters (any filter in attrs)
  '$.attrs.*.filter',

  // Port visibility state (runtime-only)
  '$.ports.items[*].attrs.circle.style.visibility',
  '$.ports.groups.*.attrs.circle.style.visibility',

  // Z-order (will be recalculated on load)
  '$.zIndex',

  // Tools property (AntV X6 runtime UI state)
  '$.tools',
] as const;

/**
 * Simple JSON path matcher
 * Supports:
 * - Dot notation: $.attrs.body.filter
 * - Array wildcards: $.ports.items[*].attrs
 * - Object wildcards: $.ports.groups.*.attrs
 * - Prefix matching: $.tools[*] matches tools[0], tools[0].name, etc.
 */
export class JSONPathMatcher {
  /**
   * Convert JSON path to regex pattern
   * If pattern ends with a wildcard, it matches any path starting with that prefix
   */
  private static pathToRegex(path: string, allowPrefixMatch: boolean = true): RegExp {
    // Remove leading $. if present
    let pattern = path.replace(/^\$\./, '');

    // Check if pattern ends with a wildcard (for prefix matching)
    const endsWithWildcard = pattern.endsWith('[*]') || pattern.endsWith('.*');

    // Escape dots for literal matching
    pattern = pattern.replace(/\./g, '\\.');

    // Replace [*] with array index matcher
    pattern = pattern.replace(/\[\*\]/g, '\\[\\d+\\]');

    // Replace .* with property name matcher (but not if it was already processed)
    pattern = pattern.replace(/\\\.\*/g, '\\.[^.\\[]+');

    // If pattern ends with wildcard and prefix matching is allowed,
    // match the prefix and anything after it
    if (endsWithWildcard && allowPrefixMatch) {
      return new RegExp(`^${pattern}(?:\\.|$)`);
    }

    // Otherwise, exact match
    return new RegExp(`^${pattern}$`);
  }

  /**
   * Check if a property path matches a JSON path pattern
   */
  static matches(propertyPath: string, jsonPathPattern: string): boolean {
    const regex = this.pathToRegex(jsonPathPattern);
    return regex.test(propertyPath);
  }

  /**
   * Check if any of multiple patterns match
   */
  static matchesAny(propertyPath: string, jsonPathPatterns: readonly string[]): boolean {
    return jsonPathPatterns.some(pattern => this.matches(propertyPath, pattern));
  }
}

/**
 * Extract all property paths from a change object
 * Flattens nested object into dot-notation paths
 * @param onlyLeafPaths If true, only returns leaf paths (actual changed values), not intermediate paths
 */
export function extractPropertyPaths(
  obj: Record<string, any>,
  prefix = '',
  onlyLeafPaths = false,
): Set<string> {
  const paths = new Set<string>();

  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    // Recursively extract from nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Add intermediate path only if not leaf-only mode
      if (!onlyLeafPaths) {
        paths.add(path);
      }
      const nestedPaths = extractPropertyPaths(value, path, onlyLeafPaths);
      nestedPaths.forEach(p => paths.add(p));
    }
    // Handle arrays
    else if (Array.isArray(value)) {
      // Add intermediate path only if not leaf-only mode
      if (!onlyLeafPaths) {
        paths.add(path);
      }
      value.forEach((item, index) => {
        const arrayPath = `${path}[${index}]`;

        if (item && typeof item === 'object') {
          const nestedPaths = extractPropertyPaths(item, arrayPath, onlyLeafPaths);
          nestedPaths.forEach(p => paths.add(p));
        } else {
          // Leaf value in array
          paths.add(arrayPath);
        }
      });
    }
    // Leaf value (primitive or null)
    else {
      paths.add(path);
    }
  }

  return paths;
}

/**
 * Determine if property changes should trigger history/persistence
 *
 * Returns false if ALL changed properties are in the exclusion list.
 * Returns true if ANY changed property is NOT in the exclusion list.
 */
export function shouldTriggerHistoryOrPersistence(previousCell: Cell, currentCell: Cell): boolean {
  // Build a change object containing only changed properties
  const changes = buildChangeObject(previousCell, currentCell);

  // Extract only leaf property paths (actual changed values, not intermediate paths)
  // This prevents intermediate paths like 'attrs' or 'attrs.body' from being checked
  const changedPaths = extractPropertyPaths(changes, '', true);

  if (changedPaths.size === 0) {
    // No changes detected
    return false;
  }

  // Check if ALL changed paths are excluded
  const allExcluded = Array.from(changedPaths).every(path =>
    JSONPathMatcher.matchesAny(path, EXCLUDE_FROM_HISTORY_TRIGGERS),
  );

  // Trigger history/persistence if at least one property is NOT excluded
  return !allExcluded;
}

/**
 * Build an object containing only the changed properties between two cells
 * Recursively compares nested objects to only include actually changed leaf values
 */
function buildChangeObject(
  previous: Cell | Record<string, any>,
  current: Cell | Record<string, any>,
): Record<string, any> {
  const changes: Record<string, any> = {};

  // Compare all keys in current cell
  for (const key in current) {
    if (!Object.prototype.hasOwnProperty.call(current, key)) continue;

    const currentValue = current[key];
    const previousValue = previous[key];

    // If values differ
    if (!deepEqual(previousValue, currentValue)) {
      // Handle arrays - compare element by element
      if (Array.isArray(currentValue) && Array.isArray(previousValue)) {
        const arrayChanges: any[] = [];
        const maxLength = Math.max(currentValue.length, previousValue.length);

        for (let i = 0; i < maxLength; i++) {
          if (i >= currentValue.length) {
            // Element was removed (array got shorter)
            arrayChanges[i] = undefined;
          } else if (i >= previousValue.length) {
            // Element was added (array got longer)
            arrayChanges[i] = currentValue[i];
          } else if (!deepEqual(previousValue[i], currentValue[i])) {
            // Element changed
            if (
              currentValue[i] &&
              previousValue[i] &&
              typeof currentValue[i] === 'object' &&
              typeof previousValue[i] === 'object'
            ) {
              // Recursively compare objects in array
              arrayChanges[i] = buildChangeObject(previousValue[i], currentValue[i]);
            } else {
              arrayChanges[i] = currentValue[i];
            }
          }
        }

        if (arrayChanges.some(item => item !== undefined)) {
          changes[key] = arrayChanges;
        }
      }
      // If both are objects (not arrays), recursively compare
      else if (
        currentValue &&
        previousValue &&
        typeof currentValue === 'object' &&
        typeof previousValue === 'object' &&
        !Array.isArray(currentValue) &&
        !Array.isArray(previousValue)
      ) {
        const nestedChanges = buildChangeObject(previousValue, currentValue);
        if (Object.keys(nestedChanges).length > 0) {
          changes[key] = nestedChanges;
        }
      } else {
        // Primitive value changed, or one side is null/undefined, or types differ
        changes[key] = currentValue;
      }
    }
  }

  // Check for deleted keys (in previous but not in current)
  for (const key in previous) {
    if (!Object.prototype.hasOwnProperty.call(previous, key)) continue;
    if (!(key in current)) {
      changes[key] = undefined; // Deletion
    }
  }

  return changes;
}

/**
 * Deep equality check for objects
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => deepEqual(item, b[index]));
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Remove excluded properties from a cell (deep clone and sanitize)
 *
 * Creates a new cell object with excluded properties removed based on
 * SANITIZE_FROM_CELLS configuration.
 */
export function sanitizeCell(cell: Cell): Cell {
  // Deep clone the cell
  const sanitized = JSON.parse(JSON.stringify(cell)) as Cell;

  // Remove properties matching sanitization patterns
  SANITIZE_FROM_CELLS.forEach(pattern => {
    removePropertyByPath(sanitized, pattern);
  });

  return sanitized;
}

/**
 * Remove a property from an object by JSON path pattern
 */
function removePropertyByPath(obj: any, jsonPathPattern: string): void {
  // Remove leading $. if present
  const path = jsonPathPattern.replace(/^\$\./, '');

  // Split path into segments
  const segments = path.split(/\.|\[|\]/).filter(s => s.length > 0);

  removePropertyRecursive(obj, segments, 0, jsonPathPattern);
}

/**
 * Recursively remove properties matching a path pattern
 */
function removePropertyRecursive(
  obj: any,
  segments: string[],
  index: number,
  originalPattern: string,
): void {
  if (!obj || typeof obj !== 'object') return;
  if (index >= segments.length) return;

  const segment = segments[index];
  const isLastSegment = index === segments.length - 1;

  // Handle wildcard
  if (segment === '*') {
    // Object wildcard - iterate all keys
    Object.keys(obj).forEach(key => {
      if (isLastSegment) {
        delete obj[key];
      } else {
        removePropertyRecursive(obj[key], segments, index + 1, originalPattern);
      }
    });
  }
  // Handle array index or wildcard
  else if (Array.isArray(obj)) {
    obj.forEach(item => {
      if (isLastSegment) {
        // Don't delete array items, just recurse into them
        removePropertyRecursive(item, segments, index + 1, originalPattern);
      } else {
        removePropertyRecursive(item, segments, index + 1, originalPattern);
      }
    });
  }
  // Handle specific property
  else if (segment in obj) {
    if (isLastSegment) {
      delete obj[segment];
    } else {
      removePropertyRecursive(obj[segment], segments, index + 1, originalPattern);
    }
  }
}

/**
 * Sanitize an array of cells
 */
export function sanitizeCells(cells: Cell[]): Cell[] {
  return cells.map(cell => sanitizeCell(cell));
}

/**
 * Check if a specific property path should be excluded from triggers
 */
export function isPropertyExcludedFromTriggers(propertyPath: string): boolean {
  return JSONPathMatcher.matchesAny(propertyPath, EXCLUDE_FROM_HISTORY_TRIGGERS);
}

/**
 * Check if a specific property path should be sanitized
 */
export function isPropertySanitized(propertyPath: string): boolean {
  return JSONPathMatcher.matchesAny(propertyPath, SANITIZE_FROM_CELLS);
}
