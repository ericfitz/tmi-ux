/**
 * Survey feature type definitions
 * Types for survey templates, responses, and SurveyJS JSON schema
 */

import { User, Authorization } from '@app/pages/tm/models/threat-model.model';

// ============================================
// Survey Template Types
// ============================================

/**
 * Status of a survey template
 */
export type SurveyStatus = 'active' | 'inactive' | 'archived';

/**
 * Settings for a survey template
 */
export interface SurveyTemplateSettings {
  /** Whether responses can link to existing threat models for re-reviews */
  allow_threat_model_linking: boolean;
}

/**
 * Full survey template (returned from single-resource GET endpoints)
 */
export interface SurveyTemplate {
  /** Template identifier */
  id: string;
  /** Template display name */
  name: string;
  /** Template description */
  description?: string;
  /** Current status */
  status: SurveyStatus;
  /** Custom version string (e.g., "2024-Q1", "v2-pilot") */
  version: string;
  /** Complete SurveyJS JSON definition */
  survey_json: SurveyJsonSchema;
  /** Template settings */
  settings?: SurveyTemplateSettings;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
  /** User who created the template */
  created_by: User;
}

/**
 * Survey template summary (returned from list endpoints)
 */
export interface SurveyTemplateListItem {
  /** Template identifier */
  id: string;
  /** Template display name */
  name: string;
  /** Template description */
  description?: string;
  /** Custom version string */
  version: string;
  /** Current status */
  status: SurveyStatus;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
  /** User who created the template */
  created_by: User;
}

/**
 * Historical version record for a survey template
 */
export interface SurveyVersion {
  /** Version identifier */
  id: string;
  /** Parent template identifier */
  template_id: string;
  /** Version string */
  version: string;
  /** SurveyJS JSON schema at this version */
  survey_json: SurveyJsonSchema;
  /** Creation timestamp */
  created_at: string;
  /** User who created this version */
  created_by: User;
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
  /** Template identifier */
  template_id: string;
  /** Template version captured at creation */
  template_version: string;
  /** Current status */
  status: ResponseStatus;
  /** Whether Security Reviewers group was excluded */
  is_confidential: boolean;
  /** Question answers keyed by question name */
  answers: Record<string, unknown>;
  /** UI state for draft restoration */
  ui_state?: SurveyUIState;
  /** Snapshot of the survey_json from the template version used at creation (read-only) */
  survey_json?: SurveyJsonSchema;
  /** Link to existing threat model for re-reviews */
  linked_threat_model_id?: string;
  /** ID of threat model created from this response */
  created_threat_model_id?: string;
  /** Notes from security reviewer when returned for revision */
  revision_notes?: string;
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
}

/**
 * Survey response summary (returned from list endpoints)
 */
export interface SurveyResponseListItem {
  /** Response identifier */
  id: string;
  /** Template identifier */
  template_id: string;
  /** Template name (denormalized for display) */
  template_name: string;
  /** Template version used */
  template_version: string;
  /** Current status */
  status: ResponseStatus;
  /** Whether this is a confidential project */
  is_confidential: boolean;
  /** User who created the response */
  owner: User;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
  /** When the response was submitted */
  submitted_at?: string;
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Filter parameters for listing survey templates
 */
export interface SurveyTemplateFilter {
  /** Filter by status */
  status?: SurveyStatus;
  /** Search by name */
  search?: string;
  /** Maximum results */
  limit?: number;
  /** Results offset */
  offset?: number;
}

/**
 * Response from list templates endpoint
 */
export interface ListSurveyTemplatesResponse {
  survey_templates: SurveyTemplateListItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Request to create a new survey template
 */
export interface CreateSurveyTemplateRequest {
  /** Template name */
  name: string;
  /** Custom version string */
  version: string;
  /** SurveyJS JSON definition */
  survey_json: SurveyJsonSchema;
  /** Template description */
  description?: string;
  /** Initial status (defaults to inactive) */
  status?: SurveyStatus;
  /** Template settings */
  settings?: SurveyTemplateSettings;
}

/**
 * Request to update a survey template (full PUT)
 */
export interface UpdateSurveyTemplateRequest {
  /** Template name */
  name: string;
  /** Custom version string */
  version: string;
  /** SurveyJS JSON definition */
  survey_json: SurveyJsonSchema;
  /** Template description */
  description?: string;
  /** Status */
  status?: SurveyStatus;
  /** Template settings */
  settings?: SurveyTemplateSettings;
}

/**
 * Filter parameters for listing survey responses
 */
export interface SurveyResponseFilter {
  /** Filter by template */
  template_id?: string;
  /** Filter by status */
  status?: ResponseStatus | ResponseStatus[];
  /** Filter by submitted date start */
  submitted_after?: string;
  /** Filter by submitted date end */
  submitted_before?: string;
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
  /** Template to fill out */
  template_id: string;
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
 * Request to update a survey response (save draft or status change)
 */
export interface UpdateSurveyResponseRequest {
  /** Updated answers */
  answers?: Record<string, unknown>;
  /** Updated UI state for draft restoration */
  ui_state?: SurveyUIState;
  /** Updated status (for transitions) */
  status?: ResponseStatus;
  /** Link to existing threat model */
  linked_threat_model_id?: string;
  /** Access control list */
  authorization?: Authorization[];
  /** Revision notes (required when transitioning to needs_revision) */
  revision_notes?: string;
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
