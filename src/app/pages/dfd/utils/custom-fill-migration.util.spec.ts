/**
 * Unit tests for the custom fill migration helper
 * Tests: Vitest Framework
 */

import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import type { Cell } from '@antv/x6';
import { InfraEmbeddingService } from '../infrastructure/services/infra-embedding.service';
import {
  inferCustomFill,
  migrateCustomFillFlags,
  normalizeColor,
} from './custom-fill-migration.util';

const shade = (depth: number): string =>
  new InfraEmbeddingService(null as never).calculateEmbeddingFillColor(depth);

interface FakeNode {
  id: string;
  shape: string;
  data: Record<string, unknown>;
  body: Record<string, unknown>;
  isNode: () => boolean;
  getData: () => Record<string, unknown>;
  getAttrByPath: (path: string) => unknown;
  setData: (d: Record<string, unknown>) => void;
}

function fakeNode(
  shape: string,
  data: Record<string, unknown>,
  body: Record<string, unknown>,
  isNode = true,
): FakeNode {
  const node: FakeNode = {
    id: 'n',
    shape,
    data,
    body,
    isNode: () => isNode,
    getData: () => node.data,
    getAttrByPath: () => node.body,
    setData: d => {
      node.data = d;
    },
  };
  return node;
}

describe('normalizeColor', () => {
  it('treats hex case and rgb formatting as equal', () => {
    expect(normalizeColor('#FFFFFF')).toBe(normalizeColor('#ffffff'));
    expect(normalizeColor('#fff')).toBe(normalizeColor('rgb(255, 255, 255)'));
    expect(normalizeColor('RGB(230,240,255)')).toBe(normalizeColor('rgb(230, 240, 255)'));
  });

  it('returns an empty key for non-strings', () => {
    expect(normalizeColor(undefined)).toBe('');
  });
});

describe('inferCustomFill', () => {
  it('is false for the default fill, any case', () => {
    expect(inferCustomFill('process', '#FFFFFF', undefined, shade)).toBe(false);
    expect(inferCustomFill('process', '#ffffff', 1, shade)).toBe(false);
    expect(inferCustomFill('process', 'rgb(255, 255, 255)', undefined, shade)).toBe(false);
  });

  it('is false when fill is unset', () => {
    expect(inferCustomFill('process', undefined, undefined, shade)).toBe(false);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 10])('is false for the embedding shade at depth %i', depth => {
    expect(inferCustomFill('security-boundary', shade(depth), undefined, shade)).toBe(false);
    expect(
      inferCustomFill('security-boundary', shade(depth), Math.max(0.7, 1 - depth * 0.1), shade),
    ).toBe(false);
  });

  it('is true for a real custom color', () => {
    expect(inferCustomFill('process', '#ff0000', undefined, shade)).toBe(true);
    expect(inferCustomFill('process', '#FF0000', 1, shade)).toBe(true);
  });

  it('is true for a custom opacity even with the default fill', () => {
    expect(inferCustomFill('process', '#FFFFFF', 0.5, shade)).toBe(true);
  });

  it('treats transparent as default for text-box but custom for others', () => {
    expect(inferCustomFill('text-box', 'transparent', undefined, shade)).toBe(false);
    expect(inferCustomFill('text-box', '#FFFFFF', undefined, shade)).toBe(true);
    expect(inferCustomFill('process', 'transparent', undefined, shade)).toBe(true);
  });
});

describe('migrateCustomFillFlags', () => {
  it('marks a border-only node as customFill false', () => {
    const n = fakeNode('security-boundary', { customStyles: true }, { fill: shade(1) });
    expect(migrateCustomFillFlags([n as unknown as Cell], shade)).toBe(1);
    expect(n.data['customFill']).toBe(false);
  });

  it('marks a custom-colored node as customFill true', () => {
    const n = fakeNode('process', { customStyles: true }, { fill: '#00ff00' });
    migrateCustomFillFlags([n as unknown as Cell], shade);
    expect(n.data['customFill']).toBe(true);
  });

  it('is idempotent', () => {
    const n = fakeNode('process', { customStyles: true }, { fill: '#00ff00' });
    expect(migrateCustomFillFlags([n as unknown as Cell], shade)).toBe(1);
    expect(migrateCustomFillFlags([n as unknown as Cell], shade)).toBe(0);
    expect(n.data['customFill']).toBe(true);
  });

  it('leaves already-migrated nodes alone', () => {
    const n = fakeNode('process', { customStyles: true, customFill: false }, { fill: '#00ff00' });
    expect(migrateCustomFillFlags([n as unknown as Cell], shade)).toBe(0);
    expect(n.data['customFill']).toBe(false);
  });

  it('ignores nodes without customStyles', () => {
    const n = fakeNode('process', {}, { fill: '#00ff00' });
    expect(migrateCustomFillFlags([n as unknown as Cell], shade)).toBe(0);
    expect(n.data['customFill']).toBeUndefined();
  });

  it('ignores non-node cells', () => {
    const e = fakeNode('edge', { customStyles: true }, { fill: '#00ff00' }, false);
    expect(migrateCustomFillFlags([e as unknown as Cell], shade)).toBe(0);
    expect(e.data['customFill']).toBeUndefined();
  });
});
