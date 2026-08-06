/**
 * Timmy Feature Guard
 *
 * Blocks the Timmy chat route when the server does not advertise the
 * `timmy_enabled` feature flag in GET /config. The chat page is reachable by
 * direct URL, so hiding the launcher button alone is not enough.
 *
 * Server config is fetched by BrandingConfigService via APP_INITIALIZER, so
 * the synchronous flag is settled before any route activates. Absent or
 * unreachable config means disabled — never advertise a broken feature.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { BrandingConfigService } from '@app/core/services/branding-config.service';
import { LoggerService } from '@app/core/services/logger.service';

export const timmyEnabledGuard: CanActivateFn = route => {
  const brandingConfig = inject(BrandingConfigService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  if (brandingConfig.timmyEnabled) {
    return true;
  }

  logger.warn('Timmy chat route blocked: server does not advertise timmy_enabled');
  const threatModelId = route.paramMap.get('id');
  return router.createUrlTree(threatModelId ? ['/tm', threatModelId] : ['/']);
};
