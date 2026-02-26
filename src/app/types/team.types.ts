/**
 * Team feature type definitions
 * Types for teams used in team pickers and create/edit dialogs
 */

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

/**
 * Full team object returned from API
 */
export interface Team extends TeamInput {
  /** Unique identifier (UUID, readonly) */
  readonly id: string;
  /** Creation timestamp (readonly) */
  readonly created_at: string;
  /** Last modification timestamp (readonly) */
  readonly modified_at?: string;
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
