/**
 * Webhook subscription type definitions
 * Based on TMI API /webhooks/subscriptions endpoints
 */

/**
 * Webhook subscription status
 */
export type WebhookStatus = 'pending_verification' | 'active' | 'pending_delete';

/**
 * Webhook subscription for receiving event notifications
 */
export interface WebhookSubscription {
  /** Unique identifier */
  id: string;
  /** Owner user ID */
  owner_id: string;
  /** Optional threat model filter (null means all threat models) */
  threat_model_id: string | null;
  /** Descriptive name */
  name: string;
  /** Webhook endpoint URL (must be HTTPS) */
  url: string;
  /** List of event types to subscribe to */
  events: string[];
  /** Subscription status */
  status: WebhookStatus;
  /** Number of verification challenges sent */
  challenges_sent?: number;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
  /** Last successful delivery timestamp */
  last_successful_use?: string | null;
  /** Count of consecutive failed deliveries */
  publication_failures?: number;
}

/**
 * Input for creating a new webhook subscription
 */
export interface WebhookSubscriptionInput {
  /** Optional threat model filter */
  threat_model_id?: string | null;
  /** Descriptive name for the subscription */
  name: string;
  /** Webhook endpoint URL (must be HTTPS) */
  url: string;
  /** List of event types to subscribe to */
  events: string[];
  /** Optional HMAC secret for signing payloads (auto-generated if not provided) */
  secret?: string;
}

/**
 * Filter parameters for listing webhook subscriptions
 */
export interface WebhookFilter {
  /** Filter subscriptions by threat model ID */
  threat_model_id?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
}
