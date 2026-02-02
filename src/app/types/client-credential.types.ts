/**
 * Client credential type definitions
 * Based on TMI API /me/client_credentials endpoints
 */

/**
 * Client credential info returned from list endpoint (no secret)
 */
export interface ClientCredentialInfo {
  /** Unique identifier */
  id: string;
  /** Client ID for authentication (format: tmi_cc_*) */
  client_id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** Whether the credential is active */
  is_active: boolean;
  /** Last time the credential was used */
  last_used_at?: string | null;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
  /** Expiration timestamp (null means never expires) */
  expires_at?: string | null;
}

/**
 * Client credential response from creation (includes secret)
 * The client_secret is ONLY returned once at creation time
 */
export interface ClientCredentialResponse {
  /** Unique identifier */
  id: string;
  /** Client ID for authentication (format: tmi_cc_*) */
  client_id: string;
  /** Client secret - only returned at creation time */
  client_secret: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** Creation timestamp */
  created_at: string;
  /** Expiration timestamp (null means never expires) */
  expires_at?: string | null;
}

/**
 * Input for creating a new client credential
 */
export interface CreateClientCredentialRequest {
  /** Human-readable name (1-100 characters) */
  name: string;
  /** Optional description (max 500 characters) */
  description?: string;
  /** Optional expiration date (ISO 8601 format) */
  expires_at?: string | null;
}

/**
 * Response from GET /me/client_credentials (paginated list)
 */
export interface ListClientCredentialsResponse {
  /** Array of client credentials */
  client_credentials: ClientCredentialInfo[];
  /** Total number of credentials */
  total: number;
  /** Maximum items per page */
  limit: number;
  /** Current offset */
  offset: number;
}
