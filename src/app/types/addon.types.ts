/**
 * Addon type definitions
 * Based on TMI API /addons endpoints
 */

/**
 * Supported TMI object types that addons can operate on
 */
export type AddonObjectType =
  | 'threat_model'
  | 'diagram'
  | 'asset'
  | 'threat'
  | 'document'
  | 'note'
  | 'repository'
  | 'metadata'
  | 'survey'
  | 'survey_response';

/**
 * Parameter type determining client UI control
 */
export type AddonParameterType = 'enum' | 'boolean' | 'string' | 'number' | 'metadata_key';

/**
 * Typed parameter declaration for an add-on, used to drive client UI generation
 */
export interface AddonParameter {
  /** Parameter name (used as key in invocation data payload) */
  name: string;
  /** Parameter type determining client UI control */
  type: AddonParameterType;
  /** Human-readable description for UI display */
  description?: string;
  /** Whether the parameter must be provided on invocation */
  required?: boolean;
  /** Allowed values (applicable when type is 'enum') */
  enum_values?: string[];
  /** Default value if not provided by user */
  default_value?: string;
  /** Metadata key name to auto-populate from TMI object (applicable when type is 'metadata_key') */
  metadata_key?: string;
  /** Minimum allowed value (applicable when type is 'number') */
  number_min?: number;
  /** Maximum allowed value (applicable when type is 'number') */
  number_max?: number;
  /** Maximum string length (applicable when type is 'string') */
  string_max_length?: number;
  /** Regular expression for string validation (applicable when type is 'string') */
  string_validation_regex?: string;
}

/**
 * Addon for extending TMI functionality via webhooks
 */
export interface Addon {
  /** Add-on identifier */
  id: string;
  /** Creation timestamp */
  created_at: string;
  /** Display name */
  name: string;
  /** Associated webhook subscription ID */
  webhook_id: string;
  /** Add-on description */
  description?: string;
  /** Icon identifier (Material Symbols or FontAwesome format) */
  icon?: string;
  /** Supported TMI object types */
  objects?: AddonObjectType[];
  /** Threat model scope (if scoped to specific threat model) */
  threat_model_id?: string;
  /** Typed parameter declarations for client UI generation */
  parameters?: AddonParameter[];
}

/**
 * Request to create a new addon
 */
export interface CreateAddonRequest {
  /** Display name for the add-on */
  name: string;
  /** UUID of the associated webhook subscription */
  webhook_id: string;
  /** Description of what the add-on does */
  description?: string;
  /** Icon identifier (Material Symbols or FontAwesome format) */
  icon?: string;
  /** TMI object types this add-on can operate on */
  objects?: AddonObjectType[];
  /** Optional: Scope add-on to specific threat model */
  threat_model_id?: string;
}

/**
 * Filter parameters for listing addons
 */
export interface AddonFilter {
  /** Filter by threat model */
  threat_model_id?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
}

/**
 * Response from list addons endpoint
 */
export interface ListAddonsResponse {
  addons: Addon[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Request to invoke an addon
 */
export interface InvokeAddonRequest {
  /** Threat model context for invocation (required) */
  threat_model_id: string;
  /** Optional: Specific object type to operate on */
  object_type?: AddonObjectType;
  /** Optional: Specific object ID to operate on */
  object_id?: string;
  /** Optional: User-provided data for the add-on (max 1KB JSON-serialized) */
  data?: Record<string, unknown>;
}

/**
 * Invocation status values
 */
export type InvokeAddonStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Response from invoking an addon
 */
export interface InvokeAddonResponse {
  /** Invocation identifier for tracking */
  invocation_id: string;
  /** Current invocation status */
  status: InvokeAddonStatus;
  /** Invocation creation timestamp */
  created_at: string;
}
