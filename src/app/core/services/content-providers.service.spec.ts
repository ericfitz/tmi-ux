import '@angular/compiler';

import { describe, it, expect } from 'vitest';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

import { ContentProvidersService } from './content-providers.service';
import { BrandingConfigService } from './branding-config.service';
import type { ServerConfig, ServerContentProvider } from '../interfaces/server-config.interface';

interface MockBranding {
  branding: BrandingConfigService;
  push: (cfg: ServerConfig | null) => void;
}

// SEM@0f1a86480dbd48d5a06eac5ad50319694e9b6f04: build a mock BrandingConfigService backed by a controllable BehaviorSubject (pure)
function makeBranding(initial: ServerConfig | null): MockBranding {
  const subject = new BehaviorSubject<ServerConfig | null>(initial);
  return {
    branding: { serverConfig$: subject.asObservable() } as unknown as BrandingConfigService,
    push: (cfg: ServerConfig | null) => subject.next(cfg),
  };
}

const GOOGLE_DRIVE: ServerContentProvider = {
  id: 'google_drive',
  name: 'Google Drive',
  kind: 'service',
  icon: 'fa-brands fa-google-drive',
};
const HTTP: ServerContentProvider = {
  id: 'http',
  name: 'HTTP',
  kind: 'direct',
  icon: 'fa-solid fa-globe',
};
const GOOGLE_WORKSPACE: ServerContentProvider = {
  id: 'google_workspace',
  name: 'Google Workspace',
  kind: 'delegated',
  icon: 'fa-brands fa-google',
};

describe('ContentProvidersService', () => {
  it('emits an empty list when /config has not yet resolved', async () => {
    const { branding } = makeBranding(null);
    const svc = new ContentProvidersService(branding);
    expect(await firstValueFrom(svc.providers$)).toEqual([]);
    expect(await firstValueFrom(svc.selectableSources$)).toEqual([]);
  });

  it('passes the raw server-advertised list through providers$', async () => {
    const { branding } = makeBranding({
      content_providers: [GOOGLE_DRIVE, HTTP, GOOGLE_WORKSPACE],
    });
    const svc = new ContentProvidersService(branding);
    const providers = await firstValueFrom(svc.providers$);
    expect(providers.map(p => p.id)).toEqual(['google_drive', 'http', 'google_workspace']);
  });

  it('selectableSources$ filters out direct-kind providers', async () => {
    const { branding } = makeBranding({
      content_providers: [GOOGLE_DRIVE, HTTP, GOOGLE_WORKSPACE],
    });
    const svc = new ContentProvidersService(branding);
    const sources = await firstValueFrom(svc.selectableSources$);
    expect(sources.some(s => s.id === 'http')).toBe(false);
    expect(sources.map(s => s.id).sort()).toEqual(['google_drive', 'google_workspace']);
  });

  it('joins server-advertised providers with client capability registry', async () => {
    const { branding } = makeBranding({ content_providers: [GOOGLE_WORKSPACE] });
    const svc = new ContentProvidersService(branding);
    const sources = await firstValueFrom(svc.selectableSources$);
    expect(sources[0]).toMatchObject({
      id: 'google_workspace',
      kind: 'delegated',
      hasPicker: true,
      displayNameKey: 'documentSources.googleDrive.name',
    });
  });

  it('marks unknown server-advertised providers as hasPicker=false', async () => {
    const { branding } = makeBranding({
      content_providers: [
        { id: 'confluence', name: 'Confluence', kind: 'delegated', icon: 'fa-brands fa-atlassian' },
      ],
    });
    const svc = new ContentProvidersService(branding);
    const sources = await firstValueFrom(svc.selectableSources$);
    expect(sources[0]).toMatchObject({
      id: 'confluence',
      hasPicker: false,
      displayNameKey: undefined,
      capability: undefined,
    });
  });

  it('propagates picker_config from server to SelectableSource.pickerConfig', async () => {
    const { branding } = makeBranding({
      content_providers: [
        {
          ...GOOGLE_DRIVE,
          picker_config: {
            client_id: 'web-client-id',
            developer_key: 'dev-key',
            app_id: '1234567',
          },
        },
      ],
    });
    const svc = new ContentProvidersService(branding);
    const sources = await firstValueFrom(svc.selectableSources$);
    expect(sources[0].pickerConfig).toEqual({
      client_id: 'web-client-id',
      developer_key: 'dev-key',
      app_id: '1234567',
    });
  });

  it('leaves pickerConfig undefined when server omits it', async () => {
    const { branding } = makeBranding({ content_providers: [GOOGLE_DRIVE] });
    const svc = new ContentProvidersService(branding);
    const sources = await firstValueFrom(svc.selectableSources$);
    expect(sources[0].pickerConfig).toBeUndefined();
  });
});
