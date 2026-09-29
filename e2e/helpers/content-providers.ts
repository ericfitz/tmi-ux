import { testConfig } from '../config/test.config';

/**
 * Whether the server's GET /config advertises the given content provider id.
 * Throws when /config is unreachable or not OK, so a broken environment fails
 * the test instead of skipping it.
 */
export async function serverHasContentProvider(id: string): Promise<boolean> {
  const resp = await fetch(`${testConfig.apiUrl}/config`);
  if (!resp.ok) {
    throw new Error(`GET ${testConfig.apiUrl}/config returned ${resp.status}`);
  }
  const body = (await resp.json()) as { content_providers?: Array<{ id: string }> };
  return (body.content_providers ?? []).some(p => p.id === id);
}

/** Skip reason for specs that need a content provider the server does not advertise. */
export function contentProviderSkipReason(id: string): string {
  return `server /config does not advertise the ${id} content provider — enable it on the TMI server and re-run.`;
}
