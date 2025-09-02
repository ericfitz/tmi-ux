import { Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { UserProfile } from '../models/auth.models';
import { LoggerService } from '../../core/services/logger.service';

/**
 * Local OAuth provider service for development authentication
 * Provides local-only authentication that mimics OAuth flow without network calls
 */
@Injectable({
  providedIn: 'root',
})
export class LocalOAuthProviderService {
  constructor(
    private transloco: TranslocoService,
    private logger: LoggerService,
  ) {}
  /**
   * Build authorization URL for local provider
   * Points to local user selection component
   */
  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      provider: 'local',
      state,
      response_type: 'code',
    });
    return `${window.location.origin}/oauth2/local-select?${params}`;
  }

  /**
   * Generate mock authorization code for local user by email
   */
  generateAuthCodeForEmail(email: string): string {
    const code = btoa(`local:${email}`);
    this.logger.info('LocalOAuthProviderService.generateAuthCodeForEmail:', {
      email,
      code,
    });
    return code;
  }

  /**
   * Exchange authorization code for user profile (local only)
   */
  exchangeCodeForUser(code: string): UserProfile | null {
    try {
      const decoded = atob(code);
      const [provider, email] = decoded.split(':');
      if (provider !== 'local') return null;

      // Use hard-coded values for local OAuth provider
      const id = '0';
      // Ensure we always have a name, fallback to "Local User" if translation fails
      const name = this.transloco.translate('login.local.userName') || 'Local User';
      const userEmail = email || 'local@test.tmi';

      this.logger.info('LocalOAuthProviderService.exchangeCodeForUser:', {
        id,
        name,
        email: userEmail,
        translationResult: this.transloco.translate('login.local.userName'),
      });

      return {
        id,
        email: userEmail,
        name,
        providers: [{ provider: 'local', is_primary: true }],
        picture: undefined,
      };
    } catch {
      return null;
    }
  }
}
