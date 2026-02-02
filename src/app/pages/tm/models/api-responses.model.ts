/**
 * API response types for threat model list endpoints
 * All list endpoints return wrapped responses with pagination metadata
 */

import { PaginationMetadata } from '@app/types/api-responses.types';
import { TMListItem } from './tm-list-item.model';
import { Diagram } from './diagram.model';
import { Document, Repository, Note, Asset, Threat } from './threat-model.model';

/**
 * Response from GET /threat_models
 */
export interface ListThreatModelsResponse extends PaginationMetadata {
  threat_models: TMListItem[];
}

/**
 * Response from GET /threat_models/{id}/diagrams
 */
export interface ListDiagramsResponse extends PaginationMetadata {
  diagrams: Diagram[];
}

/**
 * Response from GET /threat_models/{id}/documents
 */
export interface ListDocumentsResponse extends PaginationMetadata {
  documents: Document[];
}

/**
 * Response from GET /threat_models/{id}/repositories
 */
export interface ListRepositoriesResponse extends PaginationMetadata {
  repositories: Repository[];
}

/**
 * Response from GET /threat_models/{id}/notes
 */
export interface ListNotesResponse extends PaginationMetadata {
  notes: Note[];
}

/**
 * Response from GET /threat_models/{id}/assets
 */
export interface ListAssetsResponse extends PaginationMetadata {
  assets: Asset[];
}

/**
 * Response from GET /threat_models/{id}/threats
 */
export interface ListThreatsResponse extends PaginationMetadata {
  threats: Threat[];
}
