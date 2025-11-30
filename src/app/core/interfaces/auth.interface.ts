import { Observable } from 'rxjs';
import { UserProfile } from '@app/auth/models/auth.models';

/**
 * JWT token structure
 */
export interface IJwtToken {
  token: string;
  refreshToken?: string;
  expiresAt: Date;
  expiresIn: number;
}

/**
 * User profile information
 */
export interface IUserProfile {
  id: string;
  email: string;
  name: string;
  provider: string;
  provider_id: string;
  groups?: string[];
  is_admin?: boolean;
}

/**
 * Interface for authentication service used by core services
 * This interface prevents core services from directly importing feature modules
 */
export interface IAuthService {
  /**
   * Get the current user's profile
   */
  readonly userProfile: IUserProfile | null;

  /**
   * Get the current user's email
   */
  readonly userEmail: string;

  /**
   * Get the current user's ID (provider_id from JWT sub claim)
   */
  readonly userId: string;

  /**
   * Get the current user's identity provider (from JWT idp claim)
   */
  readonly userIdp: string;

  /**
   * Get the current user's groups
   */
  readonly userGroups: string[];

  /**
   * Get the stored JWT token
   */
  getStoredToken(): IJwtToken | null;

  /**
   * Get a valid access token, refreshing if necessary
   */
  getValidToken(): Observable<IJwtToken>;

  /**
   * Refresh user profile from server to get latest admin status and other fields
   */
  refreshUserProfile(): Observable<UserProfile>;

  /**
   * Log out the current user
   */
  logout(): void;
}
