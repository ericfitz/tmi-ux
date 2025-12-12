/**
 * Group type definitions for admin management
 * Based on TMI API /admin/groups endpoints
 */

/**
 * Group object with administrative fields and enriched data
 */
export interface AdminGroup {
  /** Internal system UUID for the group */
  internal_uuid: string;
  /** OAuth/SAML provider identifier, or "*" for provider-independent groups */
  provider: string;
  /** Provider-assigned group name */
  group_name: string;
  /** Human-readable group name */
  name?: string;
  /** Group description */
  description?: string;
  /** First time this group was referenced */
  first_used: string;
  /** Last time this group was referenced */
  last_used: string;
  /** Number of times this group has been referenced */
  usage_count: number;
  /** Whether this group is used in any authorizations (enriched) */
  used_in_authorizations?: boolean;
  /** Whether this group is used in any admin grants (enriched) */
  used_in_admin_grants?: boolean;
  /** Number of members in the group from IdP (enriched, if available) */
  member_count?: number;
}

/**
 * Filter parameters for listing groups
 */
export interface GroupFilter {
  /** Filter by OAuth/SAML provider (use "*" for provider-independent groups) */
  provider?: string;
  /** Filter by group name (case-insensitive substring match) */
  group_name?: string;
  /** Filter groups used (true) or not used (false) in authorizations */
  used_in_authorizations?: boolean;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
  /** Field to sort by */
  sort_by?: 'group_name' | 'first_used' | 'last_used' | 'usage_count';
  /** Sort direction */
  sort_order?: 'asc' | 'desc';
}

/**
 * Response from list groups endpoint
 */
export interface ListGroupsResponse {
  groups: AdminGroup[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Request to create a provider-independent group
 */
export interface CreateGroupRequest {
  /** Group identifier (alphanumeric, hyphens, underscores only) */
  group_name: string;
  /** Human-readable group name */
  name: string;
  /** Optional group description */
  description?: string;
}

/**
 * Group member object
 */
export interface GroupMember {
  /** Internal system UUID of the user */
  internal_uuid: string;
  /** OAuth/SAML provider identifier */
  provider: string;
  /** Provider-assigned user identifier */
  provider_user_id: string;
  /** User email address */
  email: string;
  /** User display name */
  name: string;
  /** When the user was added to the group */
  added_at: string;
}

/**
 * Response from list group members endpoint
 */
export interface ListGroupMembersResponse {
  members: GroupMember[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Request to add a member to a group
 */
export interface AddGroupMemberRequest {
  /** OAuth/SAML provider identifier */
  provider: string;
  /** Provider-assigned user identifier */
  provider_user_id: string;
}
