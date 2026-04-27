const cache = new Map<string, Promise<void>>();

/**
 * Idempotently loads a script by URL. Concurrent callers share the same
 * promise; if the load fails, the cache entry is removed so a retry can
 * make a fresh attempt.
 */
export function loadScriptOnce(src: string): Promise<void> {
  const existing = cache.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = src;
    tag.async = true;
    tag.onload = (): void => resolve();
    tag.onerror = (): void => {
      cache.delete(src);
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(tag);
  });

  cache.set(src, promise);
  return promise;
}

/** Test helper. */
export function _resetLoaderCache(): void {
  cache.clear();
}
