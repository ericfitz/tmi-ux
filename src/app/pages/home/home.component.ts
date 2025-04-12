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
    });
  }

  ngOnDestroy(): void {
    // Clean up subscription to prevent memory leaks
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  login(): void {
    // Use auth service for login
    this.authService.demoLogin();
  }
}
