import type { Metadata } from '@app/types/metadata.types';
import type {
  DocumentAccessDiagnostics,
  PickerRegistration,
} from '@app/core/models/content-provider.types';
// Re-export Metadata from shared types for backward compatibility
export type { Metadata } from '@app/types/metadata.types';

// Principal-based identity types
export type PrincipalType = 'user' | 'group';

export interface Principal {
  principal_type: PrincipalType;
  provider: string;
  provider_id: string;
  display_name?: string; // Optional: server-managed response-only field
  email?: string;
}

export interface User extends Principal {
  principal_type: 'user';
  email: string;
  display_name: string;
}

export interface Group extends Principal {
  principal_type: 'group';
}

export interface Authorization {
  principal_type: PrincipalType;
  provider: string;
  provider_id: string;
  display_name?: string; // Optional: server-managed response-only field
  email?: string;
  role: 'reader' | 'writer' | 'owner';
}

export interface Document {
  id: string;
  name: string;
  uri: string;
  description?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
  created_at: string;
  modified_at: string;
  metadata?: Metadata[];
  // Picker integration (#626)
  picker_registration?: PickerRegistration | null;
  access_status?: 'accessible' | 'pending_access' | 'auth_required' | 'unknown';
  access_diagnostics?: DocumentAccessDiagnostics | null;
  access_status_updated_at?: string | null;
}

export interface Repository {
  id: string;
  name: string;
  description?: string;
  type: 'git' | 'svn' | 'mercurial' | 'other';
  uri: string;
  parameters?: {
    refType: 'branch' | 'tag' | 'commit';
    refValue: string;
    subPath?: string;
  };
  include_in_report?: boolean;
  timmy_enabled?: boolean;
  created_at: string;
  modified_at: string;
  metadata?: Metadata[];
}

export interface Note {
  id: string;
  name: string;
  content: string;
  description?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
  created_at: string;
  modified_at: string;
  metadata?: Metadata[];
}

export interface Asset {
  id: string;
  name: string;
  description?: string;
  type: 'data' | 'hardware' | 'software' | 'infrastructure' | 'service' | 'personnel';
  criticality?: string | null;
  classification?: string[] | null;
  sensitivity?: string | null;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
  created_at: string;
  modified_at: string;
  metadata?: Metadata[];
}

export interface CVSSScore {
  vector: string;
  score: number;
}

export interface SSVCScore {
  vector: string;
  decision: string;
  methodology: string;
}

export interface Threat {
  id: string;
  threat_model_id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
  diagram_id?: string;
  cell_id?: string;
  severity?: string;
  score?: number;
  priority?: string | null;
  mitigated?: boolean;
  status?: string | null;
  mitigation?: string;
  threat_type: string[];
  asset_id?: string;
  issue_uri?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
  metadata?: Metadata[];
  cwe_id?: string[];
  cvss?: CVSSScore[];
  ssvc?: SSVCScore;
}

export interface ThreatModel {
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
  is_confidential?: boolean;
  authorization: Authorization[];
  metadata?: Metadata[];
  alias?: string[];
  security_reviewer?: User | null;
  project_id?: string | null;
  documents?: Document[];
  repositories?: Repository[];
  diagrams?: import('./diagram.model').Diagram[];
  notes?: Note[];
  assets?: Asset[];
  threats?: Threat[];
}
