import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { AdminServiceBase } from './admin-service-base';
import {
  ListWebhookSubscriptionsResponse,
  WebhookFilter,
  WebhookSubscription,
  WebhookSubscriptionInput,
} from '@app/types/webhook.types';

/**
 * Service for managing webhook subscriptions
 * Handles CRUD operations for webhooks
 */
@Injectable({
  providedIn: 'root',
})
// SEM@898eb8c6a78bae9e2f45347c815b584117ae8f91: manage webhook subscription CRUD and test operations via the admin API
export class WebhookService extends AdminServiceBase<WebhookSubscription, WebhookFilter> {
  public webhooks$: Observable<WebhookSubscription[]> = this.items$;

  // SEM@898eb8c6a78bae9e2f45347c815b584117ae8f91: register the webhook subscriptions endpoint with the base admin service (mutates shared state)
  constructor(apiService: ApiService, logger: LoggerService) {
    super(apiService, logger, {
      endpoint: 'admin/webhooks/subscriptions',
      entityName: 'webhook',
    });
  }

  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: extract the subscriptions array from a list-webhooks API response (pure)
  protected extractItems(response: unknown): WebhookSubscription[] {
    return (response as ListWebhookSubscriptionsResponse).subscriptions;
  }

  /**
   * List all webhook subscriptions with optional filtering
   * Note: When user is admin, server will return all webhooks (future enhancement)
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: fetch all webhook subscriptions with optional filter from the API (reads DB)
  public list(filter?: WebhookFilter): Observable<ListWebhookSubscriptionsResponse> {
    return this.listItems<ListWebhookSubscriptionsResponse>(filter);
  }

  /**
   * Get a specific webhook subscription by ID
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: fetch a single webhook subscription by ID from the API (reads DB)
  public get(id: string): Observable<WebhookSubscription> {
    return this.getItem(id);
  }

  /**
   * Create a new webhook subscription
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: register a new webhook subscription via the API (reads DB)
  public create(input: WebhookSubscriptionInput): Observable<WebhookSubscription> {
    return this.createItem(input as unknown as Record<string, unknown>);
  }

  /**
   * Update an existing webhook subscription
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: update an existing webhook subscription by ID (reads DB)
  public update(id: string, input: WebhookSubscriptionInput): Observable<WebhookSubscription> {
    return this.updateItem(id, input as unknown as Record<string, unknown>);
  }

  /**
   * Delete a webhook subscription
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: delete a webhook subscription by ID (reads DB)
  public delete(id: string): Observable<void> {
    return this.deleteItem(id);
  }

  /**
   * Test a webhook subscription
   */
  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: trigger a test delivery for a webhook subscription
  public test(id: string): Observable<void> {
    return this.apiService.post<void>(`${this.config.endpoint}/${id}/test`, {}).pipe(
      tap(() => this.logger.info('Webhook test triggered', { id })),
      catchError(error => {
        this.logger.error('Failed to test webhook', error);
        throw error;
      }),
    );
  }

  // SEM@e19c6684da148f53fab89e000721a9721f83d6d2: fetch and refresh the cached webhook subscription list (reads DB)
  protected override refreshList(): void {
    this.list().subscribe();
  }
}
