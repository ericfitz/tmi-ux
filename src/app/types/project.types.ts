/**
 * Project feature type definitions
 * Types for projects used in project pickers and create/edit dialogs
 */

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
