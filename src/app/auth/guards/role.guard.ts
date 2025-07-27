import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';
import { UserRole } from '../models/auth.models';
import { map, take } from 'rxjs';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  const requiredRole = route.data['requiredRole'] as UserRole;

  return authService.userProfile$.pipe(
    take(1),
    map(userProfile => {
      if (!userProfile) {
        logger.debugComponent('RoleGuard', 'User profile not found, redirecting to login');
        void router.navigate(['/login'], {
          queryParams: { returnUrl: state.url, reason: 'no_profile' },
        });
        return false;
      }

      // For now, we'll assume all authenticated users have all roles
      // In a real implementation, we would check userProfile.roles against requiredRole
      if (authService.hasRole(requiredRole)) {
        logger.debugComponent('RoleGuard', `User has required role: ${requiredRole}, allowing access`);
        return true;
      } else {
        logger.warn(
          `User does not have required role: ${requiredRole}, redirecting to unauthorized`,
        );
        void router.navigate(['/unauthorized'], {
          queryParams: {
            requiredRole,
            currentUrl: state.url,
          },
        });
        return false;
      }
    }),
  );
};
