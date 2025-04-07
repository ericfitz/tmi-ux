import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

// Direct Material Imports

// Services
import { AuthService } from '../../auth/services/auth.service';

// Transloco

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, TranslocoModule],
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
