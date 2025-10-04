import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { Observable, of, EMPTY } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ThreatModel } from '../models/threat-model.model';
import { ThreatModelService } from '../services/threat-model.service';
import { ThreatModelAuthorizationService } from '../services/threat-model-authorization.service';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Resolver that loads threat model data before route activation
 * Ensures threat model is loaded and permissions are set before component initialization
 */
export const threatModelResolver: ResolveFn<ThreatModel | null> = (
  route,
  state,
): Observable<ThreatModel | null> => {
  const threatModelService = inject(ThreatModelService);
  const authorizationService = inject(ThreatModelAuthorizationService);
  const logger = inject(LoggerService);
  const router = inject(Router);

  const threatModelId = route.paramMap.get('id');

  if (!threatModelId) {
    logger.error('No threat model ID provided in route');
    void router.navigate(['/tm']);
    return of(null);
  }

  // Check if we should force refresh (e.g., when coming back from DFD editor)
  const forceRefresh = route.queryParamMap.get('refresh') === 'true';

  logger.info('Resolving threat model data', {
    threatModelId,
    url: state.url,
    forceRefresh,
    routeParams: route.paramMap.keys.reduce(
      (acc, key) => {
        acc[key] = route.paramMap.get(key);
        return acc;
      },
      {} as Record<string, string | null>,
    ),
    queryParams: route.queryParamMap.keys.reduce(
      (acc, key) => {
        acc[key] = route.queryParamMap.get(key);
        return acc;
      },
      {} as Record<string, string | null>,
    ),
  });

  // Load threat model with forced refresh to ensure fresh authorization data
  return threatModelService.getThreatModelById(threatModelId, forceRefresh).pipe(
    tap(threatModel => {
      if (threatModel) {
        // Set authorization in the authorization service
        authorizationService.setAuthorization(threatModel.id, threatModel.authorization);

        // Log current user permission
        const userPermission = authorizationService.getCurrentUserPermission();
        logger.info('User permission determined', {
          threatModelId: threatModel.id,
          permission: userPermission,
        });
      }
    }),
    map(threatModel => threatModel || null),
    catchError((error: unknown) => {
      logger.error('Failed to resolve threat model', error);

      // Check if it's an authorization error
      const httpError = error as { status?: number };
      if (httpError.status === 403 || httpError.status === 401) {
        logger.warn('User does not have access to threat model', {
          threatModelId,
          status: httpError.status,
        });
        void router.navigate(['/tm'], {
          queryParams: {
            error: 'access_denied',
            threat_model_id: threatModelId,
          },
        });
      } else {
        // Other errors - navigate to threat models list
        void router.navigate(['/tm'], {
          queryParams: {
            error: 'load_failed',
            threat_model_id: threatModelId,
          },
        });
      }

      return EMPTY; // This will prevent the route from activating
    }),
  );
};
