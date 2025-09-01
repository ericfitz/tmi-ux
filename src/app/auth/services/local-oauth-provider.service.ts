import { Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { UserProfile } from '../models/auth.models';

/**
 * Local OAuth provider service for development authentication
 * Provides local-only authentication that mimics OAuth flow without network calls
 */
@Injectable({
  providedIn: 'root',
})
export class LocalOAuthProviderService {
  constructor(private transloco: TranslocoService) {}
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
    return btoa(`local:${email}:${Date.now()}`);
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
      const name = this.transloco.translate('login.local.userName');
      const userEmail = email || 'local@test.tmi';

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
