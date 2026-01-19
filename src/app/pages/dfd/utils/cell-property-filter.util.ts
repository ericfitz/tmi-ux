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

    // Use placeholders for wildcards before escaping metacharacters
    // This ensures wildcards are preserved through the escaping process
    const ARRAY_WILDCARD = '\x00ARRAY_WILDCARD\x00';
    const OBJECT_WILDCARD = '\x00OBJECT_WILDCARD\x00';

    // Replace wildcards with placeholders
    pattern = pattern.replace(/\[\*\]/g, ARRAY_WILDCARD);
    pattern = pattern.replace(/\.\*/g, OBJECT_WILDCARD);

    // Escape all regex metacharacters (including backslashes) for safe regex construction
    // This prevents regex injection if untrusted input is ever passed to this method
    pattern = pattern.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

    // Restore wildcards with their regex equivalents
    pattern = pattern.replace(new RegExp(ARRAY_WILDCARD, 'g'), '\\[\\d+\\]');
    pattern = pattern.replace(new RegExp(OBJECT_WILDCARD, 'g'), '\\.[^.\\[]+');

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

// =============================================================================
// API Schema Compliance Filtering
// =============================================================================
// These functions filter cells to match the OpenAPI schema requirements.
// Unlike the persistence sanitization above, this is about strict schema compliance.

/**
 * Properties allowed on base Cell (per OpenAPI schema).
 * Note: visible, markup, and zIndex are excluded because:
 * - visible: auto-calculated by DFD editor
 * - zIndex: auto-calculated by DFD editor
 * - markup: potential security concern (allows arbitrary SVG/HTML)
 */
const CELL_ALLOWED_FIELDS = ['id', 'shape', 'data'] as const;

/**
 * Properties allowed on Node cells (extends Cell).
 * Per OpenAPI schema: position, size, x, y, width, height, angle, attrs, ports, parent
 * Note: 'children' is included for X6 parent-child relationships (pending API schema update)
 */
const NODE_ALLOWED_FIELDS = [
  ...CELL_ALLOWED_FIELDS,
  'position',
  'size',
  'x',
  'y',
  'width',
  'height',
  'angle',
  'attrs',
  'ports',
  'parent',
  'children',
] as const;

/**
 * Properties allowed on Edge cells (extends Cell).
 * Per OpenAPI schema: source, target, attrs, labels, vertices, router, connector, defaultLabel
 */
const EDGE_ALLOWED_FIELDS = [
  ...CELL_ALLOWED_FIELDS,
  'source',
  'target',
  'attrs',
  'labels',
  'vertices',
  'router',
  'connector',
  'defaultLabel',
] as const;

/**
 * Properties that are known-transient and should be silently filtered without warning.
 * These are expected in X6 exports but not part of the API schema.
 */
const KNOWN_TRANSIENT_FIELDS = [
  'tools', // X6 runtime UI state
  'type', // X6 internal, redundant with 'shape'
  'selected', // UI state
  'highlighted', // UI state
  'visible', // auto-calculated by DFD editor
  'zIndex', // auto-calculated by DFD editor
  'markup', // potential security concern (allows arbitrary SVG/HTML)
] as const;

/**
 * Shape values that indicate an X6 Edge.
 * - 'flow' is the canonical TMI shape for data flows (preferred)
 * - 'edge' is the legacy X6 shape (supported for backwards compatibility)
 */
const EDGE_SHAPES = ['edge', 'flow'] as const;

/**
 * The canonical shape value for edges in TMI.
 * All edges should use this shape; 'edge' is only for backwards compatibility.
 */
export const CANONICAL_EDGE_SHAPE = 'flow' as const;

/**
 * Check if a shape value represents an edge (X6 Edge).
 * Returns true for both 'flow' (canonical) and 'edge' (legacy).
 */
export function isEdgeShape(shape: string | undefined): boolean {
  return shape !== undefined && (EDGE_SHAPES as readonly string[]).includes(shape);
}

/**
 * Allowed properties within NodeAttrs per OpenAPI schema.
 * NodeAttrs has additionalProperties: false
 */
const NODE_ATTRS_SCHEMA: Record<string, readonly string[]> = {
  body: ['fill', 'stroke', 'strokeWidth', 'strokeDasharray'],
  text: ['text', 'fontSize', 'fill', 'fontFamily'],
};

/**
 * Allowed properties within EdgeAttrs per OpenAPI schema.
 * EdgeAttrs has additionalProperties: false
 */
const EDGE_ATTRS_SCHEMA: Record<string, readonly string[] | Record<string, readonly string[]>> = {
  line: {
    _direct: ['stroke', 'strokeWidth', 'strokeDasharray'],
    targetMarker: ['name', 'size'],
    sourceMarker: ['name', 'size'],
  },
};

/**
 * Logger interface for warning about unknown properties.
 */
export interface ApiSanitizationLogger {
  warn(message: string, context?: Record<string, unknown>): void;
}

/**
 * Filter an attrs object to match NodeAttrs schema.
 * Removes any properties not in the schema.
 */
function filterNodeAttrs(
  attrs: Record<string, unknown>,
  logger?: ApiSanitizationLogger,
  cellId?: string,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};

  for (const [selectorKey, selectorValue] of Object.entries(attrs)) {
    if (!(selectorKey in NODE_ATTRS_SCHEMA)) {
      // Unknown selector - log warning
      if (logger) {
        logger.warn(`Unknown attrs selector '${selectorKey}' removed from node`, {
          cellId,
          selector: selectorKey,
        });
      }
      continue;
    }

    if (typeof selectorValue !== 'object' || selectorValue === null) {
      continue;
    }

    const allowedProps = NODE_ATTRS_SCHEMA[selectorKey];
    const filteredSelector: Record<string, unknown> = {};

    for (const [propKey, propValue] of Object.entries(selectorValue as Record<string, unknown>)) {
      if (allowedProps.includes(propKey)) {
        filteredSelector[propKey] = propValue;
      } else if (propKey !== 'filter') {
        // 'filter' is silently removed (known transient), others get warnings
        if (logger) {
          logger.warn(`Unknown attrs property '${selectorKey}.${propKey}' removed from node`, {
            cellId,
            selector: selectorKey,
            property: propKey,
          });
        }
      }
    }

    if (Object.keys(filteredSelector).length > 0) {
      filtered[selectorKey] = filteredSelector;
    }
  }

  return filtered;
}

/**
 * Filter an attrs object to match EdgeAttrs schema.
 * Removes any properties not in the schema.
 */
function filterEdgeAttrs(
  attrs: Record<string, unknown>,
  logger?: ApiSanitizationLogger,
  cellId?: string,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};

  for (const [selectorKey, selectorValue] of Object.entries(attrs)) {
    if (selectorKey !== 'line') {
      // Unknown selector - log warning
      if (logger) {
        logger.warn(`Unknown attrs selector '${selectorKey}' removed from edge`, {
          cellId,
          selector: selectorKey,
        });
      }
      continue;
    }

    if (typeof selectorValue !== 'object' || selectorValue === null) {
      continue;
    }

    const lineSchema = EDGE_ATTRS_SCHEMA['line'] as Record<
      string,
      readonly string[] | Record<string, readonly string[]>
    >;
    const directProps = lineSchema['_direct'] as readonly string[];
    const filteredLine: Record<string, unknown> = {};

    for (const [propKey, propValue] of Object.entries(selectorValue as Record<string, unknown>)) {
      if (directProps.includes(propKey)) {
        filteredLine[propKey] = propValue;
      } else if (propKey === 'targetMarker' || propKey === 'sourceMarker') {
        // Handle marker objects
        if (typeof propValue === 'object' && propValue !== null) {
          const markerAllowed = lineSchema[propKey] as readonly string[];
          const filteredMarker: Record<string, unknown> = {};

          for (const [markerKey, markerValue] of Object.entries(
            propValue as Record<string, unknown>,
          )) {
            if (markerAllowed.includes(markerKey)) {
              filteredMarker[markerKey] = markerValue;
            } else if (logger) {
              logger.warn(
                `Unknown marker property '${propKey}.${markerKey}' removed from edge attrs`,
                { cellId, property: `${propKey}.${markerKey}` },
              );
            }
          }

          if (Object.keys(filteredMarker).length > 0) {
            filteredLine[propKey] = filteredMarker;
          }
        }
      } else if (propKey !== 'filter') {
        // 'filter' is silently removed (known transient), others get warnings
        if (logger) {
          logger.warn(`Unknown attrs property 'line.${propKey}' removed from edge`, {
            cellId,
            property: propKey,
          });
        }
      }
    }

    if (Object.keys(filteredLine).length > 0) {
      filtered['line'] = filteredLine;
    }
  }

  return filtered;
}

/**
 * Sanitize a single cell for API submission.
 *
 * This function:
 * 1. Filters top-level properties to only those allowed by the schema
 * 2. Silently removes known-transient properties (tools, type, children, etc.)
 * 3. Logs warnings for unknown properties being removed
 * 4. Deep-filters attrs to match NodeAttrs/EdgeAttrs schema
 *
 * @param cell The cell to sanitize
 * @param logger Optional logger for warning about unknown properties
 * @returns Sanitized cell ready for API submission
 */
export function sanitizeCellForApi(cell: Cell, logger?: ApiSanitizationLogger): Cell {
  const cellId = cell.id;
  const isEdge = isEdgeShape(cell.shape);
  const allowedFields = isEdge ? EDGE_ALLOWED_FIELDS : NODE_ALLOWED_FIELDS;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(cell)) {
    // Check if this is an allowed field
    if ((allowedFields as readonly string[]).includes(key)) {
      // Special handling for attrs - deep filter
      if (key === 'attrs' && typeof value === 'object' && value !== null) {
        const filteredAttrs = isEdge
          ? filterEdgeAttrs(value as Record<string, unknown>, logger, cellId)
          : filterNodeAttrs(value as Record<string, unknown>, logger, cellId);

        if (Object.keys(filteredAttrs).length > 0) {
          sanitized[key] = filteredAttrs;
        }
      } else {
        sanitized[key] = value;
      }
    } else if ((KNOWN_TRANSIENT_FIELDS as readonly string[]).includes(key)) {
      // Silently skip known transient fields
      continue;
    } else {
      // Unknown field - log warning
      if (logger) {
        logger.warn(`Unknown property '${key}' removed from ${isEdge ? 'edge' : 'node'}`, {
          cellId,
          property: key,
        });
      }
    }
  }

  // Normalize edge shape to canonical 'flow' (convert legacy 'edge' to 'flow')
  if (isEdge) {
    sanitized['shape'] = CANONICAL_EDGE_SHAPE;
  }

  return sanitized as Cell;
}

/**
 * Convert children arrays to parent references.
 *
 * X6 may export cells with a 'children' array on parent nodes.
 * The API expects child nodes to have a 'parent' reference instead.
 * This function builds a parent lookup and sets parent references on child cells.
 *
 * @param cells Array of cells to process
 * @returns Cells with children converted to parent references
 */
function convertChildrenToParent(cells: Cell[]): Cell[] {
  // Build a map of cell ID -> parent ID from children arrays
  const parentMap = new Map<string, string>();

  for (const cell of cells) {
    const children = (cell as Record<string, unknown>)['children'] as string[] | undefined;
    if (Array.isArray(children)) {
      for (const childId of children) {
        if (typeof childId === 'string') {
          parentMap.set(childId, cell.id);
        }
      }
    }
  }

  // Apply parent references to child cells
  return cells.map(cell => {
    const parentId = parentMap.get(cell.id);
    if (parentId && !cell['parent']) {
      // Only set parent if not already set
      return { ...cell, parent: parentId };
    }
    return cell;
  });
}

/**
 * Sanitize an array of cells for API submission with children-to-parent conversion.
 *
 * This function:
 * 1. Converts 'children' arrays on parent cells to 'parent' references on child cells
 * 2. Applies sanitizeCellForApi() to each cell
 *
 * @param cells Array of cells to sanitize
 * @param logger Optional logger for warning about unknown properties
 * @returns Array of sanitized cells ready for API submission
 */
export function sanitizeCellsForApi(cells: Cell[], logger?: ApiSanitizationLogger): Cell[] {
  // First convert children to parent references
  const withParentRefs = convertChildrenToParent(cells);

  // Then sanitize each cell
  return withParentRefs.map(cell => sanitizeCellForApi(cell, logger));
}

/**
 * Normalize a cell's edge shape from legacy 'edge' to canonical 'flow'.
 * Use this when receiving cells from the server or during import.
 *
 * @param cell The cell to normalize
 * @returns Cell with normalized shape (edge → flow)
 */
export function normalizeEdgeShape<T extends { shape?: string }>(cell: T): T {
  if (cell.shape === 'edge') {
    return { ...cell, shape: CANONICAL_EDGE_SHAPE };
  }
  return cell;
}

/**
 * Normalize edge shapes for an array of cells.
 * Converts legacy 'edge' shape to canonical 'flow'.
 *
 * @param cells Array of cells to normalize
 * @returns Array of cells with normalized shapes
 */
export function normalizeCellShapes<T extends { shape?: string }>(cells: T[]): T[] {
  return cells.map(normalizeEdgeShape);
}
