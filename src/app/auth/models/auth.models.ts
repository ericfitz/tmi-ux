/**
 * Authentication models for the TMI application
 * These interfaces define the data structures used for authentication and authorization
 */

/**
 * JWT token information
 */
export interface JwtToken {
  /**
   * The JWT access token string
   */
  token: string;

  /**
   * The refresh token string (optional)
   */
  refreshToken?: string;

  /**
   * Token expiration time in seconds
   */
  expiresIn: number;

  /**
   * Calculated expiration date
   */
  expiresAt: Date;
}

/**
 * User profile information
 */
export interface UserProfile {
  /**
   * User's email address (used as the primary identifier)
   */
  email: string;

  /**
   * User's display name
   */
  name: string;

  /**
   * URL to the user's profile picture (optional)
   */
  picture?: string;
}

/**
 * OAuth response from the authorization server
 */
export interface OAuthResponse {
  /**
   * Authorization code returned from the OAuth provider
   */
  code: string;

  /**
   * State parameter for CSRF protection
   */
  state: string;
}

/**
 * Authentication error information
 */
export interface AuthError {
  /**
   * Error code
   */
  code: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Whether the error is retryable
   */
  retryable: boolean;
}

/**
 * User role in the system
 */
export enum UserRole {
  /**
   * Owner role - full control over resources
   */
  Owner = 'owner',

  /**
   * Writer role - can modify resources but not delete or change ownership
   */
  Writer = 'writer',

  /**
   * Reader role - read-only access to resources
   */
  Reader = 'reader',
}

/**
 * Authorization information for a resource
 */
export interface Authorization {
  /**
   * Subject (user identifier, typically email)
   */
  subject: string;

  /**
   * Role assigned to the subject
   */
  role: UserRole;
}
