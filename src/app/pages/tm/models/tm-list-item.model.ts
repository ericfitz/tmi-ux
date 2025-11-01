/**
 * TMListItem interface matching the API specification for GET /threat_models
 *
 * This represents the lightweight version of threat model data returned by the list endpoint,
 * containing essential metadata and entity counts without full nested data.
 */
export interface TMListItem {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
  owner: string;
  created_by: string;
  threat_model_framework: 'CIA' | 'STRIDE' | 'LINDDUN' | 'DIE' | 'PLOT4ai';
  issue_uri?: string;
  status?: string[];
  status_updated?: string;
  document_count: number;
  repo_count: number;
  diagram_count: number;
  threat_count: number;
  asset_count: number;
  note_count: number;
}
