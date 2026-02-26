/**
 * Safe JSON stringification utility
 *
 * Handles circular references, DOM elements, functions, and large objects
 * by applying configurable limits and providing meaningful placeholders.
 */

export interface SafeStringifyOptions {
  maxArrayLength?: number;
  maxProperties?: number;
}

const DEFAULT_OPTIONS: Required<SafeStringifyOptions> = {
  maxArrayLength: 100,
  maxProperties: 50,
};

/**
 * Safely stringify an object, handling circular references, DOM elements,
 * functions, and large arrays/objects with configurable limits.
 */
export function safeStringify(
  obj: unknown,
  indent: number = 0,
  options?: SafeStringifyOptions,
): string {
  const { maxArrayLength, maxProperties } = { ...DEFAULT_OPTIONS, ...options };
  const seen = new WeakSet();

  const replacerFunction = (_key: string, value: unknown): unknown => {
    // Handle null and undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle primitive types
    if (typeof value !== 'object') {
      return value;
    }

    // Handle circular references
    if (seen.has(value)) {
      return '[Circular Reference]';
    }

    seen.add(value);

    // Handle functions (typeof check already happened above, but value could
    // have been returned from a getter that changed type)
    if (typeof value === 'function') {
      const fnName = (value as { name?: string }).name || 'anonymous';
      return `[Function: ${fnName}]`;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length > maxArrayLength) {
        return [
          ...(value as unknown[]).slice(0, maxArrayLength),
          `[... ${value.length - maxArrayLength} more items]`,
        ];
      }
      return value;
    }

    // Handle DOM elements and complex objects
    if (value instanceof Element || value instanceof Node) {
      return `[DOM Element: ${value.constructor.name}]`;
    }

    // Handle objects with too many properties (to prevent huge output)
    const record = value as Record<string, unknown>;
    if (record.constructor === Object) {
      const keys = Object.keys(record);
      if (keys.length > maxProperties) {
        const limitedObj: Record<string, unknown> = {};
        keys.slice(0, maxProperties).forEach(key => {
          limitedObj[key] = record[key];
        });
        limitedObj['...'] = `[${keys.length - maxProperties} more properties]`;
        return limitedObj;
      }
    }

    return value;
  };

  try {
    return JSON.stringify(obj, replacerFunction, indent);
  } catch (error) {
    const objRecord = obj as Record<string, unknown> | null | undefined;
    const ctorName =
      objRecord != null &&
      typeof objRecord === 'object' &&
      'constructor' in objRecord &&
      typeof (objRecord.constructor as { name?: string })?.name === 'string'
        ? (objRecord.constructor as { name: string }).name
        : 'unknown';
    return JSON.stringify(
      {
        error: 'Failed to serialize object',
        message: error instanceof Error ? error.message : 'Unknown error',
        objectType: typeof obj,
        constructor: ctorName,
      },
      null,
      indent,
    );
  }
}
