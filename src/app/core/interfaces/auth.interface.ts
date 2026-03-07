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
 * @deprecated Use IAuthSession instead. Alias kept during migration.
 */
export type IJwtToken = IAuthSession;

/**
 * User profile information
 */
export interface IUserProfile {
  provider: string;
  provider_id: string;
  display_name: string;
  email: string;
  groups: UserGroupMembership[] | null;
  jwt_groups: string[] | null;
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
  getSessionInfo(): IAuthSession | null;

  /**
   * Ensure the session is valid, refreshing if necessary
   */
  ensureValidSession(): Observable<IAuthSession>;

  /**
   * Refresh user profile from server to get latest admin status and other fields
   */
  refreshUserProfile(): Observable<UserProfile>;

  /**
   * Log out the current user
   */
  logout(): void;
}
