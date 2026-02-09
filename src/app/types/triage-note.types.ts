import { User } from '@app/pages/tm/models/threat-model.model';

/**
 * Complete triage note with server-generated fields
 */
export interface TriageNote {
  id: number;
  name: string;
  content: string;
  created_at: string;
  created_by?: User;
  modified_at: string;
  modified_by?: User;
}

/**
 * Summary of a triage note for list endpoints
 */
export interface TriageNoteListItem {
  id: number;
  name: string;
  created_at: string;
  created_by?: User;
}

/**
 * Request to create a new triage note
 */
export interface CreateTriageNoteRequest {
  name: string;
  content: string;
}

/**
 * Paginated list of triage notes
 */
export interface ListTriageNotesResponse {
  triage_notes: TriageNoteListItem[];
  total: number;
  limit: number;
  offset: number;
}
