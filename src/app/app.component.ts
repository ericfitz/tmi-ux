import { CommonModule } from '@angular/common';
import { Component, Injector, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';

import { FooterComponent } from './core/components/footer/footer.component';
import { setInjector } from './core/utils/dynamic-material-loader';
import { NavbarComponent } from './core/components/navbar/navbar.component';
import { environment } from '../environments/environment';
import { LoggerService } from './core/services/logger.service';
import { AuthService } from './auth/services/auth.service';
import { SessionManagerService } from './auth/services/session-manager.service';
import { UserProfile } from './auth/models/auth.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'TMI: Threat Modeling Improved';
  isAuthenticated = false;
  userProfile: UserProfile | null = null;

  private authSubscription: Subscription | null = null;
  private userProfileSubscription: Subscription | null = null;

  constructor(
    private logger: LoggerService,
    private injector: Injector,
    private authService: AuthService,
    private sessionManager: SessionManagerService,
  ) {
    // Set the injector for dynamic material loading
    setInjector(injector);
  }

  ngOnInit(): void {
    this.logger.info('Application initialized');
    this.logger.debug('Environment configuration', environment);

    // Log application startup with environment info
    this.logger.info(`Running in ${environment.production ? 'production' : 'development'} mode`);
    this.logger.info(`API URL: ${environment.apiUrl}`);

    // Subscribe to authentication state
    this.authSubscription = this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      this.isAuthenticated = isAuthenticated;
      this.logger.debug(`Authentication status: ${isAuthenticated}`);
    });

    // Subscribe to user profile changes
    this.userProfileSubscription = this.authService.userProfile$.subscribe(userProfile => {
      this.userProfile = userProfile;
      this.logger.debug('User profile updated:', userProfile);
    });
  }

  logout(): void {
    this.authService.logout();
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.userProfileSubscription?.unsubscribe();
  }
}
