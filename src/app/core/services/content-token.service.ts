import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { CONTENT_PROVIDERS } from './content-provider-registry';
import {
  ContentTokenProviderNotConfiguredError,
  type ContentAuthorizationURL,
  type ContentProviderId,
  type ContentTokenInfo,
} from '../models/content-provider.types';

interface ContentTokenListResponse {
  content_tokens: ContentTokenInfo[];
}

/**
 * Provider-agnostic HTTP wrapper for /me/content_tokens/*. Lists, authorizes,
 * and unlinks delegated content tokens. Cached observable invalidated on
 * mutations and explicit refresh().
 */
@Injectable({ providedIn: 'root' })
export class ContentTokenService {
  private readonly _cache$ = new BehaviorSubject<ContentTokenInfo[] | null>(null);

  readonly contentTokens$: Observable<ContentTokenInfo[]> = this._cache$.pipe(
    switchMap(cached => {
      if (cached !== null) {
        return of(cached);
      }
      return this.list().pipe(tap(tokens => this._cache$.next(tokens)));
    }),
  );

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /** Fetches the current user's linked content tokens. */
  list(): Observable<ContentTokenInfo[]> {
    return this.apiService.get<ContentTokenListResponse>('me/content_tokens').pipe(
      tap(res => this.logger.debug('Content tokens loaded', { count: res.content_tokens.length })),
      map(res => res.content_tokens),
      catchError(err => {
        this.logger.error('Failed to list content tokens', err);
        throw err;
      }),
    );
  }

  /** Forces the cached observable to re-fetch on next subscription. */
  refresh(): void {
    this._cache$.next(null);
  }

  /**
   * Initiates an account-link flow. Returns the authorization URL the caller
   * should redirect the browser to. The server-side callback redirects back
   * to `<origin>/oauth2/content-callback?return_to=<encoded returnTo>`.
   */
  authorize(providerId: ContentProviderId, returnTo: string): Observable<ContentAuthorizationURL> {
    const clientCallback = `${window.location.origin}/oauth2/content-callback?return_to=${encodeURIComponent(returnTo)}`;
    return this.apiService
      .post<ContentAuthorizationURL>(`me/content_tokens/${providerId}/authorize`, {
        client_callback: clientCallback,
      })
      .pipe(
        tap(() => this.logger.info('Content token authorize initiated', { providerId })),
        catchError((err: unknown) => {
          this.logger.error('Failed to initiate content token authorize', err);
          if (isProviderNotConfigured(err)) {
            throw new ContentTokenProviderNotConfiguredError(providerId);
          }
          throw err;
        }),
      );
  }

  /** Unlinks the named provider; invalidates the cache. */
  unlink(providerId: ContentProviderId): Observable<void> {
    return this.apiService.delete<void>(`me/content_tokens/${providerId}`).pipe(
      tap(() => {
        this.logger.info('Content token unlinked', { providerId });
        this.refresh();
      }),
      catchError(err => {
        this.logger.error('Failed to unlink content token', err);
        throw err;
      }),
    );
  }
}

/**
 * Detects the server's 422 `content_token_provider_not_configured` body. The
 * server returns this when the requested provider id is absent from its
 * `ContentOAuthProviderRegistry` (no OAuth client credentials configured).
 */
function isProviderNotConfigured(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  if ((err as { status?: unknown }).status !== 422) return false;
  const body = (err as { error?: unknown }).error;
  if (typeof body !== 'object' || body === null) return false;
  return (body as { error?: unknown }).error === 'content_token_provider_not_configured';
}

/**
 * Builds the user-facing snackbar message for an authorize() failure. Centralizes
 * mapping of `ContentTokenProviderNotConfiguredError` to a specific localized
 * message and falls back to a generic message for everything else. Defends
 * against unknown provider ids (e.g., a future server adding a provider before
 * the client registry knows about it) by falling back to the raw id as the
 * source name.
 */
export function buildContentAuthorizeErrorMessage(
  err: unknown,
  providerId: ContentProviderId,
  transloco: TranslocoService,
): string {
  const meta = CONTENT_PROVIDERS[providerId];
  const sourceName = meta ? transloco.translate(meta.displayNameKey) : providerId;
  return err instanceof ContentTokenProviderNotConfiguredError
    ? transloco.translate('documentSources.callback.notConfigured', { source: sourceName })
    : transloco.translate('documentSources.callback.error', {
        source: sourceName,
        reason: '',
      });
}
