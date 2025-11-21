/**
 * Authentication Route Guard
 *
 * This guard protects routes that require user authentication.
 * It checks if the user is authenticated and redirects to login if not.
 *
 * Key functionality:
 * - Uses Angular's functional guard pattern with dependency injection
 * - Checks authentication status reactively via AuthService observable
 * - Redirects unauthenticated users to login page with return URL
 * - Preserves the intended destination for post-login redirect
 * - Provides logging for authentication decisions
 * - Handles session expiration gracefully with appropriate messaging
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';
import { map, take } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  return authService.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      if (isAuthenticated) {
        // logger.debugComponent('AuthGuard', 'User is authenticated, allowing access');
        return true;
      } else {
        logger.debugComponent('AuthGuard', 'User is not authenticated, redirecting to login page');
        void router.navigate(['/login'], {
          queryParams: {
            returnUrl: state.url,
            reason: 'session_expired',
          },
        });
        return false;
      }
    }),
  );
};
