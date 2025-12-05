import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  UserAPIQuota,
  WebhookQuota,
  EnrichedUserAPIQuota,
  EnrichedWebhookQuota,
} from '@app/types/quota.types';
import { AdminUser, AdminUserFilter, ListAdminUsersResponse } from '@app/types/user.types';

/**
 * Quota Service
 *
 * Manages user API quotas and webhook quotas through the admin API.
 * Provides CRUD operations for quota management and user search functionality.
 */
@Injectable({
  providedIn: 'root',
})
export class QuotaService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * Get user API quota for a specific user
   */
  getUserAPIQuota(userId: string): Observable<UserAPIQuota> {
    return this.apiService.get<UserAPIQuota>(`/admin/quotas/users/${userId}`);
  }

  /**
   * Update or create user API quota
   */
  updateUserAPIQuota(
    userId: string,
    quota: Partial<Omit<UserAPIQuota, 'user_id' | 'created_at' | 'modified_at'>>,
  ): Observable<UserAPIQuota> {
    return this.apiService.put<UserAPIQuota>(`/admin/quotas/users/${userId}`, quota);
  }

  /**
   * Delete user API quota (reverts to system defaults)
   */
  deleteUserAPIQuota(userId: string): Observable<void> {
    return this.apiService.delete<void>(`/admin/quotas/users/${userId}`);
  }

  /**
   * Get webhook quota for a specific user
   */
  getWebhookQuota(userId: string): Observable<WebhookQuota> {
    return this.apiService.get<WebhookQuota>(`/admin/quotas/webhooks/${userId}`);
  }

  /**
   * Update or create webhook quota
   */
  updateWebhookQuota(
    userId: string,
    quota: Partial<Omit<WebhookQuota, 'owner_id' | 'created_at' | 'modified_at'>>,
  ): Observable<WebhookQuota> {
    return this.apiService.put<WebhookQuota>(`/admin/quotas/webhooks/${userId}`, quota);
  }

  /**
   * Delete webhook quota (reverts to system defaults)
   */
  deleteWebhookQuota(userId: string): Observable<void> {
    return this.apiService.delete<void>(`/admin/quotas/webhooks/${userId}`);
  }

  /**
   * List all user API quotas (only returns users with custom quotas)
   */
  listUserAPIQuotas(limit?: number, offset?: number): Observable<UserAPIQuota[]> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params['limit'] = limit.toString();
    if (offset !== undefined) params['offset'] = offset.toString();
    return this.apiService.get<UserAPIQuota[]>('/admin/quotas/users', params);
  }

  /**
   * List all webhook quotas (only returns users with custom quotas)
   */
  listWebhookQuotas(limit?: number, offset?: number): Observable<WebhookQuota[]> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params['limit'] = limit.toString();
    if (offset !== undefined) params['offset'] = offset.toString();
    return this.apiService.get<WebhookQuota[]>('/admin/quotas/webhooks', params);
  }

  /**
   * List admin users with optional filtering
   */
  listUsers(filter?: AdminUserFilter): Observable<ListAdminUsersResponse> {
    const params: Record<string, string> = {};

    if (filter?.provider) params['provider'] = filter.provider;
    if (filter?.email) params['email'] = filter.email;
    if (filter?.limit) params['limit'] = filter.limit.toString();
    if (filter?.offset) params['offset'] = filter.offset.toString();
    if (filter?.sort_by) params['sort_by'] = filter.sort_by;
    if (filter?.sort_order) params['sort_order'] = filter.sort_order;

    return this.apiService.get<ListAdminUsersResponse>('/admin/users', params);
  }

  /**
   * Get a single admin user by internal UUID
   */
  getUser(internalUuid: string): Observable<AdminUser> {
    return this.apiService.get<AdminUser>(`/admin/users/${internalUuid}`);
  }

  /**
   * Enrich user API quota with user information
   */
  private enrichUserAPIQuota(quota: UserAPIQuota, user: AdminUser): EnrichedUserAPIQuota {
    return {
      ...quota,
      provider: user.provider,
      user_name: user.name,
      user_email: user.email,
    };
  }

  /**
   * Enrich webhook quota with user information
   */
  private enrichWebhookQuota(quota: WebhookQuota, user: AdminUser): EnrichedWebhookQuota {
    return {
      ...quota,
      provider: user.provider,
      user_name: user.name,
      user_email: user.email,
    };
  }

  /**
   * Get enriched user API quota (includes user information)
   */
  getEnrichedUserAPIQuota(userId: string): Observable<EnrichedUserAPIQuota> {
    return forkJoin({
      quota: this.getUserAPIQuota(userId),
      user: this.getUser(userId),
    }).pipe(map(({ quota, user }) => this.enrichUserAPIQuota(quota, user)));
  }

  /**
   * Get enriched webhook quota (includes user information)
   */
  getEnrichedWebhookQuota(userId: string): Observable<EnrichedWebhookQuota> {
    return forkJoin({
      quota: this.getWebhookQuota(userId),
      user: this.getUser(userId),
    }).pipe(map(({ quota, user }) => this.enrichWebhookQuota(quota, user)));
  }

  /**
   * List all enriched user API quotas (includes user information)
   */
  listEnrichedUserAPIQuotas(limit?: number, offset?: number): Observable<EnrichedUserAPIQuota[]> {
    return this.listUserAPIQuotas(limit, offset).pipe(
      switchMap(quotas => {
        if (!quotas || quotas.length === 0) {
          return of([]);
        }
        const enrichedQuotas$ = quotas.map(quota =>
          forkJoin({
            quota: this.getUserAPIQuota(quota.user_id),
            user: this.getUser(quota.user_id),
          }).pipe(map(({ quota: q, user }) => this.enrichUserAPIQuota(q, user))),
        );
        return forkJoin(enrichedQuotas$);
      }),
    );
  }

  /**
   * List all enriched webhook quotas (includes user information)
   */
  listEnrichedWebhookQuotas(limit?: number, offset?: number): Observable<EnrichedWebhookQuota[]> {
    return this.listWebhookQuotas(limit, offset).pipe(
      switchMap(quotas => {
        if (!quotas || quotas.length === 0) {
          return of([]);
        }
        const enrichedQuotas$ = quotas.map(quota =>
          forkJoin({
            quota: this.getWebhookQuota(quota.owner_id),
            user: this.getUser(quota.owner_id),
          }).pipe(map(({ quota: q, user }) => this.enrichWebhookQuota(q, user))),
        );
        return forkJoin(enrichedQuotas$);
      }),
    );
  }
}
