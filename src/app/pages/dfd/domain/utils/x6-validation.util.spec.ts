import { describe, it, expect } from 'vitest';
import type { CellTool, MarkupElement } from '../value-objects/x6-types';
import { validateMarkupElements, validateCellTools, hybridDataEquals } from './x6-validation.util';

describe('validateMarkupElements', () => {
  it('should accept valid markup elements', () => {
    expect(() =>
      validateMarkupElements([
        { tagName: 'rect', selector: 'body', attrs: { fill: '#fff' } },
        { tagName: 'text', selector: 'label' },
      ]),
    ).not.toThrow();
  });

  it('should accept undefined markup', () => {
    expect(() => validateMarkupElements(undefined)).not.toThrow();
  });

  it('should accept empty markup array', () => {
    expect(() => validateMarkupElements([])).not.toThrow();
  });

  it('should throw on missing tagName', () => {
    expect(() => validateMarkupElements([{ tagName: '' }])).toThrow(
      'Markup element at index 0 must have a valid tagName',
    );
  });

  it('should throw on non-string selector', () => {
    // Deliberately malformed element
    const element = { tagName: 'rect', selector: 123 } as unknown as MarkupElement;
    expect(() => validateMarkupElements([element])).toThrow(
      'Markup element at index 0 selector must be a string',
    );
  });

  it('should throw on non-object attrs', () => {
    // Deliberately malformed element
    const element = { tagName: 'rect', attrs: 'invalid' } as unknown as MarkupElement;
    expect(() => validateMarkupElements([element])).toThrow(
      'Markup element at index 0 attrs must be an object',
    );
  });

  it('should throw on non-array children', () => {
    // Deliberately malformed element
    const element = { tagName: 'rect', children: 'invalid' } as unknown as MarkupElement;
    expect(() => validateMarkupElements([element])).toThrow(
      'Markup element at index 0 children must be an array',
    );
  });

  it('should accept elements with array children', () => {
    expect(() =>
      validateMarkupElements([{ tagName: 'g', children: [{ tagName: 'rect' }] }]),
    ).not.toThrow();
  });

  it('should use custom error prefix', () => {
    expect(() => validateMarkupElements([{ tagName: '' }], 'Edge markup element')).toThrow(
      'Edge markup element at index 0 must have a valid tagName',
    );
  });
});

describe('validateCellTools', () => {
  it('should accept valid tools', () => {
    expect(() =>
      validateCellTools([{ name: 'boundary', args: { distance: 10 } }, { name: 'button' }]),
    ).not.toThrow();
  });

  it('should accept undefined tools', () => {
    expect(() => validateCellTools(undefined)).not.toThrow();
  });

  it('should accept empty tools array', () => {
    expect(() => validateCellTools([])).not.toThrow();
  });

  it('should throw on missing name', () => {
    expect(() => validateCellTools([{ name: '' }])).toThrow(
      'Tool at index 0 must have a valid name',
    );
  });

  it('should throw on non-object args', () => {
    // Deliberately malformed input: args is a string, which the CellTool type forbids
    const tool = { name: 'boundary', args: 'invalid' } as unknown as CellTool;
    expect(() => validateCellTools([tool])).toThrow('Tool at index 0 args must be an object');
  });

  it('should use custom error prefix', () => {
    expect(() => validateCellTools([{ name: '' }], 'Edge tool')).toThrow(
      'Edge tool at index 0 must have a valid name',
    );
  });
});

describe('hybridDataEquals', () => {
  it('should return true for equal metadata and custom data', () => {
    const result = hybridDataEquals(
      [
        { key: 'a', value: '1' },
        { key: 'b', value: '2' },
      ],
      [
        { key: 'b', value: '2' },
        { key: 'a', value: '1' },
      ],
      { foo: 'bar' },
      { foo: 'bar' },
    );
    expect(result).toBe(true);
  });

  it('should return false for different metadata lengths', () => {
    const result = hybridDataEquals([{ key: 'a', value: '1' }], [], {}, {});
    expect(result).toBe(false);
  });

  it('should return false for different metadata values', () => {
    const result = hybridDataEquals([{ key: 'a', value: '1' }], [{ key: 'a', value: '2' }], {}, {});
    expect(result).toBe(false);
  });

  it('should return false for different custom data', () => {
    const result = hybridDataEquals(
      [{ key: 'a', value: '1' }],
      [{ key: 'a', value: '1' }],
      { foo: 'bar' },
      { foo: 'baz' },
    );
    expect(result).toBe(false);
  });

  it('should handle empty metadata arrays', () => {
    const result = hybridDataEquals([], [], { x: 1 }, { x: 1 });
    expect(result).toBe(true);
  });

  it('should sort metadata by key before comparing', () => {
    const result = hybridDataEquals(
      [
        { key: 'z', value: '1' },
        { key: 'a', value: '2' },
      ],
      [
        { key: 'a', value: '2' },
        { key: 'z', value: '1' },
      ],
      {},
      {},
    );
    expect(result).toBe(true);
  });
});
