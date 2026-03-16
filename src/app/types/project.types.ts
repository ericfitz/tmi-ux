/**
 * Project feature type definitions
 * Types for projects used in project pickers and create/edit dialogs
 */

import { User } from '@app/pages/tm/models/threat-model.model';
import { Metadata } from '@app/types/metadata.types';
import { ResponsibleParty, RelationshipType, Team } from '@app/types/team.types';

/**
 * Summary of a project for list views and pickers
 */
export interface ProjectListItem {
  /** Project identifier (UUID) */
  id: string;
  /** Project name */
  name: string;
  /** Project description */
  description?: string | null;
  /** Project status */
  status?: string | null;
  /** UUID of the team this project belongs to */
  team_id: string;
  /** Name of the associated team */
  team_name?: string;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at?: string;
}

/**
 * Input schema for creating a project (client-writable scalar fields only)
 */
export interface ProjectInput {
  /** Project name (required) */
  name: string;
  /** Project description */
  description?: string;
  /** UUID of the team this project belongs to (required) */
  team_id: string;
  /** URL or reference to internal project page */
  uri?: string;
  /** Project status (e.g. active, planning, archived) */
  status?: string;
}

/** Project lifecycle statuses */
export type ProjectStatus =
  | 'active'
  | 'planning'
  | 'on_hold'
  | 'completed'
  | 'archived'
  | 'cancelled';

/** All valid ProjectStatus values, for use in dropdowns */
export const PROJECT_STATUSES: ProjectStatus[] = [
  'active',
  'planning',
  'on_hold',
  'completed',
  'archived',
  'cancelled',
];

/** A relationship to another project */
export interface RelatedProject {
  related_project_id: string;
  relationship: RelationshipType;
  custom_relationship?: string;
}

/** Patch input for partial project updates */
export interface ProjectPatch {
  name?: string;
  description?: string;
  team_id?: string;
  uri?: string;
  status?: ProjectStatus;
  responsible_parties?: ResponsibleParty[];
  related_projects?: RelatedProject[];
  metadata?: Metadata[];
}

/**
 * Full project object returned from API
 */
export interface Project extends ProjectInput {
  /** Unique identifier (UUID, readonly) */
  readonly id: string;
  /** Creation timestamp (readonly) */
  readonly created_at: string;
  /** Last modification timestamp (readonly) */
  readonly modified_at?: string;
  /** User who created the project */
  created_by?: User | null;
  /** User who last modified the project */
  modified_by?: User | null;
  /** Team associated with this project */
  team?: Team | null;
  /** User who reviewed this project */
  reviewed_by?: User | null;
  /** Timestamp of the last review */
  reviewed_at?: string | null;
  /** Responsible parties for this project */
  responsible_parties?: ResponsibleParty[];
  /** Related projects */
  related_projects?: RelatedProject[];
  /** Project metadata */
  metadata?: Metadata[];
}

/**
 * Paginated list of projects
 */
export interface ListProjectsResponse {
  /** Array of project summaries */
  projects: ProjectListItem[];
  /** Total number of projects matching the filter */
  total: number;
  /** Maximum number of results per page */
  limit: number;
  /** Number of results skipped */
  offset: number;
}

/**
 * Filter parameters for listing projects
 */
export interface ProjectFilter {
  /** Maximum results */
  limit?: number;
  /** Results offset */
  offset?: number;
  /** Filter by name */
  name?: string;
  /** Filter by status */
  status?: string;
  /** Filter by team */
  team_id?: string;
}
