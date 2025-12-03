/**
 * Quota Type Definitions
 *
 * Types for user API quotas and webhook quotas
 */

/**
 * User API Quota
 * Rate limits for API requests per user
 */
export interface UserAPIQuota {
  user_id: string;
  max_requests_per_minute: number;
  max_requests_per_hour?: number | null;
  created_at: string;
  modified_at: string;
}

/**
 * Webhook Quota
 * Rate limits and subscription limits for webhooks per user
 */
export interface WebhookQuota {
  owner_id: string;
  max_subscriptions: number;
  max_events_per_minute: number;
  max_subscription_requests_per_minute: number;
  max_subscription_requests_per_day: number;
  created_at?: string;
  modified_at?: string;
}

/**
 * Enriched quota with user information for display
 */
export interface EnrichedUserAPIQuota extends UserAPIQuota {
  provider: string;
  user_name?: string | null;
  user_email: string;
}

export interface EnrichedWebhookQuota extends WebhookQuota {
  provider: string;
  user_name?: string | null;
  user_email: string;
}

/**
 * Default quota values from rate-limiting-specification.md
 */
export const DEFAULT_USER_API_QUOTA = {
  max_requests_per_minute: 100,
  max_requests_per_hour: 6000,
} as const;

export const DEFAULT_WEBHOOK_QUOTA = {
  max_subscriptions: 10,
  max_events_per_minute: 12,
  max_subscription_requests_per_minute: 10,
  max_subscription_requests_per_day: 20,
} as const;
