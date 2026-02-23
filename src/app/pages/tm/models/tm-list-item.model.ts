import { User } from './threat-model.model';

/**
 * TMListItem interface matching the API specification for GET /threat_models
 *
 * This represents the lightweight version of threat model data returned by the list endpoint,
 * containing essential metadata and entity counts without full nested data.
 *
 * Identity Fields:
 * - owner: User object representing the current owner
 * - created_by: User object representing the creator
 */
export interface TMListItem {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
  owner: User;
  created_by: User;
  threat_model_framework: string;
  issue_uri?: string;
  status?: string | null;
  status_updated?: string;
  security_reviewer?: User | null;
  document_count: number;
  repo_count: number;
  diagram_count: number;
  threat_count: number;
  asset_count: number;
  note_count: number;
}
