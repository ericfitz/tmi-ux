import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';

export const homeGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  // If user is authenticated, redirect to their role-based landing page
  if (authService.isAuthenticated) {
    logger.debugComponent('HomeGuard', 'User is authenticated, redirecting to landing page');
    void router.navigate([authService.getLandingPage()]);
    return false;
  }

  // Allow access to home page for unauthenticated users
  return true;
};
