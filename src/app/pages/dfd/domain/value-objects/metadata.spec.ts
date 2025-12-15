import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Metadata,
  safeMetadataEntry,
  recordToMetadata,
  metadataToRecord,
  mergeMetadata,
  filterMetadataByPrefix,
  getMetadataValue,
} from './metadata';

describe('Metadata utilities', () => {
  describe('safeMetadataEntry', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('should return string values as-is without warning', () => {
      const result = safeMetadataEntry('key1', 'value1', 'test');

      expect(result).toEqual({ key: 'key1', value: 'value1' });
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should convert number to string with warning', () => {
      const result = safeMetadataEntry('key1', 42, 'test');

      expect(result).toEqual({ key: 'key1', value: '42' });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Metadata Conversion Warning] Non-string value detected in metadata',
        expect.objectContaining({
          source: 'test',
          key: 'key1',
          valueType: 'number',
          originalValue: 42,
          convertedValue: '42',
          isObject: false,
        }),
      );
    });

    it('should convert boolean to string with warning', () => {
      const result = safeMetadataEntry('key1', true, 'test');

      expect(result).toEqual({ key: 'key1', value: 'true' });
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should convert null to string with warning', () => {
      const result = safeMetadataEntry('key1', null, 'test');

      expect(result).toEqual({ key: 'key1', value: 'null' });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Metadata Conversion Warning] Non-string value detected in metadata',
        expect.objectContaining({
          valueType: 'null',
        }),
      );
    });

    it('should convert undefined to string with warning', () => {
      const result = safeMetadataEntry('key1', undefined, 'test');

      expect(result).toEqual({ key: 'key1', value: 'undefined' });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Metadata Conversion Warning] Non-string value detected in metadata',
        expect.objectContaining({
          valueType: 'undefined',
        }),
      );
    });

    it('should JSON.stringify objects with warning', () => {
      const obj = { nested: 'value', count: 42 };
      const result = safeMetadataEntry('key1', obj, 'test');

      expect(result).toEqual({ key: 'key1', value: JSON.stringify(obj) });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Metadata Conversion Warning] Non-string value detected in metadata',
        expect.objectContaining({
          source: 'test',
          key: 'key1',
          valueType: 'object',
          originalValue: obj,
          convertedValue: JSON.stringify(obj),
          isObject: true,
        }),
      );
    });

    it('should JSON.stringify arrays with warning', () => {
      const arr = [1, 2, 3];
      const result = safeMetadataEntry('key1', arr, 'test');

      expect(result).toEqual({ key: 'key1', value: JSON.stringify(arr) });
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should use "unknown" as source if not provided', () => {
      safeMetadataEntry('key1', 42);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Metadata Conversion Warning] Non-string value detected in metadata',
        expect.objectContaining({
          source: 'unknown',
        }),
      );
    });
  });

  describe('recordToMetadata', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('should convert Record<string, string> to Metadata[]', () => {
      const record = { key1: 'value1', key2: 'value2' };
      const result = recordToMetadata(record);

      expect(result).toEqual([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ]);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle non-string values with warnings', () => {
      const record = { key1: 'value1', key2: 42 as any };
      const result = recordToMetadata(record);

      expect(result).toEqual([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: '42' },
      ]);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle empty record', () => {
      const result = recordToMetadata({});

      expect(result).toEqual([]);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('metadataToRecord', () => {
    it('should convert Metadata[] to Record<string, string>', () => {
      const metadata: Metadata[] = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ];
      const result = metadataToRecord(metadata);

      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should handle empty array', () => {
      const result = metadataToRecord([]);

      expect(result).toEqual({});
    });

    it('should overwrite duplicate keys with last value', () => {
      const metadata: Metadata[] = [
        { key: 'key1', value: 'value1' },
        { key: 'key1', value: 'value2' },
      ];
      const result = metadataToRecord(metadata);

      expect(result).toEqual({ key1: 'value2' });
    });
  });

  describe('mergeMetadata', () => {
    it('should merge multiple metadata arrays', () => {
      const arr1: Metadata[] = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ];
      const arr2: Metadata[] = [
        { key: 'key2', value: 'newValue2' },
        { key: 'key3', value: 'value3' },
      ];

      const result = mergeMetadata(arr1, arr2);

      expect(result).toEqual([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'newValue2' },
        { key: 'key3', value: 'value3' },
      ]);
    });

    it('should handle empty arrays', () => {
      const result = mergeMetadata([], []);

      expect(result).toEqual([]);
    });

    it('should handle single array', () => {
      const arr: Metadata[] = [{ key: 'key1', value: 'value1' }];
      const result = mergeMetadata(arr);

      expect(result).toEqual(arr);
    });
  });

  describe('filterMetadataByPrefix', () => {
    it('should filter metadata by key prefix', () => {
      const metadata: Metadata[] = [
        { key: 'app.name', value: 'MyApp' },
        { key: 'app.version', value: '1.0' },
        { key: 'db.host', value: 'localhost' },
      ];

      const result = filterMetadataByPrefix(metadata, 'app.');

      expect(result).toEqual([
        { key: 'app.name', value: 'MyApp' },
        { key: 'app.version', value: '1.0' },
      ]);
    });

    it('should return empty array if no matches', () => {
      const metadata: Metadata[] = [{ key: 'key1', value: 'value1' }];
      const result = filterMetadataByPrefix(metadata, 'nonexistent');

      expect(result).toEqual([]);
    });

    it('should handle empty array', () => {
      const result = filterMetadataByPrefix([], 'prefix');

      expect(result).toEqual([]);
    });
  });

  describe('getMetadataValue', () => {
    const metadata: Metadata[] = [
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: 'value2' },
    ];

    it('should get metadata value by key', () => {
      const result = getMetadataValue(metadata, 'key1');

      expect(result).toBe('value1');
    });

    it('should return undefined for non-existent key', () => {
      const result = getMetadataValue(metadata, 'nonexistent');

      expect(result).toBeUndefined();
    });

    it('should return default value for non-existent key', () => {
      const result = getMetadataValue(metadata, 'nonexistent', 'default');

      expect(result).toBe('default');
    });

    it('should return actual value even if default is provided', () => {
      const result = getMetadataValue(metadata, 'key1', 'default');

      expect(result).toBe('value1');
    });

    it('should handle empty array', () => {
      const result = getMetadataValue([], 'key', 'default');

      expect(result).toBe('default');
    });
  });
});
