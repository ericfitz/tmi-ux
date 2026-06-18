const cache = new Map<string, Promise<void>>();

/**
 * Idempotently loads a script by URL. Concurrent callers share the same
 * promise; if the load fails, the cache entry is removed so a retry can
 * make a fresh attempt.
 */
// SEM@d0f158f19ac1da312d179e2a25e720ad51dd2824: load an external script by URL exactly once, sharing the promise across concurrent callers (mutates shared state)
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
// SEM@d0f158f19ac1da312d179e2a25e720ad51dd2824: clear the script-loader cache for test isolation (mutates shared state)
export function _resetLoaderCache(): void {
  cache.clear();
}
