import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { LoggerService } from './logger.service';
import { PickerTokenService } from './picker-token.service';
import { MicrosoftPickerGrantService } from './microsoft-picker-grant.service';
import { LanguageService } from '../../i18n/language.service';
import {
  MicrosoftGrantTimeoutError,
  PickerAlreadyOpenError,
  PickerLoadFailedError,
  type IContentPickerService,
  type PickerEvent,
  type PickerTokenResponse,
} from '../models/content-provider.types';

/**
 * Microsoft File Picker v8 host-app integration. Boots the picker by
 * submitting a hidden form into a named iframe, drives the postMessage
 * protocol via MessageChannel, and finalizes the pick by calling the
 * server-mediated picker-grant endpoint.
 */
const PICKER_LOAD_TIMEOUT_MS = 30000;
const PICKER_GRANT_TIMEOUT_MS = 10000;

interface PickerSelectedItem {
  id?: string;
  name: string;
  parentReference?: { driveId?: string };
  webUrl?: string;
  '@microsoft.graph.downloadUrl'?: string;
  file?: { mimeType?: string };
  size?: number;
}

interface PickerCommandPayload {
  type?: string;
  command?: string;
  data?: unknown;
}

interface MessageEnvelope {
  type?: string;
  data?: PickerCommandPayload | { items?: PickerSelectedItem[] };
  command?: PickerCommandPayload;
  id?: string;
}

@Injectable({ providedIn: 'root' })
export class MicrosoftFilePickerService implements IContentPickerService {
  private _open = false;

  constructor(
    private pickerToken: PickerTokenService,
    private grantService: MicrosoftPickerGrantService,
    private languageService: LanguageService,
    private logger: LoggerService,
  ) {}

  pick(): Observable<PickerEvent> {
    return new Observable<PickerEvent>(subscriber => {
      if (this._open) {
        subscriber.error(new PickerAlreadyOpenError());
        return;
      }
      this._open = true;

      const session = new MicrosoftPickerSession(
        this.pickerToken,
        this.grantService,
        this.languageService,
        this.logger,
        subscriber,
      );

      session.start();

      return () => {
        session.cancel();
        this._open = false;
      };
    });
  }
}

// ---------------------------------------------------------------------------
// Session — encapsulates the per-pick iframe lifecycle.
// ---------------------------------------------------------------------------

type PickerEventEmitter = {
  next(value: PickerEvent): void;
  error(err: unknown): void;
  complete(): void;
  closed?: boolean;
};

class MicrosoftPickerSession {
  private overlay: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private form: HTMLFormElement | null = null;
  private channel: MessageChannel | null = null;
  private port: MessagePort | null = null;
  private pickerOrigin = '';
  private accessToken = '';
  private loadTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private grantTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private terminated = false;
  private windowMessageListener: ((evt: MessageEvent) => void) | null = null;

  constructor(
    private pickerToken: PickerTokenService,
    private grantService: MicrosoftPickerGrantService,
    private languageService: LanguageService,
    private logger: LoggerService,
    private subscriber: PickerEventEmitter,
  ) {}

  start(): void {
    void this._startAsync();
  }

  private async _startAsync(): Promise<void> {
    try {
      const token = await this._mintToken();
      if (this.terminated) return;
      this._validateConfig(token);
      this._mountIframe(token);
      this._armLoadTimeout();
    } catch (err) {
      this._fail(err);
    }
  }

  private _mintToken(): Promise<PickerTokenResponse> {
    return new Promise((resolve, reject) => {
      this.pickerToken.mint('microsoft').subscribe({
        next: t => resolve(t),
        error: (e: unknown) => reject(e instanceof Error ? e : new Error(String(e))),
      });
    });
  }

  private _validateConfig(token: PickerTokenResponse): void {
    const cfg = token.provider_config ?? {};
    const pickerOrigin = cfg['picker_origin'];
    const clientId = cfg['client_id'];
    if (!pickerOrigin) {
      throw new Error('Microsoft picker token missing provider_config.picker_origin');
    }
    if (!clientId) {
      throw new Error('Microsoft picker token missing provider_config.client_id');
    }
    this.pickerOrigin = pickerOrigin;
    this.accessToken = token.access_token;
  }

  private _mountIframe(token: PickerTokenResponse): void {
    const cfg = token.provider_config ?? {};
    const channelId = this._generateChannelId();

    const overlay = document.createElement('div');
    overlay.className = 'microsoft-picker-overlay';
    overlay.setAttribute('data-testid', 'microsoft-picker-overlay');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);' +
      'z-index:1500;display:flex;align-items:center;justify-content:center;';

    const iframe = document.createElement('iframe');
    iframe.name = `microsoft-picker-iframe-${channelId}`;
    iframe.title = 'Microsoft File Picker';
    iframe.style.cssText =
      'width:90%;height:85%;max-width:1200px;max-height:800px;border:0;background:#fff;';

    const pickerOptions = this._buildPickerOptions(channelId, cfg);
    const locale = this._buildLocale();

    const url = new URL(`${this.pickerOrigin}/_layouts/15/FilePicker.aspx`);
    url.searchParams.set('filePicker', JSON.stringify(pickerOptions));
    url.searchParams.set('locale', locale);

    const form = document.createElement('form');
    form.target = iframe.name;
    form.method = 'POST';
    form.action = url.toString();

    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'access_token';
    tokenInput.value = this.accessToken;
    form.appendChild(tokenInput);

    overlay.appendChild(iframe);
    overlay.appendChild(form);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.iframe = iframe;
    this.form = form;

    this.windowMessageListener = (evt: MessageEvent): void => this._onWindowMessage(evt, channelId);
    window.addEventListener('message', this.windowMessageListener);

    form.submit();
    this.logger.debug('Microsoft picker iframe submitted');
  }

  private _buildPickerOptions(
    channelId: string,
    cfg: Record<string, string>,
  ): Record<string, unknown> {
    return {
      sdk: '8.0',
      entry: { sharePoint: { byPath: { web: '/' } } },
      authentication: {
        // We supply tokens via host-app message protocol on demand.
      },
      messaging: {
        origin: window.location.origin,
        channelId,
      },
      typesAndSources: {
        mode: 'files',
        pivots: { oneDrive: true, recent: true, sharedLibraries: true },
        filters: ['.docx', '.pptx', '.xlsx', '.pdf', '.txt'],
      },
      selection: { mode: 'single' },
      tenantId: cfg['tenant_id'],
    };
  }

  private _buildLocale(): string {
    const docLang = document.documentElement.lang;
    if (docLang) return docLang.toLowerCase();
    // languageService kept as a hook for future BCP-47-aware mapping.
    void this.languageService;
    return 'en-us';
  }

  private _generateChannelId(): string {
    return `tmi-msft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private _onWindowMessage(evt: MessageEvent, channelId: string): void {
    if (this.terminated) return;
    if (evt.origin !== this.pickerOrigin) {
      this.logger.warn('Microsoft picker postMessage origin mismatch — dropping', {
        expected: this.pickerOrigin,
        got: evt.origin,
      });
      return;
    }
    const data = evt.data as MessageEnvelope | undefined;
    if (!data || data.type !== 'initialize' || data.id !== channelId) {
      return;
    }
    this._cancelLoadTimeout();
    this._installPort(evt);
  }

  private _installPort(evt: MessageEvent): void {
    const channel = new MessageChannel();
    this.channel = channel;
    this.port = channel.port1;
    this.port.addEventListener('message', e => this._onPortMessage(e));
    this.port.start();

    const ports = evt.ports && evt.ports.length > 0 ? evt.ports : [channel.port2];
    const reply = { type: 'initialize', channelPort: channel.port2 };
    if (evt.ports && evt.ports.length > 0) {
      // Picker provided its port; return ours via the picker's port.
      ports[0].postMessage({ type: 'connect' }, [channel.port2]);
    } else {
      // Fall back to posting the port directly into the iframe's window.
      const target = this.iframe?.contentWindow;
      if (target) {
        target.postMessage(reply, this.pickerOrigin, [channel.port2]);
      }
    }
  }

  private _onPortMessage(evt: MessageEvent): void {
    if (this.terminated) return;
    const env = evt.data as MessageEnvelope | undefined;
    if (!env) return;
    const cmd = (env.command ?? env) as PickerCommandPayload;
    const cmdType = cmd?.command ?? cmd?.type;
    switch (cmdType) {
      case 'authenticate':
        this._respond(env, { result: 'token', token: this.accessToken });
        break;
      case 'pick': {
        const items = this._extractSelectedItems(cmd?.data);
        if (items.length === 0) {
          this._respond(env, { result: 'error', error: { code: 'unsupported' } });
          return;
        }
        this._respond(env, { result: 'success' });
        this._finalizePick(items[0]);
        break;
      }
      case 'close':
        this._cancel();
        break;
      default:
        // Unknown commands are ignored; picker may also send telemetry events.
        this.logger.debug('Microsoft picker unhandled command', { cmd: cmdType });
    }
  }

  private _extractSelectedItems(data: unknown): PickerSelectedItem[] {
    if (!data || typeof data !== 'object') return [];
    const obj = data as { items?: PickerSelectedItem[] };
    return Array.isArray(obj.items) ? obj.items : [];
  }

  private _respond(env: MessageEnvelope, response: Record<string, unknown>): void {
    if (!this.port) return;
    this.port.postMessage({ type: 'response', id: env.id, data: response });
  }

  private _finalizePick(item: PickerSelectedItem): void {
    if (this.terminated) return;
    const driveId = item.parentReference?.driveId ?? '';
    const itemId = item.id ?? '';
    if (!driveId || !itemId) {
      this._fail(new Error('Microsoft picker returned item without drive id or item id'));
      return;
    }

    this.subscriber.next({ kind: 'finalizing' });

    let timedOut = false;
    this.grantTimeoutId = setTimeout(() => {
      timedOut = true;
      this._fail(new MicrosoftGrantTimeoutError());
    }, PICKER_GRANT_TIMEOUT_MS);

    this.grantService.grant(driveId, itemId).subscribe({
      next: () => {
        if (timedOut || this.terminated) return;
        this._clearGrantTimeout();
        const fileId = `${driveId}:${itemId}`;
        const mimeType = item.file?.mimeType ?? 'application/octet-stream';
        const url = item.webUrl ?? '';
        this.subscriber.next({
          kind: 'picked',
          file: { fileId, name: item.name, mimeType, url },
        });
        this._teardown();
        this.subscriber.complete();
      },
      error: (err: unknown) => {
        if (timedOut || this.terminated) return;
        this._clearGrantTimeout();
        this._fail(err);
      },
    });
  }

  private _armLoadTimeout(): void {
    this.loadTimeoutId = setTimeout(() => {
      this._fail(new PickerLoadFailedError('Microsoft picker iframe did not initialize in time'));
    }, PICKER_LOAD_TIMEOUT_MS);
  }

  private _cancelLoadTimeout(): void {
    if (this.loadTimeoutId !== null) {
      clearTimeout(this.loadTimeoutId);
      this.loadTimeoutId = null;
    }
  }

  private _clearGrantTimeout(): void {
    if (this.grantTimeoutId !== null) {
      clearTimeout(this.grantTimeoutId);
      this.grantTimeoutId = null;
    }
  }

  cancel(): void {
    if (this.terminated) return;
    this._cancel();
  }

  private _cancel(): void {
    this.subscriber.next({ kind: 'cancelled' });
    this._teardown();
    this.subscriber.complete();
  }

  private _fail(err: unknown): void {
    if (this.terminated) return;
    this._teardown();
    this.subscriber.error(err);
  }

  private _teardown(): void {
    if (this.terminated) return;
    this.terminated = true;
    this._cancelLoadTimeout();
    this._clearGrantTimeout();
    if (this.windowMessageListener) {
      window.removeEventListener('message', this.windowMessageListener);
      this.windowMessageListener = null;
    }
    if (this.port) {
      try {
        this.port.close();
      } catch {
        // ignore
      }
      this.port = null;
    }
    this.channel = null;
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.iframe = null;
    this.form = null;
    this.accessToken = '';
  }
}
