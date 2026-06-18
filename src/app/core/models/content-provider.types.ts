import type { Type } from '@angular/core';
import type { Observable } from 'rxjs';
import type { components } from '@app/generated/api-types';

/**
 * Stable union of content provider ids known to tmi-ux. Add new ids here
 * when a new provider's TMI sub-project ships (Confluence, etc.).
 */
// SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: enumerate the stable set of known content provider identifiers (pure)
export type ContentProviderId = 'google_workspace' | 'google_drive' | 'microsoft';

/** OpenAPI-generated info shape for a single linked content token. */
// SEM@7353cfbca63fd95ff56c1d29725aa67f9c84408a: alias for the OpenAPI schema shape describing a linked content token (pure)
export type ContentTokenInfo = components['schemas']['ContentTokenInfo'];

/** OpenAPI-generated picker-token response (Google Picker bootstrap material). */
// SEM@7353cfbca63fd95ff56c1d29725aa67f9c84408a: alias for the OpenAPI picker-token bootstrap response shape (pure)
export type PickerTokenResponse = components['schemas']['PickerTokenResponse'];

/** OpenAPI-generated picker-registration payload sent on document attach. */
// SEM@7353cfbca63fd95ff56c1d29725aa67f9c84408a: alias for the OpenAPI picker-registration payload sent on document attach (pure)
export type PickerRegistration = components['schemas']['PickerRegistration'];

/** OpenAPI-generated diagnostics object on document GET responses. */
// SEM@7353cfbca63fd95ff56c1d29725aa67f9c84408a: alias for the OpenAPI diagnostics shape returned on document access failure (pure)
export type DocumentAccessDiagnostics = components['schemas']['DocumentAccessDiagnostics'];

/** OpenAPI-generated remediation action shape inside diagnostics. */
// SEM@7353cfbca63fd95ff56c1d29725aa67f9c84408a: alias for the OpenAPI remediation action shape inside access diagnostics (pure)
export type AccessRemediation = components['schemas']['AccessRemediation'];

/** OpenAPI-generated authorization-URL response. */
// SEM@7353cfbca63fd95ff56c1d29725aa67f9c84408a: alias for the OpenAPI authorization-URL response for content provider OAuth (pure)
export type ContentAuthorizationURL = components['schemas']['ContentAuthorizationURL'];

/** OpenAPI-generated Microsoft picker-grant request. */
// SEM@338c179e5efb196ff54ba21d43c47c6330789216: alias for the OpenAPI Microsoft picker-grant request payload (pure)
export type MicrosoftPickerGrantRequest = components['schemas']['MicrosoftPickerGrantRequest'];

/** OpenAPI-generated Microsoft picker-grant response. */
// SEM@338c179e5efb196ff54ba21d43c47c6330789216: alias for the OpenAPI Microsoft picker-grant response payload (pure)
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
// SEM@338c179e5efb196ff54ba21d43c47c6330789216: discriminated union of events emitted during a picker file-selection flow (pure)
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
  // SEM@cf4afb3aa3fa6b6bc7a18caa9fe7c71b03af5311: dispatch a file picker and stream picker lifecycle events (pure)
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
// SEM@7353cfbca63fd95ff56c1d29725aa67f9c84408a: signal that no linked content token exists for the provider (pure)
export class ContentTokenNotLinkedError extends Error {
  override name = 'ContentTokenNotLinkedError';
  // SEM@338c179e5efb196ff54ba21d43c47c6330789216: build error with the missing provider id (pure)
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
// SEM@c062e63e1c7ebd9f5dc5a91928bc6af3b94776a5: signal that the server has no credentials configured for the content provider (pure)
export class ContentTokenProviderNotConfiguredError extends Error {
  override name = 'ContentTokenProviderNotConfiguredError';
  // SEM@338c179e5efb196ff54ba21d43c47c6330789216: build error with the unconfigured provider id (pure)
  constructor(public readonly providerId: ContentProviderId) {
    super(`Content provider not configured on server: ${providerId}`);
  }
}

/** Thrown when a second pick() call fires while a Picker is already open. */
// SEM@7353cfbca63fd95ff56c1d29725aa67f9c84408a: signal that a picker session is already active (pure)
export class PickerAlreadyOpenError extends Error {
  override name = 'PickerAlreadyOpenError';
  // SEM@338c179e5efb196ff54ba21d43c47c6330789216: build error indicating a picker is already open (pure)
  constructor() {
    super('A picker is already open');
  }
}

/** Thrown when the picker session expires beyond a single retry. */
// SEM@7353cfbca63fd95ff56c1d29725aa67f9c84408a: signal that the picker session has expired beyond retry (pure)
export class PickerSessionExpiredError extends Error {
  override name = 'PickerSessionExpiredError';
  // SEM@338c179e5efb196ff54ba21d43c47c6330789216: build error indicating the picker session expired (pure)
  constructor() {
    super('Picker session expired');
  }
}

/** Thrown when the picker iframe fails to load (timeout, script error). */
// SEM@338c179e5efb196ff54ba21d43c47c6330789216: signal that the picker iframe failed to load (pure)
export class PickerLoadFailedError extends Error {
  override name = 'PickerLoadFailedError';
  // SEM@338c179e5efb196ff54ba21d43c47c6330789216: build error with an optional load-failure message (pure)
  constructor(message = 'Picker failed to load') {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Microsoft picker-grant typed errors
// ---------------------------------------------------------------------------

/** Server returned 404 on POST /me/microsoft/picker_grants — no linked Microsoft token. */
// SEM@338c179e5efb196ff54ba21d43c47c6330789216: signal that no linked Microsoft account exists for picker grants (pure)
export class MicrosoftAccountNotLinkedError extends Error {
  override name = 'MicrosoftAccountNotLinkedError';
  // SEM@338c179e5efb196ff54ba21d43c47c6330789216: build error indicating no linked Microsoft account (pure)
  constructor() {
    super('No linked Microsoft account');
  }
}

/** Server returned 422 — Microsoft Graph rejected the permission grant. */
// SEM@338c179e5efb196ff54ba21d43c47c6330789216: signal that Microsoft Graph rejected the permission grant (pure)
export class MicrosoftGraphPermissionRejectedError extends Error {
  override name = 'MicrosoftGraphPermissionRejectedError';
  // SEM@338c179e5efb196ff54ba21d43c47c6330789216: build error with a rejection message from Microsoft Graph (pure)
  constructor(message = 'Microsoft rejected the permission grant') {
    super(message);
  }
}

/** Server returned 503 — Microsoft Graph temporarily unavailable. */
// SEM@338c179e5efb196ff54ba21d43c47c6330789216: signal that Microsoft Graph is temporarily unavailable (pure)
export class MicrosoftGraphUnavailableError extends Error {
  override name = 'MicrosoftGraphUnavailableError';
  // SEM@338c179e5efb196ff54ba21d43c47c6330789216: build error indicating Microsoft Graph is unavailable (pure)
  constructor(message = 'Microsoft Graph is temporarily unavailable') {
    super(message);
  }
}

/** Server returned 400 — request was malformed or otherwise rejected. */
// SEM@338c179e5efb196ff54ba21d43c47c6330789216: signal that the Microsoft picker grant request was malformed (pure)
export class MicrosoftPickerGrantBadRequestError extends Error {
  override name = 'MicrosoftPickerGrantBadRequestError';
  // SEM@338c179e5efb196ff54ba21d43c47c6330789216: build error with a bad-request message for picker grants (pure)
  constructor(message = 'Microsoft picker grant request was invalid') {
    super(message);
  }
}

/** Server returned 5xx (other than 503) — generic server error. */
// SEM@338c179e5efb196ff54ba21d43c47c6330789216: signal a generic server error during Microsoft picker grant (pure)
export class MicrosoftPickerGrantServerError extends Error {
  override name = 'MicrosoftPickerGrantServerError';
  // SEM@338c179e5efb196ff54ba21d43c47c6330789216: build error with a server-failure message for picker grants (pure)
  constructor(message = 'Microsoft picker grant failed on the server') {
    super(message);
  }
}

/** Picker-grant call did not complete within the configured timeout (default 10s). */
// SEM@338c179e5efb196ff54ba21d43c47c6330789216: signal that the Microsoft picker grant call timed out (pure)
export class MicrosoftGrantTimeoutError extends Error {
  override name = 'MicrosoftGrantTimeoutError';
  // SEM@338c179e5efb196ff54ba21d43c47c6330789216: build error indicating the picker grant timed out (pure)
  constructor() {
    super('Microsoft picker grant timed out');
  }
}
