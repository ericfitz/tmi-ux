import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { LoggerService } from './logger.service';
import { PickerTokenService } from './picker-token.service';
import {
  PickerAlreadyOpenError,
  type IContentPickerService,
  type PickedFile,
  type PickerTokenResponse,
} from '../models/content-provider.types';
import { loadScriptOnce } from '../../shared/utils/lazy-script-loader';

const GAPI_URL = 'https://apis.google.com/js/api.js';

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
}

@Injectable({ providedIn: 'root' })
export class GoogleDrivePickerService implements IContentPickerService {
  private _open = false;

  constructor(
    private pickerToken: PickerTokenService,
    private logger: LoggerService,
  ) {}

  pick(): Observable<PickedFile | null> {
    return from(this._pickAsync());
  }

  private async _pickAsync(): Promise<PickedFile | null> {
    if (this._open) {
      throw new PickerAlreadyOpenError();
    }
    this._open = true;
    try {
      await loadScriptOnce(GAPI_URL);
      await this._loadPickerModule();
      const token = await this._mintToken();
      return await this._showPicker(token);
    } finally {
      this._open = false;
    }
  }

  private _mintToken(): Promise<PickerTokenResponse> {
    return new Promise((resolve, reject) => {
      this.pickerToken.mint('google_workspace').subscribe({
        next: t => resolve(t),
        error: (e: unknown) => reject(e instanceof Error ? e : new Error(String(e))),
      });
    });
  }

  private _loadPickerModule(): Promise<void> {
    return new Promise((resolve, reject) => {
      const gapi = (window as unknown as { gapi: GapiGlobal }).gapi;
      gapi.load('picker', {
        callback: () => resolve(),
        onerror: () => reject(new Error('Failed to load google.picker module')),
      });
    });
  }

  private _showPicker(token: PickerTokenResponse): Promise<PickedFile | null> {
    return new Promise(resolve => {
      const google = (window as unknown as { google: GoogleGlobal }).google;
      const view = new google.picker.DocsView();
      view.setIncludeFolders(false).setMimeTypes(SUPPORTED_MIME_TYPES);

      const picker = new google.picker.PickerBuilder()
        .setOAuthToken(token.access_token)
        .setDeveloperKey(token.developer_key ?? '')
        .setAppId(token.app_id ?? '')
        .addView(view)
        .setCallback((data: PickerCallbackData) => {
          if (data.action === google.picker.Action.PICKED && data.docs && data.docs.length > 0) {
            const doc = data.docs[0];
            resolve({
              fileId: doc.id,
              name: doc.name,
              mimeType: doc.mimeType,
              url: doc.url,
            });
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();

      this.logger.debug('Opening Google Picker');
      picker.setVisible(true);
    });
  }
}
