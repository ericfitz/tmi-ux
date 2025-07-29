import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { UserProfile } from '../models/auth.models';

/**
 * Local OAuth provider service for development authentication
 * Provides local-only authentication that mimics OAuth flow without network calls
 */
@Injectable({
  providedIn: 'root',
})
export class LocalOAuthProviderService {
  private readonly users = environment.oauth?.local?.users || [
    { id: 'user1', name: 'User One', email: 'user1@example.com' },
    { id: 'user2', name: 'User Two', email: 'user2@example.com' },
    { id: 'user3', name: 'User Three', email: 'user3@example.com' },
  ];

  /**
   * Get available test users
   */
  getUsers(): Array<{ id: string; name: string; email: string; picture?: string }> {
    return this.users;
  }

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
   * Generate mock authorization code for local user
   */
  generateAuthCode(userId: string): string {
    return btoa(`local:${userId}:${Date.now()}`);
  }

  /**
   * Exchange authorization code for user profile (local only)
   */
  exchangeCodeForUser(code: string): UserProfile | null {
    try {
      const decoded = atob(code);
      const [provider, userId] = decoded.split(':');
      if (provider !== 'local') return null;

      const user = this.users.find(user => user.id === userId);
      if (!user) return null;

      return {
        email: user.email,
        name: user.name,
        picture: user.picture,
      };
    } catch {
      return null;
    }
  }
}
