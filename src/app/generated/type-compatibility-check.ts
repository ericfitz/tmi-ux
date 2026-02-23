/**
 * Compile-time compatibility checks between manual types and generated OpenAPI types.
 *
 * This file uses TypeScript conditional types to verify that the manually-maintained
 * model types remain compatible with the types generated from the OpenAPI spec.
 *
 * How it works:
 * - `IsAssignableTo<T, U>` checks whether T can be assigned to U
 * - Lines with `@ts-expect-error` document KNOWN drift between manual and generated types
 * - If drift is fixed, the `@ts-expect-error` will itself error (TS2578), prompting removal
 * - If new drift is introduced, a new compile error will appear here
 *
 * This file has no runtime impact — it contains only type-level assertions.
 */

import type {
  Metadata,
  Principal,
  User,
  Authorization,
  Document as TMDocument,
  Repository,
  Note,
  Asset,
  Threat,
  ThreatModel,
} from '@app/pages/tm/models/threat-model.model';
import type { TMListItem } from '@app/pages/tm/models/tm-list-item.model';
import type { Diagram } from '@app/pages/tm/models/diagram.model';
import type {
  ApiMetadata,
  ApiPrincipal,
  ApiUser,
  ApiAuthorization,
  ApiDocument,
  ApiRepository,
  ApiNote,
  ApiAsset,
  ApiThreat,
  ApiThreatModel,
  ApiTMListItem,
  ApiBaseDiagram,
} from './api-type-helpers';

// ─── Type assertion utilities ────────────────────────────────────────────────

/** True if T is assignable to U */
type IsAssignableTo<T, U> = [T] extends [U] ? true : false;

/** Compile-time assertion that a type equals `true` */
type Assert<T extends true> = T;

// ─── Metadata ────────────────────────────────────────────────────────────────
// Manual and generated Metadata types should be identical
type _MetadataToApi = Assert<IsAssignableTo<Metadata, ApiMetadata>>;
type _MetadataFromApi = Assert<IsAssignableTo<ApiMetadata, Metadata>>;

// ─── Principal ───────────────────────────────────────────────────────────────
// Manual Principal should be assignable to generated Principal (same structure)
type _PrincipalToApi = Assert<IsAssignableTo<Principal, ApiPrincipal>>;
type _PrincipalFromApi = Assert<IsAssignableTo<ApiPrincipal, Principal>>;

// ─── User ────────────────────────────────────────────────────────────────────
// Manual User now requires email and display_name, matching the generated type.
type _UserToApi = Assert<IsAssignableTo<User, ApiUser>>;
type _UserFromApi = Assert<IsAssignableTo<ApiUser, User>>;

// ─── Authorization ───────────────────────────────────────────────────────────
// Manual Authorization is a flat interface; generated extends Principal with role.
// They should be structurally compatible.
type _AuthorizationToApi = Assert<IsAssignableTo<Authorization, ApiAuthorization>>;
type _AuthorizationFromApi = Assert<IsAssignableTo<ApiAuthorization, Authorization>>;

// ─── Document ────────────────────────────────────────────────────────────────
// Manual → Generated works (required fields satisfy optional ones)
type _DocumentToApi = Assert<IsAssignableTo<TMDocument, ApiDocument>>;
// Generated → Manual: Generated has optional server-managed fields (id, created_at,
// modified_at) that manual requires. This is intentional — manual types model API
// responses where these fields are always present.
// @ts-expect-error TS2344: Generated Document has optional server-managed fields, manual requires them
type _DocumentFromApi = Assert<IsAssignableTo<ApiDocument, TMDocument>>;

// ─── Repository ──────────────────────────────────────────────────────────────
// Manual → Generated works (excess properties allowed, required satisfies optional)
type _RepositoryToApi = Assert<IsAssignableTo<Repository, ApiRepository>>;
// @ts-expect-error TS2344: Generated Repository has optional server-managed fields, manual requires them
type _RepositoryFromApi = Assert<IsAssignableTo<ApiRepository, Repository>>;

// ─── Note ────────────────────────────────────────────────────────────────────
// Manual → Generated works (required fields satisfy optional ones)
type _NoteToApi = Assert<IsAssignableTo<Note, ApiNote>>;
// @ts-expect-error TS2344: Generated Note has optional server-managed fields, manual requires them
type _NoteFromApi = Assert<IsAssignableTo<ApiNote, Note>>;

// ─── Asset ───────────────────────────────────────────────────────────────────
// Manual → Generated works (string literal union assignable to string)
type _AssetToApi = Assert<IsAssignableTo<Asset, ApiAsset>>;
// @ts-expect-error TS2344: Generated Asset has optional server-managed fields, manual requires them
type _AssetFromApi = Assert<IsAssignableTo<ApiAsset, Asset>>;

// ─── Threat ──────────────────────────────────────────────────────────────────
// REMAINING DRIFT: Manual Threat has `priority?: string | null` and
// `status?: string | null`; generated has them as `string?` (no null).
// @ts-expect-error TS2344: Manual Threat allows null on priority/status, generated does not
type _ThreatToApi = Assert<IsAssignableTo<Threat, ApiThreat>>;
// @ts-expect-error TS2344: Generated Threat has optional server-managed fields, manual requires them
type _ThreatFromApi = Assert<IsAssignableTo<ApiThreat, Threat>>;

// ─── ThreatModel ─────────────────────────────────────────────────────────────
// REMAINING DRIFT: Manual ThreatModel uses `assets?: Asset[]`; generated uses
// `ExtendedAsset[]`. Also nested Threat/Document types carry through their own drift.
// @ts-expect-error TS2344: Manual ThreatModel has Asset[] (generated expects ExtendedAsset[]), nested type drift
type _ThreatModelToApi = Assert<IsAssignableTo<ThreatModel, ApiThreatModel>>;
// @ts-expect-error TS2344: Generated ThreatModel has optional server-managed fields, manual requires them
type _ThreatModelFromApi = Assert<IsAssignableTo<ApiThreatModel, ThreatModel>>;

// ─── TMListItem ──────────────────────────────────────────────────────────────
// Manual → Generated: framework widened to string, security_reviewer added,
// User references now have required email/display_name.
type _TMListItemToApi = Assert<IsAssignableTo<TMListItem, ApiTMListItem>>;
// Generated → Manual: Generated TMListItem has optional/readonly server-managed
// fields (status_updated as string | null) that manual types define differently.
// @ts-expect-error TS2344: Generated TMListItem field nullability/optionality differs from manual
type _TMListItemFromApi = Assert<IsAssignableTo<ApiTMListItem, TMListItem>>;

// ─── Diagram ─────────────────────────────────────────────────────────────────
// Manual → Generated: Type narrowed to 'DFD-1.0.0', cells are structurally compatible.
type _DiagramToApi = Assert<IsAssignableTo<Diagram, ApiBaseDiagram>>;
// Generated → Manual: Generated BaseDiagram has optional server-managed fields
// and different cell types (Node | Edge discriminated union vs loose Cell interface).
// @ts-expect-error TS2344: Generated BaseDiagram has optional server-managed fields, different cell types
type _DiagramFromApi = Assert<IsAssignableTo<ApiBaseDiagram, Diagram>>;

// ─── Summary of remaining known drift ──────────────────────────────────────
//
// After resolving type compatibility issues from issue #372 Phase 2, the
// remaining @ts-expect-error directives document these asymmetries:
//
// 1. READONLY+OPTIONAL vs REQUIRED (server-managed fields):
//    Generated types have id, created_at, modified_at as `readonly` and
//    optional (modeling both input and output schemas); manual types have
//    them as required (modeling API responses only). This causes
//    Generated→Manual failures for: Document, Repository, Note, Asset,
//    Threat, ThreatModel, TMListItem, Diagram.
//
// 2. NULLABILITY (Threat priority/status):
//    Manual Threat has `priority?: string | null` and `status?: string | null`;
//    generated has them as optional string without null. This causes
//    Manual→Generated failure for Threat.
//
// 3. ASSET TYPE (ThreatModel):
//    Manual ThreatModel uses `assets?: Asset[]`; generated uses
//    `ExtendedAsset[]` (Asset + threat_model_id, created_at, modified_at).
//    Nested Threat type drift also propagates. This causes Manual→Generated
//    failure for ThreatModel.
