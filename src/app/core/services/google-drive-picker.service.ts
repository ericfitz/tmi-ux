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
  // SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: store the OAuth access token on the picker builder (pure)
  setOAuthToken(token: string): PickerBuilderApi;
  // SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: store the developer API key on the picker builder (pure)
  setDeveloperKey(key: string): PickerBuilderApi;
  // SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: store the application ID on the picker builder (pure)
  setAppId(id: string): PickerBuilderApi;
  // SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: register a Drive view on the picker builder (pure)
  addView(view: unknown): PickerBuilderApi;
  // SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: register the selection callback on the picker builder (pure)
  setCallback(cb: (data: PickerCallbackData) => void): PickerBuilderApi;
  // SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: build and return the configured Google Picker instance (pure)
  build(): { setVisible(v: boolean): void };
}

interface DocsViewApi {
  // SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: configure whether folders appear in the Google Docs view (pure)
  setIncludeFolders(v: boolean): DocsViewApi;
  // SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: filter the Google Docs view to specific MIME types (pure)
  setMimeTypes(mimes: string): DocsViewApi;
}

interface GapiGlobal {
  // SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: load a GAPI module asynchronously and invoke a callback on completion
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
  // SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: request a short-lived OAuth access token via the GIS token client
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
// SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: open the Google Drive file picker and emit the selected file or cancellation
export class GoogleDrivePickerService implements IContentPickerService {
  private _open = false;

  // SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: inject picker token service and logger dependencies (pure)
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
  // SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: open the Google Drive picker and return an observable of the picker event (mutates shared state)
  pick(context?: PickerContext): Observable<PickerEvent> {
    const mode = context?.mode ?? 'delegated';
    return new Observable<PickerEvent>(subscriber => {
      if (this._open) {
        subscriber.error(new PickerAlreadyOpenError());
        return;
      }
      this._open = true;
      let cancelled = false;

      // SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: load scripts, mint an access token, and display the Google picker
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

  // SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: fetch a server-minted delegated token and build picker bootstrap config
  private async _mintDelegatedMode(): Promise<PickerBootstrap> {
    const token = await this._mintDelegatedToken();
    return {
      accessToken: token.access_token,
      developerKey: token.developer_key ?? token.provider_config?.['developer_key'] ?? '',
      appId: token.app_id ?? token.provider_config?.['app_id'] ?? '',
    };
  }

  // SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: fetch a delegated OAuth access token from the TMI server for Google Workspace
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
  // SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: obtain a browser-minted GIS access token and build picker bootstrap config
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

  // SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: request a Drive read-only OAuth token via Google Identity Services in the browser
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

  // SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: load the GAPI picker module, rejecting if the module fails to load
  private _loadPickerModule(): Promise<void> {
    return new Promise((resolve, reject) => {
      const gapi = (window as unknown as { gapi: GapiGlobal }).gapi;
      gapi.load('picker', {
        callback: () => resolve(),
        onerror: () => reject(new PickerLoadFailedError('Failed to load google.picker module')),
      });
    });
  }

  // SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: render the Google Picker UI and emit a picked or cancelled event (mutates shared state)
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
