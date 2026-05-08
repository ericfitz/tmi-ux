import type { Type } from '@angular/core';
import type { Observable } from 'rxjs';
import type { components } from '@app/generated/api-types';

/**
 * Stable union of content provider ids known to tmi-ux. Add new ids here
 * when a new provider's TMI sub-project ships (Confluence, etc.).
 */
export type ContentProviderId = 'google_workspace' | 'google_drive' | 'microsoft';

/** OpenAPI-generated info shape for a single linked content token. */
export type ContentTokenInfo = components['schemas']['ContentTokenInfo'];

/** OpenAPI-generated picker-token response (Google Picker bootstrap material). */
export type PickerTokenResponse = components['schemas']['PickerTokenResponse'];

/** OpenAPI-generated picker-registration payload sent on document attach. */
export type PickerRegistration = components['schemas']['PickerRegistration'];

/** OpenAPI-generated diagnostics object on document GET responses. */
export type DocumentAccessDiagnostics = components['schemas']['DocumentAccessDiagnostics'];

/** OpenAPI-generated remediation action shape inside diagnostics. */
export type AccessRemediation = components['schemas']['AccessRemediation'];

/** OpenAPI-generated authorization-URL response. */
export type ContentAuthorizationURL = components['schemas']['ContentAuthorizationURL'];

/** OpenAPI-generated Microsoft picker-grant request. */
export type MicrosoftPickerGrantRequest = components['schemas']['MicrosoftPickerGrantRequest'];

/** OpenAPI-generated Microsoft picker-grant response. */
export type MicrosoftPickerGrantResponse = components['schemas']['MicrosoftPickerGrantResponse'];

/** Outcome of a successful pick action. */
export interface PickedFile {
  fileId: string;
  name: string;
  mimeType: string;
  url: string;
}

/**
 * Single-stream events emitted by `IContentPickerService.pick()`. The
 * Observable terminates after `picked` or `cancelled`. Errors (including
 * post-pick grant failures) are thrown on the Observable's error channel.
 */
export type PickerEvent =
  | { kind: 'finalizing'; messageKey?: string }
  | { kind: 'picked'; file: PickedFile }
  | { kind: 'cancelled' };

/**
 * Optional context passed to a picker service to select between operating
 * modes. Currently used only by GoogleDrivePickerService to switch between
 * delegated (server-minted token) and service (browser-side GIS token).
 */
export interface PickerContext {
  mode: 'delegated' | 'service';
  /**
   * Browser-safe picker bootstrap values from /config.content_providers[].picker_config.
   * Required when mode === 'service'; ignored otherwise.
   */
  pickerConfig?: { [key: string]: string };
}

/**
 * Provider-specific picker service contract. Each picker service implements
 * `pick()`; the registry maps provider id to the Angular `Type` so consumers
 * can resolve the right service via `Injector.get(...)`.
 */
export interface IContentPickerService {
  pick(context?: PickerContext): Observable<PickerEvent>;
}

/**
 * Per-provider CSP directive contributions. Merged into the global CSP by
 * `SecurityConfigService.injectDynamicCSP` for every known provider so picker
 * iframes can render when the server advertises that provider at runtime.
 */
export interface ContentProviderCspDirectives {
  frameSrc?: string[];
  formAction?: string[];
  scriptSrc?: string[];
}

/** Lookup record describing a content provider for UI rendering and dispatch. */
export interface ContentProviderMetadata {
  id: ContentProviderId;
  displayNameKey: string;
  icon: string;
  supportsPicker: boolean;
  pickerService: Type<IContentPickerService>;
  cspDirectives?: ContentProviderCspDirectives;
}

/** Thrown when picker invocation requires a linked token that doesn't exist. */
export class ContentTokenNotLinkedError extends Error {
  override name = 'ContentTokenNotLinkedError';
  constructor(public readonly providerId: ContentProviderId) {
    super(`No linked content token for provider: ${providerId}`);
  }
}

/**
 * Thrown when the server returns 422 `content_token_provider_not_configured`
 * from `/me/content_tokens/{provider_id}/authorize` — the client offered a
 * provider that the server's `ContentOAuthProviderRegistry` does not have
 * credentials for. Until the server exposes configured providers via
 * `/config`, the client may advertise providers the server cannot honor.
 */
export class ContentTokenProviderNotConfiguredError extends Error {
  override name = 'ContentTokenProviderNotConfiguredError';
  constructor(public readonly providerId: ContentProviderId) {
    super(`Content provider not configured on server: ${providerId}`);
  }
}

/** Thrown when a second pick() call fires while a Picker is already open. */
export class PickerAlreadyOpenError extends Error {
  override name = 'PickerAlreadyOpenError';
  constructor() {
    super('A picker is already open');
  }
}

/** Thrown when the picker session expires beyond a single retry. */
export class PickerSessionExpiredError extends Error {
  override name = 'PickerSessionExpiredError';
  constructor() {
    super('Picker session expired');
  }
}

/** Thrown when the picker iframe fails to load (timeout, script error). */
export class PickerLoadFailedError extends Error {
  override name = 'PickerLoadFailedError';
  constructor(message = 'Picker failed to load') {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Microsoft picker-grant typed errors
// ---------------------------------------------------------------------------

/** Server returned 404 on POST /me/microsoft/picker_grants — no linked Microsoft token. */
export class MicrosoftAccountNotLinkedError extends Error {
  override name = 'MicrosoftAccountNotLinkedError';
  constructor() {
    super('No linked Microsoft account');
  }
}

/** Server returned 422 — Microsoft Graph rejected the permission grant. */
export class MicrosoftGraphPermissionRejectedError extends Error {
  override name = 'MicrosoftGraphPermissionRejectedError';
  constructor(message = 'Microsoft rejected the permission grant') {
    super(message);
  }
}

/** Server returned 503 — Microsoft Graph temporarily unavailable. */
export class MicrosoftGraphUnavailableError extends Error {
  override name = 'MicrosoftGraphUnavailableError';
  constructor(message = 'Microsoft Graph is temporarily unavailable') {
    super(message);
  }
}

/** Server returned 400 — request was malformed or otherwise rejected. */
export class MicrosoftPickerGrantBadRequestError extends Error {
  override name = 'MicrosoftPickerGrantBadRequestError';
  constructor(message = 'Microsoft picker grant request was invalid') {
    super(message);
  }
}

/** Server returned 5xx (other than 503) — generic server error. */
export class MicrosoftPickerGrantServerError extends Error {
  override name = 'MicrosoftPickerGrantServerError';
  constructor(message = 'Microsoft picker grant failed on the server') {
    super(message);
  }
}

/** Picker-grant call did not complete within the configured timeout (default 10s). */
export class MicrosoftGrantTimeoutError extends Error {
  override name = 'MicrosoftGrantTimeoutError';
  constructor() {
    super('Microsoft picker grant timed out');
  }
}
