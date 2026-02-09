/**
 * Branding Configuration Service
 *
 * Fetches runtime branding configuration from the TMI server's public GET /config
 * endpoint at application startup. Provides reactive and synchronous access to
 * branding fields (logo, organization info, data classification, user hyperlink config).
 *
 * Key functionality:
 * - Fetches server config at startup via APP_INITIALIZER
 * - Pre-fetches and validates custom logo PNG, storing ready-to-use image data
 * - Falls back gracefully to defaults when server config is unavailable
 * - Exposes observables for template binding and synchronous getters for procedural code
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';
import { ServerConfig } from '../interfaces/server-config.interface';

/** Default TMI logo path served from public/ */
const DEFAULT_LOGO_PATH = '/TMI-FullLogo-Transparent-512x512.png';

/** Maximum time to wait for config fetch (ms) */
const CONFIG_FETCH_TIMEOUT = 5000;

/** Maximum logo file size (bytes) */
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

@Injectable({
  providedIn: 'root',
})
export class BrandingConfigService {
  private readonly config$ = new BehaviorSubject<ServerConfig | null>(null);
  private readonly logoImageUrl = new BehaviorSubject<string>(DEFAULT_LOGO_PATH);
  private logoPngBytes: Uint8Array | null = null;

  // Derived observables for template binding
  readonly logoImageUrl$: Observable<string> = this.logoImageUrl.asObservable();

  readonly organizationName$: Observable<string | null> = this.config$.pipe(
    map(c => c?.ui?.organization_name ?? null),
  );

  readonly organizationUrl$: Observable<string | null> = this.config$.pipe(
    map(c => c?.ui?.organization_url ?? null),
  );

  readonly supportUrl$: Observable<string | null> = this.config$.pipe(
    map(c => c?.ui?.support_url ?? null),
  );

  readonly confidentialityWarning$: Observable<string | null> = this.config$.pipe(
    map(c => c?.ui?.confidentiality_warning ?? null),
  );

  readonly dataClassification$: Observable<string | null> = this.config$.pipe(
    map(c => c?.ui?.data_classification ?? null),
  );

  readonly userHyperlinkTemplate$: Observable<string | null> = this.config$.pipe(
    map(c => c?.ui?.user_hyperlink_template ?? null),
  );

  readonly userHyperlinkProvider$: Observable<string | null> = this.config$.pipe(
    map(c => c?.ui?.user_hyperlink_provider ?? null),
  );

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
  ) {}

  // Synchronous getters for procedural code (e.g., report service)
  get organizationName(): string | null {
    return this.config$.value?.ui?.organization_name ?? null;
  }

  get organizationUrl(): string | null {
    return this.config$.value?.ui?.organization_url ?? null;
  }

  get supportUrl(): string | null {
    return this.config$.value?.ui?.support_url ?? null;
  }

  get confidentialityWarning(): string | null {
    return this.config$.value?.ui?.confidentiality_warning ?? null;
  }

  get dataClassification(): string | null {
    return this.config$.value?.ui?.data_classification ?? null;
  }

  get userHyperlinkTemplate(): string | null {
    return this.config$.value?.ui?.user_hyperlink_template ?? null;
  }

  get userHyperlinkProvider(): string | null {
    return this.config$.value?.ui?.user_hyperlink_provider ?? null;
  }

  /** Pre-validated PNG data ready for pdf-lib embedPng() */
  get logoPngData(): Uint8Array | null {
    return this.logoPngBytes;
  }

  /**
   * Initialize the branding config by fetching from the server.
   * Called via APP_INITIALIZER at application startup.
   * Never rejects — failures are handled gracefully with defaults.
   */
  async initialize(): Promise<void> {
    try {
      const config = await this.fetchConfig();
      if (config) {
        this.config$.next(config);
      }
      await this.loadLogo(config?.ui?.logo_url ?? null);
    } catch (error) {
      this.logger.warn('BrandingConfigService: initialization failed, using defaults', error);
      await this.loadDefaultLogo();
    }
  }

  private async fetchConfig(): Promise<ServerConfig | null> {
    const apiUrl = environment.apiUrl;
    if (!apiUrl || !apiUrl.trim()) {
      return null;
    }

    const configUrl = apiUrl.replace(/\/api$/, '') + '/config';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG_FETCH_TIMEOUT);

      const response = await fetch(configUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(`BrandingConfigService: GET /config returned ${response.status}`);
        return null;
      }

      return (await response.json()) as ServerConfig;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.logger.warn('BrandingConfigService: GET /config timed out');
      } else {
        this.logger.warn('BrandingConfigService: GET /config failed', error);
      }
      return null;
    }
  }

  private async loadLogo(logoUrl: string | null): Promise<void> {
    if (logoUrl) {
      try {
        const pngData = await this.fetchAndValidatePng(logoUrl);
        if (pngData) {
          this.logoPngBytes = pngData;
          const blob = new Blob([new Uint8Array(pngData) as BlobPart], { type: 'image/png' });
          this.logoImageUrl.next(URL.createObjectURL(blob));
          return;
        }
      } catch (error) {
        this.logger.warn(
          'BrandingConfigService: custom logo fetch/validation failed, falling back to default',
          error,
        );
      }
    }
    await this.loadDefaultLogo();
  }

  private async loadDefaultLogo(): Promise<void> {
    try {
      const pngData = await this.fetchPngBytes(DEFAULT_LOGO_PATH);
      if (pngData) {
        this.logoPngBytes = pngData;
      }
    } catch (error) {
      this.logger.warn('BrandingConfigService: failed to pre-load default logo for PDF', error);
    }
    this.logoImageUrl.next(DEFAULT_LOGO_PATH);
  }

  private async fetchAndValidatePng(url: string): Promise<Uint8Array | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG_FETCH_TIMEOUT);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      this.logger.warn(`BrandingConfigService: logo fetch returned ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('image/png')) {
      this.logger.warn(
        `BrandingConfigService: logo content-type is "${contentType}", expected image/png`,
      );
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_LOGO_SIZE) {
      this.logger.warn(
        `BrandingConfigService: logo exceeds ${MAX_LOGO_SIZE} bytes (${buffer.byteLength})`,
      );
      return null;
    }

    return new Uint8Array(buffer);
  }

  private async fetchPngBytes(path: string): Promise<Uint8Array | null> {
    const response = await fetch(path);
    if (!response.ok) {
      return null;
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}
