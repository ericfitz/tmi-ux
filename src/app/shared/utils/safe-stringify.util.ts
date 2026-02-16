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
  obj: any,
  indent: number = 0,
  options?: SafeStringifyOptions,
): string {
  const { maxArrayLength, maxProperties } = { ...DEFAULT_OPTIONS, ...options };
  const seen = new WeakSet();

  const replacerFunction = (_key: string, value: any): any => {
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

    // Handle functions
    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length > maxArrayLength) {
        return [
          ...value.slice(0, maxArrayLength),
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
    if (typeof value === 'object' && value.constructor === Object) {
      const keys = Object.keys(value);
      if (keys.length > maxProperties) {
        const limitedObj: any = {};
        keys.slice(0, maxProperties).forEach(key => {
          limitedObj[key] = value[key];
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
    return JSON.stringify(
      {
        error: 'Failed to serialize object',
        message: error instanceof Error ? error.message : 'Unknown error',
        objectType: typeof obj,
        constructor: obj?.constructor?.name || 'unknown',
      },
      null,
      indent,
    );
  }
}
