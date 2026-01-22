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
  | 'metadata';

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
  payload?: Record<string, unknown>;
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
