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
// KNOWN DRIFT: Generated User requires email and display_name;
// manual User (extends Principal) has them optional.
// Manual → Generated fails because optional fields don't satisfy required ones.
// @ts-expect-error TS2344: Manual User has optional email/display_name, generated requires them
type _UserToApi = Assert<IsAssignableTo<User, ApiUser>>;
// Generated → Manual works because required fields satisfy optional ones.
type _UserFromApi = Assert<IsAssignableTo<ApiUser, User>>;

// ─── Authorization ───────────────────────────────────────────────────────────
// Manual Authorization is a flat interface; generated extends Principal with role.
// They should be structurally compatible.
type _AuthorizationToApi = Assert<IsAssignableTo<Authorization, ApiAuthorization>>;
type _AuthorizationFromApi = Assert<IsAssignableTo<ApiAuthorization, Authorization>>;

// ─── Document ────────────────────────────────────────────────────────────────
// KNOWN DRIFT: Generated Document has readonly id and uses DocumentBase composition.
// Generated Document has optional created_at/modified_at; manual has them required.
// Manual → Generated should work (required satisfies optional)
type _DocumentToApi = Assert<IsAssignableTo<TMDocument, ApiDocument>>;
// Generated → Manual may fail if generated has optional fields that manual requires
// @ts-expect-error TS2344: Generated Document has optional created_at/modified_at, manual requires them
type _DocumentFromApi = Assert<IsAssignableTo<ApiDocument, TMDocument>>;

// ─── Repository ──────────────────────────────────────────────────────────────
// Manual Repository is structurally assignable to generated (excess properties allowed).
type _RepositoryToApi = Assert<IsAssignableTo<Repository, ApiRepository>>;
// @ts-expect-error TS2344: Generated Repository has optional created_at/modified_at, manual requires them
type _RepositoryFromApi = Assert<IsAssignableTo<ApiRepository, Repository>>;

// ─── Note ────────────────────────────────────────────────────────────────────
// Manual Note is structurally assignable to generated (required fields satisfy optional).
type _NoteToApi = Assert<IsAssignableTo<Note, ApiNote>>;
// @ts-expect-error TS2344: Generated Note has optional created_at/modified_at, manual requires them
type _NoteFromApi = Assert<IsAssignableTo<ApiNote, Note>>;

// ─── Asset ───────────────────────────────────────────────────────────────────
// Manual Asset is structurally assignable to generated (string literal union assignable to string).
type _AssetToApi = Assert<IsAssignableTo<Asset, ApiAsset>>;
// @ts-expect-error TS2344: Generated Asset has optional created_at/modified_at, manual requires them
type _AssetFromApi = Assert<IsAssignableTo<ApiAsset, Asset>>;

// ─── Threat ──────────────────────────────────────────────────────────────────
// KNOWN DRIFT: Generated ThreatBase has cwe_id and cvss fields that manual Threat lacks.
// Manual Threat has required `severity: string | null`; generated has optional severity.
// Manual → Generated: manual has id/threat_model_id/created_at/modified_at that generated
// Threat also has (as readonly), so structurally compatible minus field type differences.
// @ts-expect-error TS2344: Manual Threat has severity as `string | null` (required), generated has optional string
type _ThreatToApi = Assert<IsAssignableTo<Threat, ApiThreat>>;
// @ts-expect-error TS2344: Generated Threat has optional id/created_at/modified_at, manual requires them
type _ThreatFromApi = Assert<IsAssignableTo<ApiThreat, Threat>>;

// ─── ThreatModel ─────────────────────────────────────────────────────────────
// KNOWN DRIFT: Generated ThreatModelBase has alias, security_reviewer, project_id
// that manual ThreatModel lacks. Generated ThreatModel has readonly server fields as optional.
// @ts-expect-error TS2344: Manual ThreatModel lacks alias, security_reviewer, project_id; authorization nullability differs
type _ThreatModelToApi = Assert<IsAssignableTo<ThreatModel, ApiThreatModel>>;
// @ts-expect-error TS2344: Generated ThreatModel has optional server fields that manual requires (id, created_at, etc.)
type _ThreatModelFromApi = Assert<IsAssignableTo<ApiThreatModel, ThreatModel>>;

// ─── TMListItem ──────────────────────────────────────────────────────────────
// KNOWN DRIFT: Manual has threat_model_framework as string literal union;
// generated has plain string. Manual has User references with optional fields.
// Generated has security_reviewer field that manual lacks.
// @ts-expect-error TS2344: Manual TMListItem User references have optional email/display_name, generated requires them
type _TMListItemToApi = Assert<IsAssignableTo<TMListItem, ApiTMListItem>>;
// @ts-expect-error TS2344: Generated TMListItem has string framework (manual expects literal union), plus security_reviewer
type _TMListItemFromApi = Assert<IsAssignableTo<ApiTMListItem, TMListItem>>;

// ─── Diagram ─────────────────────────────────────────────────────────────────
// NOTE: Manual Diagram is a simplified interface. Generated DfdDiagram/BaseDiagram
// has discriminated union cells (Node | Edge), readonly server fields, and type as enum.
// The Cell types are structurally very different (manual is loose, generated is strict).
// We compare against BaseDiagram since Diagram is the deprecated wrapper.
// @ts-expect-error TS2344: Manual Diagram type is string, generated is enum 'DFD-1.0.0'; cells type differs
type _DiagramToApi = Assert<IsAssignableTo<Diagram, ApiBaseDiagram>>;
// @ts-expect-error TS2344: Generated BaseDiagram has readonly id/created_at/modified_at, different cell types
type _DiagramFromApi = Assert<IsAssignableTo<ApiBaseDiagram, Diagram>>;

// ─── Summary of known drift ─────────────────────────────────────────────────
//
// Each @ts-expect-error above documents a specific incompatibility between
// the manual types and the OpenAPI spec. Key themes:
//
// 1. OPTIONAL vs REQUIRED (User fields):
//    Generated User requires email and display_name; manual User (extends
//    Principal) has them optional. This causes Manual→API failures for any
//    type containing User references (ThreatModel, TMListItem).
//
// 2. READONLY+OPTIONAL vs REQUIRED (server-managed fields):
//    Generated types have id, created_at, modified_at as `readonly` and
//    optional (since they're server-populated); manual types have them as
//    required. This causes API→Manual failures for Document, Note, Asset,
//    Repository, Threat, ThreatModel.
//
// 3. MISSING FIELDS in manual types:
//    - ThreatModel: alias, security_reviewer, project_id
//    - Threat: cwe_id, cvss
//    - TMListItem: security_reviewer
//
// 4. STRUCTURAL DIFFERENCES:
//    - Diagram/Cell: manual is a loose single interface; generated uses
//      Node|Edge discriminated union with strict shape enums
//    - TMListItem: manual restricts framework to 5 literal values;
//      generated allows any string
//
// These will be resolved incrementally in Phase 2+ of issue #372.
