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

      // Generate a display name from the email
      const name = this.generateDisplayName(email);

      return {
        id: this.generateUUID(),
        email,
        name,
        providers: [{ provider: 'local', is_primary: true }],
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

  /**
   * Generate a UUID for user identification
   * @returns UUID string
   */
  private generateUUID(): string {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback UUID v4 implementation for test environments
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
