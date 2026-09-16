// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import { describe, it, expect } from 'vitest';
import { replaceOperations } from './json-patch.util';

describe('replaceOperations', () => {
  const original = { name: 'a', events: ['x', 'y'], description: undefined as string | undefined };

  it('returns no operations when nothing changed', () => {
    expect(
      replaceOperations(original, { name: 'a', events: ['x', 'y'] }, ['name', 'events']),
    ).toEqual([]);
  });

  it('emits a replace for each changed key only', () => {
    expect(
      replaceOperations(original, { name: 'b', events: ['x', 'y'] }, ['name', 'events']),
    ).toEqual([{ op: 'replace', path: '/name', value: 'b' }]);
  });

  it('deep-compares arrays', () => {
    expect(replaceOperations(original, { events: ['y', 'x'] }, ['events'])).toEqual([
      { op: 'replace', path: '/events', value: ['y', 'x'] },
    ]);
  });

  it('emits a replace when an undefined original gains a value', () => {
    expect(replaceOperations(original, { description: undefined }, ['description'])).toEqual([]);
    expect(replaceOperations(original, { description: 'd' }, ['description'])).toEqual([
      { op: 'replace', path: '/description', value: 'd' },
    ]);
  });

  it('compares the form defaults it was given, so an empty string differs from undefined', () => {
    expect(replaceOperations({ description: '' }, { description: '' }, ['description'])).toEqual(
      [],
    );
    expect(replaceOperations(original, { description: '' }, ['description'])).toHaveLength(1);
  });
});
