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
  ListUserAPIQuotasResponse,
  ListWebhookQuotasResponse,
  ListEnrichedUserAPIQuotasResponse,
  ListEnrichedWebhookQuotasResponse,
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
// SEM@e7dd6955882ba4be469447e879cf0576655cd710: manage API and webhook quota CRUD and enriched listings for admin users
export class QuotaService {
  // SEM@65afaf0b87a37250bf4e27116c95afdfd3ffc43f: inject API and logger dependencies (pure)
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * Get user API quota for a specific user
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: fetch the API quota record for a user by internal UUID (reads DB)
  getUserAPIQuota(internalUuid: string): Observable<UserAPIQuota> {
    return this.apiService.get<UserAPIQuota>(`/admin/quotas/users/${internalUuid}`);
  }

  /**
   * Update or create user API quota
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: update or create the API quota for a user by internal UUID (reads DB)
  updateUserAPIQuota(
    internalUuid: string,
    quota: Partial<Omit<UserAPIQuota, 'user_id' | 'created_at' | 'modified_at'>>,
  ): Observable<UserAPIQuota> {
    return this.apiService.put<UserAPIQuota>(`/admin/quotas/users/${internalUuid}`, quota);
  }

  /**
   * Delete user API quota (reverts to system defaults)
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: delete a user's custom API quota, reverting to system defaults (reads DB)
  deleteUserAPIQuota(internalUuid: string): Observable<void> {
    return this.apiService.delete<void>(`/admin/quotas/users/${internalUuid}`);
  }

  /**
   * Get webhook quota for a specific user
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: fetch the webhook quota record for a user by internal UUID (reads DB)
  getWebhookQuota(internalUuid: string): Observable<WebhookQuota> {
    return this.apiService.get<WebhookQuota>(`/admin/quotas/webhooks/${internalUuid}`);
  }

  /**
   * Update or create webhook quota
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: update or create the webhook quota for a user by internal UUID (reads DB)
  updateWebhookQuota(
    internalUuid: string,
    quota: Partial<Omit<WebhookQuota, 'owner_id' | 'created_at' | 'modified_at'>>,
  ): Observable<WebhookQuota> {
    return this.apiService.put<WebhookQuota>(`/admin/quotas/webhooks/${internalUuid}`, quota);
  }

  /**
   * Delete webhook quota (reverts to system defaults)
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: delete a user's custom webhook quota, reverting to system defaults (reads DB)
  deleteWebhookQuota(internalUuid: string): Observable<void> {
    return this.apiService.delete<void>(`/admin/quotas/webhooks/${internalUuid}`);
  }

  /**
   * List all user API quotas (only returns users with custom quotas)
   */
  // SEM@54e7d611dc1f2c8ef1c351a57a5968d8be72defc: list paginated user API quota records with custom overrides (reads DB)
  listUserAPIQuotas(limit?: number, offset?: number): Observable<ListUserAPIQuotasResponse> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params['limit'] = limit.toString();
    if (offset !== undefined) params['offset'] = offset.toString();
    return this.apiService.get<ListUserAPIQuotasResponse>('/admin/quotas/users', params);
  }

  /**
   * List all webhook quotas (only returns users with custom quotas)
   */
  // SEM@54e7d611dc1f2c8ef1c351a57a5968d8be72defc: list paginated webhook quota records with custom overrides (reads DB)
  listWebhookQuotas(limit?: number, offset?: number): Observable<ListWebhookQuotasResponse> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params['limit'] = limit.toString();
    if (offset !== undefined) params['offset'] = offset.toString();
    return this.apiService.get<ListWebhookQuotasResponse>('/admin/quotas/webhooks', params);
  }

  /**
   * List admin users with optional filtering
   */
  // SEM@65afaf0b87a37250bf4e27116c95afdfd3ffc43f: list admin users with optional filter and pagination (reads DB)
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
  // SEM@65afaf0b87a37250bf4e27116c95afdfd3ffc43f: fetch a single admin user record by internal UUID (reads DB)
  getUser(internalUuid: string): Observable<AdminUser> {
    return this.apiService.get<AdminUser>(`/admin/users/${internalUuid}`);
  }

  /**
   * Enrich user API quota with user information
   */
  // SEM@65afaf0b87a37250bf4e27116c95afdfd3ffc43f: merge user profile fields into a user API quota record (pure)
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
  // SEM@65afaf0b87a37250bf4e27116c95afdfd3ffc43f: merge user profile fields into a webhook quota record (pure)
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
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: fetch a user API quota enriched with user profile data (reads DB)
  getEnrichedUserAPIQuota(internalUuid: string): Observable<EnrichedUserAPIQuota> {
    return forkJoin({
      quota: this.getUserAPIQuota(internalUuid),
      user: this.getUser(internalUuid),
    }).pipe(map(({ quota, user }) => this.enrichUserAPIQuota(quota, user)));
  }

  /**
   * Get enriched webhook quota (includes user information)
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: fetch a webhook quota enriched with user profile data (reads DB)
  getEnrichedWebhookQuota(internalUuid: string): Observable<EnrichedWebhookQuota> {
    return forkJoin({
      quota: this.getWebhookQuota(internalUuid),
      user: this.getUser(internalUuid),
    }).pipe(map(({ quota, user }) => this.enrichWebhookQuota(quota, user)));
  }

  /**
   * List all enriched user API quotas (includes user information)
   * Returns pagination metadata along with enriched quotas
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: list paginated user API quotas each enriched with user profile data (reads DB)
  listEnrichedUserAPIQuotas(
    limit?: number,
    offset?: number,
  ): Observable<ListEnrichedUserAPIQuotasResponse> {
    return this.listUserAPIQuotas(limit, offset).pipe(
      switchMap(response => {
        const quotas = response.quotas;
        if (!quotas || quotas.length === 0) {
          return of({
            quotas: [],
            total: response.total,
            limit: response.limit,
            offset: response.offset,
          });
        }
        const enrichedQuotas$ = quotas.map(quota =>
          forkJoin({
            quota: this.getUserAPIQuota(quota.user_id),
            user: this.getUser(quota.user_id),
          }).pipe(map(({ quota: q, user }) => this.enrichUserAPIQuota(q, user))),
        );
        return forkJoin(enrichedQuotas$).pipe(
          map(enrichedQuotas => ({
            quotas: enrichedQuotas,
            total: response.total,
            limit: response.limit,
            offset: response.offset,
          })),
        );
      }),
    );
  }

  /**
   * List all enriched webhook quotas (includes user information)
   * Returns pagination metadata along with enriched quotas
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: list paginated webhook quotas each enriched with user profile data (reads DB)
  listEnrichedWebhookQuotas(
    limit?: number,
    offset?: number,
  ): Observable<ListEnrichedWebhookQuotasResponse> {
    return this.listWebhookQuotas(limit, offset).pipe(
      switchMap(response => {
        const quotas = response.quotas;
        if (!quotas || quotas.length === 0) {
          return of({
            quotas: [],
            total: response.total,
            limit: response.limit,
            offset: response.offset,
          });
        }
        const enrichedQuotas$ = quotas.map(quota =>
          forkJoin({
            quota: this.getWebhookQuota(quota.owner_id),
            user: this.getUser(quota.owner_id),
          }).pipe(map(({ quota: q, user }) => this.enrichWebhookQuota(q, user))),
        );
        return forkJoin(enrichedQuotas$).pipe(
          map(enrichedQuotas => ({
            quotas: enrichedQuotas,
            total: response.total,
            limit: response.limit,
            offset: response.offset,
          })),
        );
      }),
    );
  }
}
