import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from '../../core/rxjs-imports';

// Import the shared constants
import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS } from '@app/shared/imports';

// Services
import { AuthService } from '../../auth/services/auth.service';
import { BrandingConfigService } from '../../core/services/branding-config.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...CORE_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
// SEM@2cad9c89b8647548286ab1163fbaa90811eafce6: display the unauthenticated landing page and redirect authenticated users to their role's home
export class HomeComponent implements OnInit, OnDestroy {
  private readonly brandingConfig = inject(BrandingConfigService);

  isAuthenticated = false;
  readonly logoImageUrl$ = this.brandingConfig.logoImageUrl$;
  private authSubscription: Subscription | null = null;

  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: inject router and auth service dependencies for HomeComponent
  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}

  // SEM@dad0c81f4d87ea8457ac6ef32b1aedf685dc20ad: subscribe to auth state and route authenticated users to their landing page (mutates shared state)
  ngOnInit(): void {
    // Subscribe to auth state changes
    this.authSubscription = this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      this.isAuthenticated = isAuthenticated;

      // Redirect to role-based landing page if authenticated
      if (isAuthenticated) {
        void this.router.navigate([this.authService.getLandingPage()]);
      }
    });
  }

  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: unsubscribe from auth state to prevent memory leaks (pure)
  ngOnDestroy(): void {
    // Clean up subscription to prevent memory leaks
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }
}
