/**
 * User type definitions
 * Based on TMI API /admin/users endpoints
 */

/**
 * Admin user object with enriched data
 */
export interface AdminUser {
  /** Internal system UUID for the user */
  internal_uuid: string;
  /** OAuth/SAML provider identifier */
  provider: string;
  /** Provider-assigned user identifier */
  provider_user_id: string;
  /** User email address */
  email: string;
  /** User display name */
  name: string;
  /** Whether the email has been verified */
  email_verified: boolean;
  /** Account creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
  /** Last login timestamp */
  last_login?: string | null;
  /** Whether the user has administrator privileges (enriched) */
  is_admin?: boolean;
  /** List of group names the user belongs to (enriched) */
  groups?: string[];
  /** Number of active threat models owned by user (enriched) */
  active_threat_models?: number;
}

/**
 * Filter parameters for listing admin users
 */
export interface AdminUserFilter {
  /** Filter by OAuth/SAML provider */
  provider?: string;
  /** Filter by email (case-insensitive substring match) */
  email?: string;
  /** Filter users created after this timestamp (RFC3339) */
  created_after?: string;
  /** Filter users created before this timestamp (RFC3339) */
  created_before?: string;
  /** Filter users who logged in after this timestamp (RFC3339) */
  last_login_after?: string;
  /** Filter users who logged in before this timestamp (RFC3339) */
  last_login_before?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
  /** Sort field */
  sort_by?: 'created_at' | 'modified_at' | 'last_login' | 'email';
  /** Sort order */
  sort_order?: 'asc' | 'desc';
}

/**
 * Response from list admin users endpoint
 */
export interface ListAdminUsersResponse {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}
