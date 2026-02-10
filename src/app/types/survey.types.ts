/**
 * Survey feature type definitions
 * Types for surveys, responses, and SurveyJS JSON schema
 */

import { User, Authorization } from '@app/pages/tm/models/threat-model.model';

// ============================================
// Survey Types
// ============================================

/**
 * Status of a survey
 */
export type SurveyStatus = 'active' | 'inactive' | 'archived';

/**
 * Settings for a survey
 */
export interface SurveySettings {
  /** Whether responses can link to existing threat models for re-reviews */
  allow_threat_model_linking: boolean;
}

/**
 * Key-value metadata pair
 */
export interface Metadata {
  key: string;
  value: string;
}

/**
 * Full survey (returned from single-resource GET endpoints)
 */
export interface Survey {
  /** Survey identifier */
  id: string;
  /** Survey display name */
  name: string;
  /** Survey description */
  description?: string;
  /** Current status */
  status: SurveyStatus;
  /** Custom version string (e.g., "2024-Q1", "v2-pilot") */
  version: string;
  /** Complete SurveyJS JSON definition */
  survey_json: SurveyJsonSchema;
  /** Survey settings */
  settings?: SurveySettings;
  /** Optional metadata key-value pairs */
  metadata?: Metadata[] | null;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
  /** User who created the survey */
  created_by: User;
}

/**
 * Survey summary (returned from list endpoints)
 */
export interface SurveyListItem {
  /** Survey identifier */
  id: string;
  /** Survey display name */
  name: string;
  /** Survey description */
  description?: string;
  /** Custom version string */
  version: string;
  /** Current status */
  status: SurveyStatus;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at?: string;
  /** User who created the survey */
  created_by?: User;
}

// ============================================
// SurveyJS JSON Schema Types
// ============================================

/**
 * Supported question types (SurveyJS compatible)
 */
export type QuestionType =
  | 'text'
  | 'comment'
  | 'radiogroup'
  | 'checkbox'
  | 'boolean'
  | 'dropdown'
  | 'panel'
  | 'paneldynamic';

/**
 * Input types for text questions
 */
export type TextInputType = 'text' | 'email' | 'url' | 'date' | 'number';

/**
 * Choice item for choice-based questions
 */
export interface ChoiceItem {
  /** Value stored in response data */
  value: string;
  /** Display text shown to user */
  text: string;
}

/**
 * TM field paths that can be mapped from survey questions
 */
export type TmFieldPath =
  | 'name'
  | 'description'
  | 'issue_uri'
  | 'metadata.{key}'
  | 'assets[].name'
  | 'assets[].description'
  | 'assets[].type'
  | 'documents[].name'
  | 'documents[].uri'
  | 'repositories[].name'
  | 'repositories[].uri';

/**
 * Configuration for mapping a survey question to a TM field
 */
export interface TmFieldMapping {
  /** Target TM field path */
  path: TmFieldPath;
  /** Key name when path is metadata.{key} */
  metadataKey?: string;
  /** Optional transformation expression */
  transformExpression?: string;
}

/**
 * Survey question definition (SurveyJS compatible with TMI extensions)
 */
export interface SurveyQuestion {
  /** Question type */
  type: QuestionType;
  /** Unique identifier within the survey */
  name: string;
  /** Display title/label */
  title?: string;
  /** Help text description */
  description?: string;
  /** Whether the question is required */
  isRequired?: boolean;

  // Visibility/enablement logic (SurveyJS expressions)
  /** Expression to control visibility */
  visibleIf?: string;
  /** Expression to control enabled state */
  enableIf?: string;
  /** Expression to control required state */
  requiredIf?: string;
  /** Expression to compute default value */
  defaultValueExpression?: string;

  // Text-specific properties
  /** Input type for text questions */
  inputType?: TextInputType;
  /** Maximum character length */
  maxLength?: number;
  /** Placeholder text */
  placeholder?: string;

  // Number-specific properties (rating type)
  /** Minimum value for rating */
  rateMin?: number;
  /** Maximum value for rating */
  rateMax?: number;

  // Choice-based question properties
  /** Static list of choices */
  choices?: ChoiceItem[] | string[];
  /** Reference to another question for dynamic choices */
  choicesFromQuestion?: string;
  /** Whether to show "Other" option */
  hasOther?: boolean;
  /** Label for "Other" option */
  otherText?: string;

  // Dropdown-specific properties
  /** Enable autocomplete filtering */
  choicesEnableAutocomplete?: boolean;

  // Panel-specific properties
  /** Child elements for panel */
  elements?: SurveyQuestion[];

  // Dynamic panel specific properties
  /** Template elements repeated in each panel */
  templateElements?: SurveyQuestion[];
  /** Initial panel count */
  panelCount?: number;
  /** Minimum panels allowed */
  minPanelCount?: number;
  /** Maximum panels allowed */
  maxPanelCount?: number;
  /** Text for "Add" button */
  panelAddText?: string;
  /** Text for "Remove" button */
  panelRemoveText?: string;

  // TMI Extension: TM field mapping
  /** Maps this question's answer to a TM field */
  mapsToTmField?: TmFieldMapping;
}

/**
 * Survey page containing questions
 */
export interface SurveyPage {
  /** Page identifier */
  name: string;
  /** Page title */
  title?: string;
  /** Page description */
  description?: string;
  /** Questions/elements on this page */
  elements: SurveyQuestion[];
  /** Expression to control page visibility */
  visibleIf?: string;
}

/**
 * Complete SurveyJS JSON schema
 */
export interface SurveyJsonSchema {
  /** ID of the survey this JSON belongs to */
  survey_id?: string;
  /** Survey title */
  title?: string;
  /** Survey description */
  description?: string;
  /** Logo position */
  logoPosition?: 'left' | 'right' | 'top' | 'bottom' | 'none';
  /** Survey pages */
  pages: SurveyPage[];
  /** Progress bar position */
  showProgressBar?: 'off' | 'top' | 'bottom' | 'both';
  /** Question numbering */
  showQuestionNumbers?: 'off' | 'on' | 'onPage';
  /** Question title location */
  questionTitleLocation?: 'top' | 'left' | 'bottom';
  /** Whether to show completion page */
  showCompletedPage?: boolean;
  /** Custom HTML for completion page */
  completedHtml?: string;
}

// ============================================
// Survey Response Types
// ============================================

/**
 * Status of a survey response in the triage workflow
 */
export type ResponseStatus =
  | 'draft'
  | 'submitted'
  | 'needs_revision'
  | 'ready_for_review'
  | 'review_created';

/**
 * SurveyJS UI state for draft restoration
 */
export interface SurveyUIState {
  /** Current page index */
  currentPageNo: number;
  /** Whether the survey was completed */
  isCompleted: boolean;
}

/**
 * Full survey response (returned from single-resource GET endpoints)
 */
export interface SurveyResponse {
  /** Response identifier */
  id: string;
  /** Survey identifier */
  survey_id: string;
  /** Survey version captured at creation */
  survey_version: string;
  /** Current status */
  status: ResponseStatus;
  /** Whether Security Reviewers group was excluded */
  is_confidential: boolean;
  /** Question answers keyed by question name */
  answers: Record<string, unknown>;
  /** UI state for draft restoration */
  ui_state?: SurveyUIState;
  /** Snapshot of the survey_json from the survey version used at creation (read-only) */
  survey_json?: SurveyJsonSchema;
  /** Link to existing threat model for re-reviews */
  linked_threat_model_id?: string;
  /** ID of threat model created from this response */
  created_threat_model_id?: string;
  /** Notes from security reviewer when returned for revision */
  revision_notes?: string;
  /** Optional metadata key-value pairs */
  metadata?: Metadata[] | null;
  /** User who created the response */
  owner: User;
  /** Access control list */
  authorization?: Authorization[];
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
  /** When the response was submitted */
  submitted_at?: string;
  /** When the response was last reviewed */
  reviewed_at?: string;
  /** Security engineer who last reviewed */
  reviewed_by?: User;
  /** User who created the response (server-generated) */
  created_by?: User;
}

/**
 * Survey response summary (returned from list endpoints)
 */
export interface SurveyResponseListItem {
  /** Response identifier */
  id: string;
  /** Survey identifier */
  survey_id: string;
  /** Survey name (denormalized for display) */
  survey_name?: string;
  /** Survey version used */
  survey_version?: string;
  /** Current status */
  status: ResponseStatus;
  /** Whether this is a confidential project */
  is_confidential?: boolean;
  /** User who created the response */
  owner: User;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at?: string;
  /** When the response was submitted */
  submitted_at?: string;
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Filter parameters for listing surveys
 */
export interface SurveyFilter {
  /** Filter by status */
  status?: SurveyStatus;
  /** Sort order (e.g., "created_at:desc", "name:asc") */
  sort?: string;
  /** Filter surveys created after this timestamp (ISO 8601) */
  created_after?: string;
  /** Filter surveys created before this timestamp (ISO 8601) */
  created_before?: string;
  /** Filter surveys modified after this timestamp (ISO 8601) */
  modified_after?: string;
  /** Filter surveys modified before this timestamp (ISO 8601) */
  modified_before?: string;
  /** Maximum results */
  limit?: number;
  /** Results offset */
  offset?: number;
}

/**
 * Response from list surveys endpoint
 */
export interface ListSurveysResponse {
  surveys: SurveyListItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Request to create a new survey
 */
export interface CreateSurveyRequest {
  /** Survey name */
  name: string;
  /** Custom version string */
  version: string;
  /** SurveyJS JSON definition */
  survey_json: SurveyJsonSchema;
  /** Survey description */
  description?: string;
  /** Initial status (defaults to inactive) */
  status?: SurveyStatus;
  /** Survey settings */
  settings?: SurveySettings;
}

/**
 * Request to update a survey (full PUT)
 */
export interface UpdateSurveyRequest {
  /** Survey name */
  name: string;
  /** Custom version string */
  version: string;
  /** SurveyJS JSON definition */
  survey_json: SurveyJsonSchema;
  /** Survey description */
  description?: string;
  /** Status */
  status?: SurveyStatus;
  /** Survey settings */
  settings?: SurveySettings;
}

/**
 * Filter parameters for listing survey responses
 */
export interface SurveyResponseFilter {
  /** Filter by survey */
  survey_id?: string;
  /** Filter by status */
  status?: ResponseStatus;
  /** Filter by confidentiality (triage only) */
  is_confidential?: boolean;
  /** Sort order (e.g., "created_at:desc") */
  sort?: string;
  /** Filter responses created after this timestamp (ISO 8601) */
  created_after?: string;
  /** Filter responses created before this timestamp (ISO 8601) */
  created_before?: string;
  /** Filter responses modified after this timestamp (ISO 8601) */
  modified_after?: string;
  /** Filter responses modified before this timestamp (ISO 8601) */
  modified_before?: string;
  /** Maximum results */
  limit?: number;
  /** Results offset */
  offset?: number;
}

/**
 * Response from list responses endpoint
 */
export interface ListSurveyResponsesResponse {
  survey_responses: SurveyResponseListItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Request to create a new survey response (draft)
 */
export interface CreateSurveyResponseRequest {
  /** Survey to fill out */
  survey_id: string;
  /** Initial answers */
  answers?: Record<string, unknown>;
  /** Link to existing threat model */
  linked_threat_model_id?: string;
  /** Access control list */
  authorization?: Authorization[];
  /** Whether to exclude Security Reviewers group */
  is_confidential?: boolean;
}

/**
 * Request to update a survey response via PUT (full replacement of writable fields)
 */
export interface UpdateSurveyResponseRequest {
  /** Survey this response belongs to */
  survey_id?: string;
  /** Updated answers */
  answers?: Record<string, unknown>;
  /** Updated UI state for draft restoration */
  ui_state?: SurveyUIState;
  /** Link to existing threat model */
  linked_threat_model_id?: string;
  /** Access control list */
  authorization?: Authorization[];
}

/**
 * Response from create threat model from survey response
 */
export interface CreateThreatModelFromResponseResult {
  /** ID of the newly created threat model */
  threat_model_id: string;
  /** ID of the source survey response */
  survey_response_id: string;
}

// ============================================
// Builder Types
// ============================================

/**
 * Configuration for a question type in the builder palette
 */
export interface QuestionTypeConfig {
  /** Question type identifier */
  type: QuestionType;
  /** Display label */
  label: string;
  /** Material icon name */
  icon: string;
  /** Default properties for new questions of this type */
  defaultProps: Partial<SurveyQuestion>;
}

/**
 * State of the survey builder
 */
export interface BuilderState {
  /** Current survey JSON being edited */
  surveyJson: SurveyJsonSchema;
  /** Path to currently selected question (e.g., 'pages[0].elements[2]') */
  selectedQuestionPath: string | null;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Validation errors */
  validationErrors: BuilderValidationError[];
}

/**
 * Validation error in the builder
 */
export interface BuilderValidationError {
  /** Path to the element with error */
  path: string;
  /** Error message */
  message: string;
  /** Error severity */
  severity: 'error' | 'warning';
}
