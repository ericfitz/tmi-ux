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
export class WebhookService extends AdminServiceBase<WebhookSubscription, WebhookFilter> {
  public webhooks$: Observable<WebhookSubscription[]> = this.items$;

  constructor(apiService: ApiService, logger: LoggerService) {
    super(apiService, logger, {
      endpoint: 'webhooks/subscriptions',
      entityName: 'webhook',
    });
  }

  protected extractItems(response: unknown): WebhookSubscription[] {
    return (response as ListWebhookSubscriptionsResponse).subscriptions;
  }

  /**
   * List all webhook subscriptions with optional filtering
   * Note: When user is admin, server will return all webhooks (future enhancement)
   */
  public list(filter?: WebhookFilter): Observable<ListWebhookSubscriptionsResponse> {
    return this.listItems<ListWebhookSubscriptionsResponse>(filter);
  }

  /**
   * Get a specific webhook subscription by ID
   */
  public get(id: string): Observable<WebhookSubscription> {
    return this.getItem(id);
  }

  /**
   * Create a new webhook subscription
   */
  public create(input: WebhookSubscriptionInput): Observable<WebhookSubscription> {
    return this.createItem(input as unknown as Record<string, unknown>);
  }

  /**
   * Update an existing webhook subscription
   */
  public update(id: string, input: WebhookSubscriptionInput): Observable<WebhookSubscription> {
    return this.updateItem(id, input as unknown as Record<string, unknown>);
  }

  /**
   * Delete a webhook subscription
   */
  public delete(id: string): Observable<void> {
    return this.deleteItem(id);
  }

  /**
   * Test a webhook subscription
   */
  public test(id: string): Observable<void> {
    return this.apiService.post<void>(`${this.config.endpoint}/${id}/test`, {}).pipe(
      tap(() => this.logger.info('Webhook test triggered', { id })),
      catchError(error => {
        this.logger.error('Failed to test webhook', error);
        throw error;
      }),
    );
  }

  protected override refreshList(): void {
    this.list().subscribe();
  }
}
