import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LoggerService } from './logger.service';
import { PickerTokenService } from './picker-token.service';
import {
  PickerAlreadyOpenError,
  PickerLoadFailedError,
  type IContentPickerService,
  type PickerContext,
  type PickerEvent,
  type PickerTokenResponse,
} from '../models/content-provider.types';
import { loadScriptOnce } from '../../shared/utils/lazy-script-loader';

const GAPI_URL = 'https://apis.google.com/js/api.js';
const GIS_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const SUPPORTED_MIME_TYPES = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/pdf',
  'text/plain',
  'text/csv',
].join(',');

interface PickerCallbackData {
  action: string;
  docs?: Array<{ id: string; name: string; mimeType: string; url: string }>;
}

interface PickerBuilderApi {
  setOAuthToken(token: string): PickerBuilderApi;
  setDeveloperKey(key: string): PickerBuilderApi;
  setAppId(id: string): PickerBuilderApi;
  addView(view: unknown): PickerBuilderApi;
  setCallback(cb: (data: PickerCallbackData) => void): PickerBuilderApi;
  build(): { setVisible(v: boolean): void };
}

interface DocsViewApi {
  setIncludeFolders(v: boolean): DocsViewApi;
  setMimeTypes(mimes: string): DocsViewApi;
}

interface GapiGlobal {
  load(module: string, opts: { callback: () => void; onerror?: (e: unknown) => void }): void;
}

interface GoogleGlobal {
  picker: {
    Action: { PICKED: string; CANCEL: string };
    DocsView: new () => DocsViewApi;
    PickerBuilder: new () => PickerBuilderApi;
  };
  accounts?: {
    oauth2: {
      initTokenClient(opts: GisTokenClientOpts): GisTokenClient;
    };
  };
}

interface GisTokenClientOpts {
  client_id: string;
  scope: string;
  callback: (response: { access_token?: string; error?: string }) => void;
  error_callback?: (err: { type?: string; message?: string }) => void;
}

interface GisTokenClient {
  requestAccessToken(opts?: { prompt?: string }): void;
}

/**
 * Minimal shape needed to bootstrap the Google Picker UI. Both delegated
 * (server-minted) and service (browser-minted via GIS) modes converge to
 * this representation so the picker rendering code stays mode-agnostic.
 */
interface PickerBootstrap {
  accessToken: string;
  developerKey: string;
  appId: string;
}

@Injectable({ providedIn: 'root' })
export class GoogleDrivePickerService implements IContentPickerService {
  private _open = false;

  constructor(
    private pickerToken: PickerTokenService,
    private logger: LoggerService,
  ) {}

  /**
   * Open the Google Picker. Defaults to delegated mode (token minted by the
   * TMI server from the user's stored delegated grant). Pass `context.mode =
   * 'service'` with a `pickerConfig` map to use Google Identity Services in
   * the browser instead — required for service-mode content providers like
   * google_drive.
   */
  pick(context?: PickerContext): Observable<PickerEvent> {
    const mode = context?.mode ?? 'delegated';
    return new Observable<PickerEvent>(subscriber => {
      if (this._open) {
        subscriber.error(new PickerAlreadyOpenError());
        return;
      }
      this._open = true;
      let cancelled = false;

      const run = async (): Promise<void> => {
        try {
          await loadScriptOnce(GAPI_URL);
          if (cancelled) return;
          await this._loadPickerModule();
          if (cancelled) return;
          const bootstrap =
            mode === 'service'
              ? await this._mintServiceMode(context!.pickerConfig)
              : await this._mintDelegatedMode();
          if (cancelled) return;
          this._showPicker(bootstrap, event => {
            if (cancelled) return;
            subscriber.next(event);
            subscriber.complete();
          });
        } catch (err) {
          if (!cancelled) subscriber.error(err);
        }
      };

      void run();

      return () => {
        cancelled = true;
        this._open = false;
      };
    });
  }

  private async _mintDelegatedMode(): Promise<PickerBootstrap> {
    const token = await this._mintDelegatedToken();
    return {
      accessToken: token.access_token,
      developerKey: token.developer_key ?? token.provider_config?.['developer_key'] ?? '',
      appId: token.app_id ?? token.provider_config?.['app_id'] ?? '',
    };
  }

  private _mintDelegatedToken(): Promise<PickerTokenResponse> {
    return new Promise((resolve, reject) => {
      this.pickerToken.mint('google_workspace').subscribe({
        next: t => resolve(t),
        error: (e: unknown) => reject(e instanceof Error ? e : new Error(String(e))),
      });
    });
  }

  /**
   * Mints a short-lived OAuth access token directly in the browser using
   * Google Identity Services. The token is used immediately to render the
   * Picker and discarded — it is never sent back to the TMI server.
   *
   * Throws PickerLoadFailedError if pickerConfig is missing required keys
   * or if GIS fails to load / consent is denied.
   */
  private async _mintServiceMode(
    pickerConfig: Record<string, string> | undefined,
  ): Promise<PickerBootstrap> {
    if (!pickerConfig?.['client_id']) {
      throw new PickerLoadFailedError('Missing client_id in picker_config');
    }
    const clientId = pickerConfig['client_id'];
    const developerKey = pickerConfig['developer_key'] ?? '';
    const appId = pickerConfig['app_id'] ?? '';

    await loadScriptOnce(GIS_URL);
    const accessToken = await this._requestServiceModeToken(clientId);
    return { accessToken, developerKey, appId };
  }

  private _requestServiceModeToken(clientId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const google = (window as unknown as { google?: GoogleGlobal }).google;
      if (!google?.accounts?.oauth2) {
        reject(new PickerLoadFailedError('Google Identity Services unavailable'));
        return;
      }
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_READONLY_SCOPE,
        callback: response => {
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new PickerLoadFailedError(response.error ?? 'Token request failed'));
          }
        },
        error_callback: err => {
          reject(new PickerLoadFailedError(err.message ?? err.type ?? 'Token request failed'));
        },
      });
      tokenClient.requestAccessToken();
    });
  }

  private _loadPickerModule(): Promise<void> {
    return new Promise((resolve, reject) => {
      const gapi = (window as unknown as { gapi: GapiGlobal }).gapi;
      gapi.load('picker', {
        callback: () => resolve(),
        onerror: () => reject(new PickerLoadFailedError('Failed to load google.picker module')),
      });
    });
  }

  private _showPicker(bootstrap: PickerBootstrap, emit: (e: PickerEvent) => void): void {
    const google = (window as unknown as { google: GoogleGlobal }).google;
    const view = new google.picker.DocsView();
    view.setIncludeFolders(false).setMimeTypes(SUPPORTED_MIME_TYPES);

    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(bootstrap.accessToken)
      .setDeveloperKey(bootstrap.developerKey)
      .setAppId(bootstrap.appId)
      .addView(view)
      .setCallback((data: PickerCallbackData) => {
        if (data.action === google.picker.Action.PICKED && data.docs && data.docs.length > 0) {
          const doc = data.docs[0];
          this._open = false;
          emit({
            kind: 'picked',
            file: {
              fileId: doc.id,
              name: doc.name,
              mimeType: doc.mimeType,
              url: doc.url,
            },
          });
        } else if (data.action === google.picker.Action.CANCEL) {
          this._open = false;
          emit({ kind: 'cancelled' });
        }
      })
      .build();

    this.logger.debug('Opening Google Picker');
    picker.setVisible(true);
  }
}
