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
// SEM@995ab845b9ceb5559017adb7a615abe220bc344f: match property paths against JSONPath patterns with wildcard support (pure)
export class JSONPathMatcher {
  /**
   * Convert JSON path to regex pattern
   * If pattern ends with a wildcard, it matches any path starting with that prefix
   */
  // SEM@995ab845b9ceb5559017adb7a615abe220bc344f: convert a JSONPath pattern string to a matching regex (pure)
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
  // SEM@0a67b9a67611e3f83e79aa9a869abed3e6e57dd2: check if a property path matches a single JSONPath pattern (pure)
  static matches(propertyPath: string, jsonPathPattern: string): boolean {
    const regex = this.pathToRegex(jsonPathPattern);
    return regex.test(propertyPath);
  }

  /**
   * Check if any of multiple patterns match
   */
  // SEM@0a67b9a67611e3f83e79aa9a869abed3e6e57dd2: check if a property path matches any of a list of JSONPath patterns (pure)
  static matchesAny(propertyPath: string, jsonPathPatterns: readonly string[]): boolean {
    return jsonPathPatterns.some(pattern => this.matches(propertyPath, pattern));
  }
}

/**
 * Extract all property paths from a change object
 * Flattens nested object into dot-notation paths
 * @param onlyLeafPaths If true, only returns leaf paths (actual changed values), not intermediate paths
 */
// SEM@2eb446269a91d26a3d401a7c06a33fbf524a4a57: flatten a nested object into a set of dot-notation property paths (pure)
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
// SEM@2eb446269a91d26a3d401a7c06a33fbf524a4a57: determine if cell property changes should trigger history or persistence (pure)
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
// SEM@9bbddd20c1a355788e020707ed179a55cd0de167: build a diff object of changed properties between two cell snapshots (pure)
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

    if (deepEqual(previousValue, currentValue)) continue;

    const change = compareValues(previousValue, currentValue);
    if (change !== undefined) {
      changes[key] = change;
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
 * Compare two non-equal values and return the change representation.
 * Returns undefined if there's no meaningful change to record.
 */
// SEM@9bbddd20c1a355788e020707ed179a55cd0de167: compute the change representation between two non-equal values (pure)
function compareValues(previousValue: any, currentValue: any): any {
  // Handle arrays - compare element by element
  if (Array.isArray(currentValue) && Array.isArray(previousValue)) {
    return compareArrayElements(previousValue, currentValue);
  }

  // If both are plain objects, recursively compare
  if (areBothPlainObjects(previousValue, currentValue)) {
    const nestedChanges = buildChangeObject(previousValue, currentValue);
    return Object.keys(nestedChanges).length > 0 ? nestedChanges : undefined;
  }

  // Primitive value changed, one side is null/undefined, or types differ
  return currentValue;
}

/**
 * Compare two arrays element by element, returning only changed elements.
 * Returns undefined if no elements changed.
 */
// SEM@9bbddd20c1a355788e020707ed179a55cd0de167: diff two arrays element by element, returning changed positions (pure)
function compareArrayElements(previousArr: any[], currentArr: any[]): any[] | undefined {
  const arrayChanges: any[] = [];
  const maxLength = Math.max(currentArr.length, previousArr.length);

  for (let i = 0; i < maxLength; i++) {
    if (i >= currentArr.length) {
      arrayChanges[i] = undefined; // Element was removed
    } else if (i >= previousArr.length) {
      arrayChanges[i] = currentArr[i]; // Element was added
    } else if (!deepEqual(previousArr[i], currentArr[i])) {
      arrayChanges[i] = areBothPlainObjects(previousArr[i], currentArr[i])
        ? buildChangeObject(previousArr[i], currentArr[i])
        : currentArr[i];
    }
  }

  return arrayChanges.some(item => item !== undefined) ? arrayChanges : undefined;
}

/**
 * Check if both values are non-null, non-array objects (plain objects).
 */
// SEM@9bbddd20c1a355788e020707ed179a55cd0de167: check if both values are non-null, non-array plain objects (pure)
function areBothPlainObjects(a: any, b: any): boolean {
  return (
    a != null &&
    b != null &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  );
}

/**
 * Deep equality check for objects
 */
// SEM@0a67b9a67611e3f83e79aa9a869abed3e6e57dd2: recursively compare two values for deep structural equality (pure)
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
// SEM@0a67b9a67611e3f83e79aa9a869abed3e6e57dd2: deep-clone a cell and remove excluded runtime properties (pure)
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
// SEM@0a67b9a67611e3f83e79aa9a869abed3e6e57dd2: delete a property from an object by JSONPath pattern (mutates shared state)
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
// SEM@2eb446269a91d26a3d401a7c06a33fbf524a4a57: recursively delete properties matching a path pattern from an object (mutates shared state)
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
// SEM@0a67b9a67611e3f83e79aa9a869abed3e6e57dd2: deep-clone and remove excluded runtime properties from an array of cells (pure)
export function sanitizeCells(cells: Cell[]): Cell[] {
  return cells.map(cell => sanitizeCell(cell));
}

/**
 * Check if a specific property path should be excluded from triggers
 */
// SEM@0a67b9a67611e3f83e79aa9a869abed3e6e57dd2: check if a property path is excluded from history and persistence triggers (pure)
export function isPropertyExcludedFromTriggers(propertyPath: string): boolean {
  return JSONPathMatcher.matchesAny(propertyPath, EXCLUDE_FROM_HISTORY_TRIGGERS);
}

/**
 * Check if a specific property path should be sanitized
 */
// SEM@0a67b9a67611e3f83e79aa9a869abed3e6e57dd2: check if a property path matches the sanitization exclusion list (pure)
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
// SEM@d53281fb3bf4a52e7eeab3b867f86300c3fbf591: validate a shape string as a known edge shape, including legacy aliases (pure)
export function isEdgeShape(shape: string | undefined): boolean {
  return shape !== undefined && (EDGE_SHAPES as readonly string[]).includes(shape);
}

/**
 * Allowed properties within NodeAttrs per OpenAPI schema.
 * NodeAttrs has additionalProperties: false. Mirrors the server-side
 * NodeAttrs schema in tmi-openapi.json.
 *
 * body: rx/ry are corner-radius defaults set by X6 shape registrations;
 * lateral drives the cylinder path computation for the 'store' shape;
 * refWidth/refHeight let the body fill the cell bounding box; fillOpacity
 * is used as transient drag-to-embed visual feedback.
 *
 * text: refX2/refY2 are origin-based offsets used for icon and label
 * positioning. refDx/refDy are corner-based offsets, retained for
 * backward compatibility with diagrams saved before the schema was
 * corrected.
 */
const NODE_ATTRS_SCHEMA: Record<string, readonly string[]> = {
  body: [
    'fill',
    'stroke',
    'strokeWidth',
    'strokeDasharray',
    'rx',
    'ry',
    'lateral',
    'refWidth',
    'refHeight',
    'fillOpacity',
  ],
  text: [
    'text',
    'fontSize',
    'fill',
    'fontFamily',
    'refX',
    'refY',
    'refDx',
    'refDy',
    'refX2',
    'refY2',
    'textAnchor',
    'textVerticalAnchor',
  ],
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
interface ApiSanitizationLogger {
  // SEM@a91514ef0d60c68d539e3d6ba9a8e2fdd27bc815: notify caller of an unknown property removed during API sanitization (pure)
  warn(message: string, context?: Record<string, unknown>): void;
}

/**
 * Filter an attrs object to match NodeAttrs schema.
 * Removes any properties not in the schema.
 */
// SEM@6a2a2eed4c2f7de5b5415d297960349ccb688aa7: filter a node attrs object to only schema-allowed selectors and properties (pure)
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
// SEM@a91514ef0d60c68d539e3d6ba9a8e2fdd27bc815: filter an edge attrs object to only schema-allowed line properties and markers (pure)
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
// SEM@d53281fb3bf4a52e7eeab3b867f86300c3fbf591: sanitize a single diagram cell for API submission, stripping non-schema fields (pure)
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
// SEM@a91514ef0d60c68d539e3d6ba9a8e2fdd27bc815: convert X6 children arrays on parent cells to parent references on child cells (pure)
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
// SEM@a91514ef0d60c68d539e3d6ba9a8e2fdd27bc815: sanitize an array of diagram cells for API submission with parent-ref conversion (pure)
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
// SEM@d53281fb3bf4a52e7eeab3b867f86300c3fbf591: convert a legacy 'edge' shape value to canonical 'flow' on a single cell (pure)
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
// SEM@d53281fb3bf4a52e7eeab3b867f86300c3fbf591: convert legacy 'edge' shape values to canonical 'flow' across a cell array (pure)
export function normalizeCellShapes<T extends { shape?: string }>(cells: T[]): T[] {
  return cells.map(normalizeEdgeShape);
}
