/**
 * Admin Route Guard
 *
 * This guard protects routes that require administrator privileges.
 * It verifies admin status by calling GET /users/me to ensure freshness.
 *
 * Key functionality:
 * - Uses Angular's functional guard pattern with dependency injection
 * - Checks admin status by fetching user profile from server via AuthService
 * - Redirects non-admin users to dashboard with error message
 * - Provides logging for authorization decisions
 * - Default deny unless admin status is confirmed
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';
import { map, catchError, of } from 'rxjs';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  return authService.refreshUserProfile().pipe(
    map(userProfile => {
      if (userProfile.is_admin) {
        logger.info('Admin access granted');
        return true;
      } else {
        logger.warn('Admin access denied: User is not an administrator');
        void router.navigate(['/dashboard'], {
          queryParams: {
            error: 'admin_required',
          },
        });
        return false;
      }
    }),
    catchError(error => {
      logger.error('Failed to verify admin status', error);
      void router.navigate(['/dashboard'], {
        queryParams: {
          error: 'admin_check_failed',
        },
      });
      return of(false);
    }),
  );
};
