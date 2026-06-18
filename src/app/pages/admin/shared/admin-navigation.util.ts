import { Router } from '@angular/router';

import { AuthService } from '@app/auth/services/auth.service';

/**
 * Navigates away from an admin page when it is closed.
 *
 * Admins return to the admin landing page; everyone else returns to their
 * role-appropriate landing page.
 *
 * @param router The Angular router used to perform navigation.
 * @param authService The auth service used to determine the destination.
 */
// SEM@913973c2390b7180140950023b498e5c44ca2678: route away from an admin page to the admin home or role landing page
export function navigateFromAdminPage(router: Router, authService: AuthService): void {
  if (authService.isAdmin) {
    void router.navigate(['/admin']);
  } else {
    void router.navigate([authService.getLandingPage()]);
  }
}
