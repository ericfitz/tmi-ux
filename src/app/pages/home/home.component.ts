import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from '../../core/rxjs-imports';

// Import only the specific Material modules needed
import { CoreMaterialModule } from '../../shared/material/core-material.module';

// Services
import { AuthService } from '../../auth/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, CoreMaterialModule, TranslocoModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  isAuthenticated = false;
  private authSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state changes
    this.authSubscription = this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      this.isAuthenticated = isAuthenticated;

      // Redirect to threat models page if authenticated
      if (isAuthenticated) {
        void this.router.navigate(['/tm']);
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up subscription to prevent memory leaks
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  loginUser1(): void {
    // Use auth service for login with user1
    this.authService.demoLogin('user1@example.com');
  }

  loginUser2(): void {
    // Use auth service for login with user2
    this.authService.demoLogin('user2@example.com');
  }

  loginUser3(): void {
    // Use auth service for login with user3
    this.authService.demoLogin('user3@example.com');
  }
}
