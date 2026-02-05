/**
 * Survey feature type definitions
 * Types for survey templates, submissions, and SurveyJS JSON schema
 */

// ============================================
// Survey Template Types
// ============================================

/**
 * Status of a survey template
 */
export type SurveyStatus = 'active' | 'inactive' | 'archived';

/**
 * Survey template metadata (does not include the survey JSON)
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
  /** Current version number */
  current_version: number;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
  /** User ID who created the template */
  created_by: string;
  /** User ID who last modified the template */
  modified_by: string;
}

/**
 * Survey version containing the actual SurveyJS JSON
 */
export interface SurveyVersion {
  /** Version identifier */
  id: string;
  /** Parent template identifier */
  template_id: string;
  /** Version number (1, 2, 3, ...) */
  version: number;
  /** SurveyJS JSON schema */
  survey_json: SurveyJsonSchema;
  /** Creation timestamp */
  created_at: string;
  /** User ID who created this version */
  created_by: string;
  /** Optional summary of changes in this version */
  change_summary?: string;
}

// ============================================
// SurveyJS JSON Schema Types
// ============================================

/**
 * Supported question types in the simplified builder
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
// Submission Types
// ============================================

/**
 * Status of a survey submission
 */
export type SubmissionStatus = 'draft' | 'submitted' | 'in_review' | 'pending_triage';

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
 * Survey submission containing response data
 */
export interface SurveySubmission {
  /** Submission identifier */
  id: string;
  /** Template identifier */
  template_id: string;
  /** Template name (for display) */
  template_name?: string;
  /** Version of the template used */
  template_version: number;
  /** User ID who submitted */
  user_id: string;
  /** User email */
  user_email: string;
  /** User display name */
  user_display_name?: string;
  /** Current status */
  status: SubmissionStatus;
  /** SurveyJS response data */
  data: Record<string, unknown>;
  /** UI state for draft restoration */
  ui_state?: SurveyUIState;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
  /** When the survey was submitted */
  submitted_at?: string;
  /** When review started */
  reviewed_at?: string;
  /** Linked threat model ID (if created from this submission) */
  threat_model_id?: string;
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
  templates: SurveyTemplate[];
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
  /** Template description */
  description?: string;
  /** Initial status */
  status?: SurveyStatus;
  /** SurveyJS JSON schema */
  survey_json: SurveyJsonSchema;
}

/**
 * Request to update a survey template (creates new version)
 */
export interface UpdateSurveyTemplateRequest {
  /** Updated name */
  name?: string;
  /** Updated description */
  description?: string;
  /** Updated status */
  status?: SurveyStatus;
  /** Updated SurveyJS JSON (creates new version if changed) */
  survey_json?: SurveyJsonSchema;
  /** Summary of changes for version history */
  change_summary?: string;
}

/**
 * Filter parameters for listing submissions
 */
export interface SurveySubmissionFilter {
  /** Filter by template */
  template_id?: string;
  /** Filter by user */
  user_id?: string;
  /** Filter by status */
  status?: SubmissionStatus | SubmissionStatus[];
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
 * Response from list submissions endpoint
 */
export interface ListSurveySubmissionsResponse {
  submissions: SurveySubmission[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Request to create a new submission (draft)
 */
export interface CreateSubmissionRequest {
  /** Template to fill out */
  template_id: string;
  /** Initial response data */
  data?: Record<string, unknown>;
  /** Initial UI state */
  ui_state?: SurveyUIState;
}

/**
 * Request to update a submission (save draft)
 */
export interface UpdateSubmissionRequest {
  /** Updated response data */
  data?: Record<string, unknown>;
  /** Updated UI state */
  ui_state?: SurveyUIState;
  /** Updated status (admin only for non-draft statuses) */
  status?: SubmissionStatus;
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
