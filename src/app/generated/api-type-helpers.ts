/**
 * Convenient type aliases for generated OpenAPI types.
 *
 * These re-exports provide short, prefixed names for the generated types
 * from api-types.d.ts, avoiding naming collisions with existing manual types
 * during the migration period.
 *
 * Usage:
 *   import type { ApiThreatModel, ApiThreatInput } from '@app/generated/api-type-helpers';
 *
 * Generated from: tmi-openapi.json via openapi-typescript
 * @see https://github.com/ericfitz/tmi/blob/main/api-schema/tmi-openapi.json
 */
import type { components } from './api-types';

// ─── Response types (full objects returned by API) ───────────────────────────

export type ApiThreatModel = components['schemas']['ThreatModel'];
export type ApiThreatModelBase = components['schemas']['ThreatModelBase'];
export type ApiThreat = components['schemas']['Threat'];
export type ApiThreatBase = components['schemas']['ThreatBase'];
export type ApiDfdDiagram = components['schemas']['DfdDiagram'];
export type ApiBaseDiagram = components['schemas']['BaseDiagram'];
export type ApiDiagram = components['schemas']['Diagram'];
export type ApiDocument = components['schemas']['Document'];
export type ApiRepository = components['schemas']['Repository'];
export type ApiNote = components['schemas']['Note'];
export type ApiAsset = components['schemas']['Asset'];
export type ApiExtendedAsset = components['schemas']['ExtendedAsset'];

// ─── Input types (for POST/PUT request bodies) ──────────────────────────────

export type ApiThreatModelInput = components['schemas']['ThreatModelInput'];
export type ApiThreatInput = components['schemas']['ThreatInput'];
export type ApiDfdDiagramInput = components['schemas']['DfdDiagramInput'];
export type ApiBaseDiagramInput = components['schemas']['BaseDiagramInput'];
export type ApiCreateDiagramRequest = components['schemas']['CreateDiagramRequest'];
export type ApiDocumentInput = components['schemas']['DocumentInput'];
export type ApiDocumentBase = components['schemas']['DocumentBase'];
export type ApiRepositoryInput = components['schemas']['RepositoryInput'];
export type ApiNoteInput = components['schemas']['NoteInput'];
export type ApiAssetInput = components['schemas']['AssetInput'];

// ─── List item types (lightweight responses for list endpoints) ──────────────

export type ApiTMListItem = components['schemas']['TMListItem'];
export type ApiDiagramListItem = components['schemas']['DiagramListItem'];
export type ApiNoteListItem = components['schemas']['NoteListItem'];

// ─── Identity and authorization ──────────────────────────────────────────────

export type ApiPrincipal = components['schemas']['Principal'];
export type ApiUser = components['schemas']['User'];
export type ApiAuthorization = components['schemas']['Authorization'];

// ─── Shared/utility types ────────────────────────────────────────────────────

export type ApiMetadata = components['schemas']['Metadata'];
export type ApiCell = components['schemas']['Cell'];
export type ApiNode = components['schemas']['Node'];
export type ApiEdge = components['schemas']['Edge'];
export type ApiCollaborationSession = components['schemas']['CollaborationSession'];
export type ApiCVSSScore = components['schemas']['CVSSScore'];
export type ApiError = components['schemas']['Error'];

// ─── List response types ─────────────────────────────────────────────────────

export type ApiListThreatModelsResponse = components['schemas']['ListThreatModelsResponse'];
export type ApiListThreatsResponse = components['schemas']['ListThreatsResponse'];
export type ApiListDiagramsResponse = components['schemas']['ListDiagramsResponse'];
export type ApiListDocumentsResponse = components['schemas']['ListDocumentsResponse'];
export type ApiListNotesResponse = components['schemas']['ListNotesResponse'];
export type ApiListAssetsResponse = components['schemas']['ListAssetsResponse'];
export type ApiListRepositoriesResponse = components['schemas']['ListRepositoriesResponse'];
