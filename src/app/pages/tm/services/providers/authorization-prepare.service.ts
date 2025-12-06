import { Injectable } from '@angular/core';
import { Authorization } from '../../models/threat-model.model';
import { ProviderAdapterService } from './provider-adapter.service';
import { LoggerService } from '@app/core/services/logger.service';

/**
 * Service that prepares Authorization objects for API submission.
 * Handles subject field parsing, provider transformation, and validation.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthorizationPrepareService {
  /**
   * Simple email validation regex
   * Matches basic email format: user@domain.tld
   */
  private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    private providerAdapter: ProviderAdapterService,
    private logger: LoggerService,
  ) {}

  /**
   * Prepare authorizations for API submission
   * Applies the following transformations:
   * 1. Parse subject field into provider_id and/or email
   * 2. Transform provider IDs (e.g., tmi → *)
   * 3. Validate authorization objects
   *
   * @param authorizations - Array of authorizations from the UI
   * @returns Array of authorizations ready for API submission
   */
  prepareForApi(authorizations: Authorization[]): Authorization[] {
    return authorizations.map(auth => {
      // Extract subject from temporary field if it exists
      interface AuthorizationWithSubject extends Authorization {
        _subject?: string;
        display_name?: string;
      }
      const authWithSubject = auth as AuthorizationWithSubject;
      const subject = authWithSubject._subject || auth.email || auth.provider_id || '';

      // Parse subject into provider_id and email based on rules
      const parsed = this.parseSubject(subject, auth.provider, auth.principal_type);

      // Create prepared authorization with transformed values
      const prepared: Authorization = {
        ...auth,
        provider: this.providerAdapter.transformProviderForApi(auth.provider),
        provider_id: parsed.provider_id,
        email: parsed.email,
      };

      // Remove temporary _subject field if it exists
      const preparedWithSubject = prepared as AuthorizationWithSubject;
      delete preparedWithSubject._subject;

      // Remove read-only display_name field (server-managed response-only field)
      delete preparedWithSubject.display_name;

      // Validate (log warnings for invalid entries)
      const validationError = this.validate(prepared);
      if (validationError) {
        this.logger.warn(`Invalid authorization: ${validationError}`, prepared);
      }

      return prepared;
    });
  }

  /**
   * Parse subject field into provider_id and email based on business rules
   *
   * Rules:
   * 1. If provider is "tmi" OR principal_type is "group": treat as provider_id
   * 2. Else if subject matches email regex: treat as email
   * 3. Else: treat as provider_id
   *
   * @param subject - The subject value entered by the user
   * @param provider - The selected provider
   * @param principalType - The principal type (user or group)
   * @returns Parsed provider_id and email fields
   */
  parseSubject(
    subject: string,
    provider: string,
    principalType: 'user' | 'group',
  ): {
    provider_id: string;
    email: string | undefined;
  } {
    const trimmedSubject = subject.trim();

    // Rule 1: If provider is "tmi" OR principal_type is "group", treat as provider_id
    if (provider === 'tmi' || principalType === 'group') {
      return { provider_id: trimmedSubject, email: undefined };
    }

    // Rule 2: If subject matches email regex, treat as email
    if (this.EMAIL_REGEX.test(trimmedSubject)) {
      return { provider_id: '', email: trimmedSubject };
    }

    // Rule 3: Otherwise treat as provider_id
    return { provider_id: trimmedSubject, email: undefined };
  }

  /**
   * Validate an authorization object
   *
   * @param authorization - The authorization to validate
   * @returns Error message if invalid, null if valid
   */
  validate(authorization: Authorization): string | null {
    // Check if provider supports the principal type
    if (
      !this.providerAdapter.isValidForPrincipalType(
        authorization.provider,
        authorization.principal_type,
      )
    ) {
      return `Provider "${authorization.provider}" does not support "${authorization.principal_type}" principals`;
    }

    // Check if provider_id is provided (required field)
    if (!authorization.provider_id?.trim() && !authorization.email?.trim()) {
      return 'Either provider_id or email is required';
    }

    // Validation passed
    return null;
  }
}
