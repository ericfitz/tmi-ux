import { Observable } from 'rxjs';
import { UserGroupMembership, UserProfile } from '@app/auth/models/auth.models';

/**
 * Authentication session info (no token strings — cookies are HttpOnly)
 */
export interface IAuthSession {
  expiresAt: Date;
  expiresIn: number;
}

/**
 * User profile information
 */
export interface IUserProfile {
  provider: string;
  provider_id: string;
  display_name: string;
  email: string;
  groups: UserGroupMembership[] | null;
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
   * Get the current user's provider ID (provider-assigned user identifier from JWT sub claim)
   */
  readonly providerId: string;

  /**
   * Get the current user's identity provider (from JWT idp claim)
   */
  readonly userIdp: string;

  /**
   * Get the current user's groups
   */
  readonly userGroups: string[];

  /**
   * Whether the user is currently authenticated
   */
  readonly isAuthenticated: boolean;

  /**
   * Get session info (expiry timing), or null if not authenticated
   */
  // SEM@a7d070cec042b44aeb8938d8dbe3942da8ee7dcf: return current session expiry timing, or null if not authenticated (pure)
  getSessionInfo(): IAuthSession | null;

  /**
   * Ensure the session is valid, refreshing if necessary
   */
  // SEM@a7d070cec042b44aeb8938d8dbe3942da8ee7dcf: validate the session and refresh the auth token if it is expiring
  ensureValidSession(): Observable<IAuthSession>;

  /**
   * Refresh user profile from server to get latest admin status and other fields
   */
  // SEM@44287f3f5c43dfa5aaf5fa36290065fd39725079: fetch the latest user profile from the server to update admin status and fields
  refreshUserProfile(): Observable<UserProfile>;

  /**
   * Force refresh session regardless of expiry time.
   * Used when a 401 is received and the session needs immediate renewal.
   */
  // SEM@27d4efda692a4a1467112e79bc4e5ccb0edf68ba: force an immediate session token refresh regardless of expiry, on 401 receipt
  forceRefreshToken(): Observable<IAuthSession>;

  /**
   * Log out the current user
   */
  // SEM@2d0a5fe4b5507768d4604debd61018f8d3909cec: terminate the current user session and clear authentication state
  logout(): void;
}
