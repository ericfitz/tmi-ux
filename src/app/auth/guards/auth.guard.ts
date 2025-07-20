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
        logger.debug('User is authenticated, allowing access');
        return true;
      } else {
        logger.debug('User is not authenticated, redirecting to login page');
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
