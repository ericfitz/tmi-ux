import '@angular/compiler';

import { describe, it, expect } from 'vitest';
import { CONTENT_PROVIDERS } from './content-provider-registry';

describe('CONTENT_PROVIDERS', () => {
  it('includes the google_workspace provider', () => {
    expect(CONTENT_PROVIDERS['google_workspace']).toBeDefined();
  });

  it('every entry has required metadata fields', () => {
    for (const [id, meta] of Object.entries(CONTENT_PROVIDERS)) {
      expect(meta.id).toBe(id);
      expect(meta.displayNameKey).toMatch(/^documentSources\./);
      expect(typeof meta.supportsPicker).toBe('boolean');
      expect(meta.pickerService).toBeDefined();
    }
  });

  it('google_workspace supportsPicker is true', () => {
    expect(CONTENT_PROVIDERS['google_workspace'].supportsPicker).toBe(true);
  });

  it('includes the microsoft provider with cspDirectives', () => {
    const microsoft = CONTENT_PROVIDERS['microsoft'];
    expect(microsoft).toBeDefined();
    expect(microsoft.supportsPicker).toBe(true);
    expect(microsoft.cspDirectives?.frameSrc).toContain('https://*.sharepoint.com');
    expect(microsoft.cspDirectives?.frameSrc).toContain('https://login.microsoftonline.com');
    expect(microsoft.cspDirectives?.formAction).toContain('https://*.sharepoint.com');
  });
});
