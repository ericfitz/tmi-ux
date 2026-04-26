import { afterEach, describe, expect, it } from 'vitest';

import { _resetTextMeasurementCacheForTesting, measureLabelWidth } from './text-measurement.util';

describe('measureLabelWidth', () => {
  afterEach(() => {
    _resetTextMeasurementCacheForTesting();
  });

  it('returns 0 for empty, null, or undefined text', () => {
    expect(measureLabelWidth('', 12, 'sans-serif')).toBe(0);
    expect(measureLabelWidth(null, 12, 'sans-serif')).toBe(0);
    expect(measureLabelWidth(undefined, 12, 'sans-serif')).toBe(0);
  });

  it('returns a positive width for non-empty text', () => {
    expect(measureLabelWidth('hello', 12, 'sans-serif')).toBeGreaterThan(0);
  });

  it('produces a wider measurement for longer strings', () => {
    const short = measureLabelWidth('hi', 12, 'sans-serif');
    const long = measureLabelWidth('hello world', 12, 'sans-serif');
    expect(long).toBeGreaterThan(short);
  });

  it('scales with font size', () => {
    const small = measureLabelWidth('hello', 8, 'sans-serif');
    const large = measureLabelWidth('hello', 24, 'sans-serif');
    expect(large).toBeGreaterThan(small);
  });
});
