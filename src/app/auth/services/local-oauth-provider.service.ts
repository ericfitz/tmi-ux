import { Injectable } from '@angular/core';
import { UserProfile } from '../models/auth.models';

/**
 * Local OAuth provider service for development authentication
 * Provides local-only authentication that mimics OAuth flow without network calls
 */
@Injectable({
  providedIn: 'root',
})
export class LocalOAuthProviderService {

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
    return `${window.location.origin}/auth/local-select?${params}`;
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

      // Generate a display name from the email
      const name = this.generateDisplayName(email);

      return {
        email,
        name,
        picture: undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Generate a display name from an email address
   */
  private generateDisplayName(email: string): string {
    // Extract the part before @ and capitalize first letter of each word
    const username = email.split('@')[0];
    return username
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
}
