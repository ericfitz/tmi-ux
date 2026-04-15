/**
 * User type definitions
 * Re-exports generated types and defines client-side filter types
 */
import { components } from '@app/generated/api-types';

/** Admin user object with enriched data */
export type AdminUser = components['schemas']['AdminUser'];

/** Response from list admin users endpoint */
export type ListAdminUsersResponse = components['schemas']['AdminUserListResponse'];

/** Request to create an automation account */
export type CreateAutomationAccountRequest =
  components['schemas']['CreateAutomationAccountRequest'];

/** Response from creating an automation account (includes user + credential) */
export type CreateAutomationAccountResponse =
  components['schemas']['CreateAutomationAccountResponse'];

/**
 * Filter parameters for listing admin users (client-side convenience type)
 */
export interface AdminUserFilter {
  /** Filter by OAuth/SAML provider */
  provider?: string;
  /** Filter by email (case-insensitive substring match) */
  email?: string;
  /** Filter by name (case-insensitive substring match) */
  name?: string;
  /** Filter by automation account status */
  automation?: boolean;
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
  sort_by?: 'created_at' | 'last_login' | 'email' | 'name';
  /** Sort order */
  sort_order?: 'asc' | 'desc';
}
