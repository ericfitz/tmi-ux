import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BrandingConfigService } from './branding-config.service';
import { CONTENT_PROVIDERS } from './content-provider-registry';
import type { ServerContentProvider } from '../interfaces/server-config.interface';
import type { ContentProviderId, ContentProviderMetadata } from '../models/content-provider.types';

/**
 * Provider as rendered in the document editor's source selector. Joins the
 * server-advertised list (/config.content_providers) with the client's
 * capability registry. Providers with kind=direct (e.g. http) are filtered
 * out — they're represented implicitly by the URL radio.
 */
export interface SelectableSource {
  id: string;
  displayName: string;
  /** Optional translation key for the display name when the client knows the provider. */
  displayNameKey?: string;
  icon: string;
  kind: 'delegated' | 'service';
  /** True when the client has a picker service registered for this provider. */
  hasPicker: boolean;
  /**
   * Browser-safe OAuth/picker bootstrap values from the server. Present only
   * when the operator has configured a public Web OAuth client for this
   * provider. Used by service-mode pickers (Google Identity Services flow).
   * Never contains client_secret or service-account material.
   */
  pickerConfig?: { [key: string]: string };
  /** Client-side metadata if the id matches a known ContentProviderId; absent otherwise. */
  capability?: ContentProviderMetadata;
}

@Injectable({ providedIn: 'root' })
// SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: expose server-advertised content providers joined with client capability registry
export class ContentProvidersService {
  /** Raw server-advertised list, unfiltered. Empty until config resolves. */
  readonly providers$: Observable<ServerContentProvider[]>;

  /** Selectable non-direct providers, joined with client capability registry. */
  readonly selectableSources$: Observable<SelectableSource[]>;

  // SEM@0f1a86480dbd48d5a06eac5ad50319694e9b6f04: initialize provider and selectable-source observables from the server config stream (pure)
  constructor(private readonly branding: BrandingConfigService) {
    this.providers$ = this.branding.serverConfig$.pipe(map(c => c?.content_providers ?? []));
    this.selectableSources$ = this.providers$.pipe(map(list => this._toSelectable(list)));
  }

  // SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: filter and map server content providers to selectable source view models, excluding direct providers (pure)
  private _toSelectable(list: ServerContentProvider[]): SelectableSource[] {
    return list
      .filter(p => p.kind === 'delegated' || p.kind === 'service')
      .map(p => {
        const capability = CONTENT_PROVIDERS[p.id as ContentProviderId];
        return {
          id: p.id,
          displayName: p.name,
          displayNameKey: capability?.displayNameKey,
          icon: p.icon,
          kind: p.kind as 'delegated' | 'service',
          hasPicker: !!capability?.supportsPicker,
          pickerConfig: p.picker_config,
          capability,
        };
      });
  }
}
