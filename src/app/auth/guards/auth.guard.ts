import { CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (_route, _state) => {
  // For development: always allow access
  return true;

  /*
  const router = inject(Router);

  // Check for authentication - using localStorage for demo
  // In a real app, would use a full AuthService with JWT validation
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

  if (!isAuthenticated) {
    void router.navigate(['/']);
    return false;
  }

  return true;
  */
};
