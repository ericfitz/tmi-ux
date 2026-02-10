/**
 * Security Reviewer Route Guard
 *
 * This guard protects routes that require security reviewer privileges.
 * It verifies reviewer status by calling GET /users/me to ensure freshness.
 *
 * Key functionality:
 * - Uses Angular's functional guard pattern with dependency injection
 * - Checks security reviewer status by fetching user profile from server via AuthService
 * - Redirects non-reviewers to their role-based landing page
 * - Provides logging for authorization decisions
 * - Default deny unless reviewer status is confirmed
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';
import { map, catchError, of } from 'rxjs';

export const reviewerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  return authService.refreshUserProfile().pipe(
    map(userProfile => {
      if (userProfile.is_security_reviewer) {
        logger.info('Security reviewer access granted');
        return true;
      } else {
        logger.warn('Security reviewer access denied: User is not a security reviewer');
        void router.navigate([authService.getLandingPage()]);
        return false;
      }
    }),
    catchError(error => {
      logger.error('Failed to verify security reviewer status', error);
      void router.navigate([authService.getLandingPage()]);
      return of(false);
    }),
  );
};
