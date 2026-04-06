/**
 * Team feature type definitions
 * Types for teams used in team pickers and create/edit dialogs
 */

import { User } from '@app/pages/tm/models/threat-model.model';
import { Metadata } from '@app/types/metadata.types';

/**
 * Summary of a team for list views and pickers
 */
export interface TeamListItem {
  /** Team identifier (UUID) */
  id: string;
  /** Team name */
  name: string;
  /** Team description */
  description?: string | null;
  /** Team status */
  status?: string | null;
  /** Number of team members */
  member_count?: number;
  /** Number of projects associated with this team */
  project_count?: number;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at?: string;
}

/**
 * Input schema for creating a team (client-writable scalar fields only)
 */
export interface TeamInput {
  /** Team name (required) */
  name: string;
  /** Team description */
  description?: string;
  /** URL or reference to internal team page */
  uri?: string;
  /** Team email address */
  email_address?: string;
  /** Team status (e.g. active, archived) */
  status?: string;
}

/** Team member roles */
export type TeamMemberRole =
  | 'engineering_lead'
  | 'engineer'
  | 'product_manager'
  | 'business_leader'
  | 'security_specialist'
  | 'other';

/** All valid TeamMemberRole values, for use in dropdowns */
export const TEAM_MEMBER_ROLES: TeamMemberRole[] = [
  'engineering_lead',
  'engineer',
  'product_manager',
  'business_leader',
  'security_specialist',
  'other',
];

/** Relationship types between teams or projects */
export type RelationshipType =
  | 'parent'
  | 'child'
  | 'dependency'
  | 'dependent'
  | 'supersedes'
  | 'superseded_by'
  | 'related'
  | 'other';

/** All valid RelationshipType values, for use in dropdowns */
export const RELATIONSHIP_TYPES: RelationshipType[] = [
  'parent',
  'child',
  'dependency',
  'dependent',
  'supersedes',
  'superseded_by',
  'related',
  'other',
];

/** Team lifecycle statuses */
export type TeamStatus =
  | 'active'
  | 'on_hold'
  | 'winding_down'
  | 'archived'
  | 'forming'
  | 'merging'
  | 'splitting';

/** All valid TeamStatus values, for use in dropdowns */
export const TEAM_STATUSES: TeamStatus[] = [
  'active',
  'on_hold',
  'winding_down',
  'archived',
  'forming',
  'merging',
  'splitting',
];

/** A member of a team with their role */
export interface TeamMember {
  user_id: string;
  readonly user?: User | null;
  role?: TeamMemberRole;
  custom_role?: string;
}

/** A responsible party for a team or project */
export interface ResponsibleParty {
  user_id: string;
  readonly user?: User | null;
  role?: TeamMemberRole;
  custom_role?: string;
}

/** A relationship to another team */
export interface RelatedTeam {
  related_team_id: string;
  relationship: RelationshipType;
  custom_relationship?: string;
}

/** Patch input for partial team updates */
export interface TeamPatch {
  name?: string;
  description?: string;
  uri?: string;
  email_address?: string;
  status?: TeamStatus;
  members?: TeamMember[];
  responsible_parties?: ResponsibleParty[];
  related_teams?: RelatedTeam[];
  metadata?: Metadata[];
}

/**
 * Full team object returned from API (GET /teams/{id})
 */
export interface Team extends TeamInput {
  readonly id: string;
  readonly created_at: string;
  readonly modified_at?: string;
  readonly created_by?: User | null;
  readonly modified_by?: User | null;
  members?: TeamMember[];
  responsible_parties?: ResponsibleParty[];
  related_teams?: RelatedTeam[];
  metadata?: Metadata[];
}

/**
 * Paginated list of teams
 */
export interface ListTeamsResponse {
  /** Array of team summaries */
  teams: TeamListItem[];
  /** Total number of teams matching the filter */
  total: number;
  /** Maximum number of results per page */
  limit: number;
  /** Number of results skipped */
  offset: number;
}

/** Base fields for team/project notes (user-writable) */
export interface TeamProjectNoteInput {
  /** Note name (required) */
  name: string;
  /** Note content in markdown format (required) */
  content: string;
  /** Description of note purpose or context */
  description?: string;
  /** Whether the Timmy AI assistant is enabled for this note */
  timmy_enabled?: boolean;
  /** Controls note visibility — true = all members, false = admins/security reviewers only */
  sharable?: boolean;
}

/** Summary for list views (no content) */
export interface TeamNoteListItem {
  /** Note identifier (UUID) */
  id: string;
  /** Note name */
  name: string;
  /** Note description */
  description?: string;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
}

/** Full team note with content */
export interface TeamNote extends TeamProjectNoteInput {
  /** Note identifier (UUID, readonly) */
  readonly id: string;
  /** Creation timestamp (readonly) */
  readonly created_at: string;
  /** Last modification timestamp (readonly) */
  readonly modified_at: string;
}

/** Paginated list of team notes */
export interface ListTeamNotesResponse {
  /** Array of team note summaries */
  notes: TeamNoteListItem[];
  /** Total number of notes */
  total: number;
  /** Maximum number of results per page */
  limit: number;
  /** Number of results skipped */
  offset: number;
}

/**
 * Filter parameters for listing teams
 */
export interface TeamFilter {
  /** Maximum results */
  limit?: number;
  /** Results offset */
  offset?: number;
  /** Filter by name */
  name?: string;
  /** Filter by status */
  status?: string;
}
