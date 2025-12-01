import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
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
export class WebhookService {
  private webhooksSubject$ = new BehaviorSubject<WebhookSubscription[]>([]);
  public webhooks$: Observable<WebhookSubscription[]> = this.webhooksSubject$.asObservable();

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all webhook subscriptions with optional filtering
   * Note: When user is admin, server will return all webhooks (future enhancement)
   */
  public list(filter?: WebhookFilter): Observable<WebhookSubscription[]> {
    const params = this.buildParams(filter);
    return this.apiService.get<WebhookSubscription[]>('webhooks/subscriptions', params).pipe(
      tap(webhooks => {
        this.webhooksSubject$.next(webhooks);
        this.logger.debug('Webhooks loaded', { count: webhooks.length });
      }),
      catchError(error => {
        this.logger.error('Failed to list webhooks', error);
        throw error;
      }),
    );
  }

  /**
   * Get a specific webhook subscription by ID
   */
  public get(id: string): Observable<WebhookSubscription> {
    return this.apiService.get<WebhookSubscription>(`webhooks/subscriptions/${id}`).pipe(
      tap(webhook => this.logger.debug('Webhook loaded', { id: webhook.id })),
      catchError(error => {
        this.logger.error('Failed to get webhook', error);
        throw error;
      }),
    );
  }

  /**
   * Create a new webhook subscription
   */
  public create(input: WebhookSubscriptionInput): Observable<WebhookSubscription> {
    return this.apiService
      .post<WebhookSubscription>(
        'webhooks/subscriptions',
        input as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(webhook => {
          this.logger.info('Webhook created', { id: webhook.id });
          this.list().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to create webhook', error);
          throw error;
        }),
      );
  }

  /**
   * Update an existing webhook subscription
   */
  public update(id: string, input: WebhookSubscriptionInput): Observable<WebhookSubscription> {
    return this.apiService
      .put<WebhookSubscription>(
        `webhooks/subscriptions/${id}`,
        input as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(webhook => {
          this.logger.info('Webhook updated', { id: webhook.id });
          this.list().subscribe();
        }),
        catchError(error => {
          this.logger.error('Failed to update webhook', error);
          throw error;
        }),
      );
  }

  /**
   * Delete a webhook subscription
   */
  public delete(id: string): Observable<void> {
    return this.apiService.delete<void>(`webhooks/subscriptions/${id}`).pipe(
      tap(() => {
        this.logger.info('Webhook deleted', { id });
        this.list().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to delete webhook', error);
        throw error;
      }),
    );
  }

  /**
   * Test a webhook subscription
   */
  public test(id: string): Observable<void> {
    return this.apiService.post<void>(`webhooks/subscriptions/${id}/test`, {}).pipe(
      tap(() => this.logger.info('Webhook test triggered', { id })),
      catchError(error => {
        this.logger.error('Failed to test webhook', error);
        throw error;
      }),
    );
  }

  /**
   * Build query parameters from filter
   */
  private buildParams(
    filter?: WebhookFilter,
  ): Record<string, string | number | boolean> | undefined {
    if (!filter) {
      return undefined;
    }

    const params: Record<string, string | number | boolean> = {};

    if (filter.threat_model_id) {
      params['threat_model_id'] = filter.threat_model_id;
    }
    if (filter.limit !== undefined) {
      params['limit'] = filter.limit;
    }
    if (filter.offset !== undefined) {
      params['offset'] = filter.offset;
    }

    return Object.keys(params).length > 0 ? params : undefined;
  }
}
