import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadScriptOnce, _resetLoaderCache } from './lazy-script-loader';

describe('lazy-script-loader', () => {
  beforeEach(() => {
    _resetLoaderCache();
    document.head.querySelectorAll('script[data-test-loader]').forEach(s => s.remove());
  });

  afterEach(() => {
    _resetLoaderCache();
  });

  it('appends a script tag and resolves on load', async () => {
    const promise = loadScriptOnce('https://example.test/a.js');
    const tag = document.head.querySelector(
      'script[src="https://example.test/a.js"]',
    ) as HTMLScriptElement;
    expect(tag).toBeTruthy();
    tag.dispatchEvent(new Event('load'));
    await expect(promise).resolves.toBeUndefined();
  });

  it('concurrent calls share one script tag and one promise', async () => {
    const p1 = loadScriptOnce('https://example.test/b.js');
    const p2 = loadScriptOnce('https://example.test/b.js');
    const tags = document.head.querySelectorAll('script[src="https://example.test/b.js"]');
    expect(tags.length).toBe(1);
    (tags[0] as HTMLScriptElement).dispatchEvent(new Event('load'));
    await Promise.all([p1, p2]);
  });

  it('rejects on error and clears cache so retry can succeed', async () => {
    const p1 = loadScriptOnce('https://example.test/c.js');
    const tag = document.head.querySelector(
      'script[src="https://example.test/c.js"]',
    ) as HTMLScriptElement;
    tag.dispatchEvent(new Event('error'));
    await expect(p1).rejects.toThrow();

    document.head
      .querySelectorAll('script[src="https://example.test/c.js"]')
      .forEach(s => s.remove());

    const p2 = loadScriptOnce('https://example.test/c.js');
    const tag2 = document.head.querySelector(
      'script[src="https://example.test/c.js"]',
    ) as HTMLScriptElement;
    expect(tag2).toBeTruthy();
    tag2.dispatchEvent(new Event('load'));
    await expect(p2).resolves.toBeUndefined();
  });
});
