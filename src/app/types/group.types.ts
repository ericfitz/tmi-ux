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
 * Supports both user members and nested group members via subject_type
 */
export interface GroupMember {
  /** Unique identifier for the membership record */
  id: string;
  /** Internal UUID of the group this membership belongs to */
  group_internal_uuid: string;
  /** Type of member: user (direct user) or group (nested group) */
  subject_type: 'user' | 'group';
  /** Internal UUID of the user (null when subject_type is group) */
  user_internal_uuid?: string | null;
  /** Email address of the user (null when subject_type is group) */
  user_email?: string | null;
  /** Display name of the user (null when subject_type is group) */
  user_name?: string | null;
  /** OAuth/SAML provider for the user (null when subject_type is group) */
  user_provider?: string | null;
  /** Provider-specific user identifier (null when subject_type is group) */
  user_provider_user_id?: string | null;
  /** Internal UUID of admin who added this member */
  added_by_internal_uuid?: string | null;
  /** Email of admin who added this member */
  added_by_email?: string | null;
  /** When the member was added to the group */
  added_at: string;
  /** Optional notes about this membership */
  notes?: string | null;
  /** Internal UUID of the member group (when subject_type is group) */
  member_group_internal_uuid?: string | null;
  /** Display name of the member group (when subject_type is group) */
  member_group_name?: string | null;
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
 * Provide user_internal_uuid for user members or member_group_internal_uuid for group members
 */
export interface AddGroupMemberRequest {
  /** Internal UUID of the user to add (required when subject_type is user) */
  user_internal_uuid?: string;
  /** Type of member to add: user or group */
  subject_type?: 'user' | 'group';
  /** Internal UUID of the group to add as member (required when subject_type is group) */
  member_group_internal_uuid?: string;
  /** Optional notes about this membership */
  notes?: string;
}
