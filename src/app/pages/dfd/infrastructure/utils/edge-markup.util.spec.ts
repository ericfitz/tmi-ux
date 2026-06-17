// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { describe, expect, it } from 'vitest';
import { getEdgeMarkup } from './edge-markup.util';

describe('getEdgeMarkup', () => {
  it('returns the wrap and line path markup entries', () => {
    expect(getEdgeMarkup()).toEqual([
      {
        tagName: 'path',
        selector: 'wrap',
        groupSelector: 'lines',
        attrs: {
          fill: 'none',
          cursor: 'pointer',
          stroke: 'transparent',
          strokeLinecap: 'round',
        },
      },
      {
        tagName: 'path',
        selector: 'line',
        groupSelector: 'lines',
        attrs: {
          fill: 'none',
          pointerEvents: 'none',
        },
      },
    ]);
  });

  it('returns a fresh array on each call (no shared mutable state)', () => {
    const first = getEdgeMarkup();
    const second = getEdgeMarkup();
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
  });
});
