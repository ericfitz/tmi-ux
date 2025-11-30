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
 * OAuth provider information for a user
 * @deprecated Use provider and provider_id fields on UserProfile instead
 */
export interface UserOAuthProvider {
  /**
   * OAuth provider name (e.g., "google", "github", "microsoft")
   */
  provider: string;

  /**
   * Whether this is the primary authentication method
   */
  is_primary: boolean;
}

/**
 * User profile information (matches backend Principal + User schema)
 * User identity is defined by the combination of (provider, provider_id)
 */
export interface UserProfile {
  /**
   * Identity provider name (e.g., "google", "github", "microsoft", "test")
   */
  provider: string;

  /**
   * Provider-assigned identifier (e.g., OAuth sub claim or provider-specific user ID)
   * This is the user's unique identifier within the context of their provider
   */
  provider_id: string;

  /**
   * User's display name (full name)
   */
  display_name: string;

  /**
   * User's email address
   */
  email: string;

  /**
   * Groups the user belongs to (nullable array of group names)
   */
  groups: string[] | null;

  /**
   * Whether the user has administrator privileges
   * Only populated when fetched from GET /users/me endpoint
   */
  is_admin?: boolean;
}

/**
 * OAuth response from the authorization server
 */
export interface OAuthResponse {
  /**
   * Authorization code returned from the OAuth provider
   */
  code?: string;

  /**
   * State parameter for CSRF protection
   */
  state?: string;

  /**
   * Access token from TMI OAuth proxy
   */
  access_token?: string;

  /**
   * Refresh token from TMI OAuth proxy
   */
  refresh_token?: string;

  /**
   * Token expiration time in seconds
   */
  expires_in?: number;

  /**
   * OAuth error code
   */
  error?: string;

  /**
   * OAuth error description
   */
  error_description?: string;
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
 * OAuth provider information from TMI server
 */
export interface OAuthProviderInfo {
  /**
   * Provider identifier
   */
  id: string;

  /**
   * Provider display name
   */
  name: string;

  /**
   * Provider icon (URL path relative to server root, or FontAwesome icon class prefixed with 'fa-')
   */
  icon: string;

  /**
   * TMI OAuth authorization URL for this provider
   */
  auth_url: string;

  /**
   * TMI OAuth callback URL
   */
  redirect_uri: string;

  /**
   * OAuth client ID (for display purposes only)
   */
  client_id: string;
}

/**
 * Response from TMI provider discovery endpoint
 */
export interface ProvidersResponse {
  /**
   * List of available OAuth providers
   */
  providers: OAuthProviderInfo[];
}

/**
 * SAML provider information from TMI server
 */
export interface SAMLProviderInfo {
  /**
   * Provider identifier
   */
  id: string;

  /**
   * Provider display name
   */
  name: string;

  /**
   * Provider icon (URL path relative to server root, or FontAwesome icon class prefixed with 'fa-')
   */
  icon: string;

  /**
   * TMI SAML login endpoint URL
   */
  auth_url: string;

  /**
   * SAML service provider metadata URL
   */
  metadata_url: string;

  /**
   * Service Provider entity ID
   */
  entity_id: string;

  /**
   * Assertion Consumer Service URL
   */
  acs_url: string;

  /**
   * Single Logout URL (optional)
   */
  slo_url?: string;
}

/**
 * Response from TMI SAML provider discovery endpoint
 */
export interface SAMLProvidersResponse {
  /**
   * List of available SAML providers
   */
  providers: SAMLProviderInfo[];
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
