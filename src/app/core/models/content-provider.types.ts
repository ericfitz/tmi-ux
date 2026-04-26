import type { Type } from '@angular/core';
import type { components } from '@app/generated/api-types';

/**
 * Stable union of content provider ids known to tmi-ux. Add new ids here
 * when a new provider's TMI sub-project ships (Confluence, OneDrive, etc.).
 */
export type ContentProviderId = 'google_workspace';

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

/**
 * Provider-specific picker service contract. Each picker service implements
 * `pick()`; the registry maps provider id to the Angular `Type` so consumers
 * can resolve the right service via `Injector.get(...)`.
 */
export interface IContentPickerService {
  pick(): import('rxjs').Observable<PickedFile | null>;
}

/** Lookup record describing a content provider for UI rendering and dispatch. */
export interface ContentProviderMetadata {
  id: ContentProviderId;
  displayNameKey: string;
  icon: string;
  supportsPicker: boolean;
  pickerService: Type<IContentPickerService>;
}

/** Outcome of a successful pick action. */
export interface PickedFile {
  fileId: string;
  name: string;
  mimeType: string;
  url: string;
}

/** Thrown when picker invocation requires a linked token that doesn't exist. */
export class ContentTokenNotLinkedError extends Error {
  override name = 'ContentTokenNotLinkedError';
  constructor(public readonly providerId: ContentProviderId) {
    super(`No linked content token for provider: ${providerId}`);
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
