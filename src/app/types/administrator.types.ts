/**
 * Administrator grant type definitions
 * Based on TMI API /admin/administrators endpoints
 */

/**
 * Administrator grant representing system-wide admin privileges
 * for a user or group from a specific provider
 */
export interface Administrator {
  /** Administrator grant identifier */
  id: string;
  /** User ID (if user-based grant) */
  user_id: string | null;
  /** User email (enriched from user profile) */
  user_email: string | null;
  /** User name (enriched from user profile) */
  user_name: string | null;
  /** Group ID (if group-based grant) */
  group_id: string | null;
  /** Group name (enriched from group info) */
  group_name: string | null;
  /** OAuth/SAML provider */
  provider: string;
  /** Creation timestamp */
  created_at: string;
}

/**
 * Request to create a new administrator grant
 * Exactly one of email, provider_user_id, or group_name must be specified
 */
export interface CreateAdministratorRequest {
  /** OAuth/SAML provider */
  provider: string;
  /** User email to grant admin privileges (mutually exclusive with provider_user_id and group_name) */
  email?: string;
  /** Provider's user ID to grant admin privileges (mutually exclusive with email and group_name) */
  provider_user_id?: string;
  /** Group name to grant admin privileges (mutually exclusive with email and provider_user_id) */
  group_name?: string;
}

/**
 * Filter parameters for listing administrators
 */
export interface AdministratorFilter {
  /** Filter by OAuth/SAML provider */
  provider?: string;
  /** Filter by user ID */
  user_id?: string;
  /** Filter by group ID */
  group_id?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
}

/**
 * Response from list administrators endpoint
 */
export interface ListAdministratorsResponse {
  administrators: Administrator[];
  total: number;
}
