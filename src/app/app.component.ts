/**
 * Root Application Component
 *
 * This is the main application component that serves as the root of the Angular application.
 * It provides the core layout structure and manages global application state.
 *
 * Key functionality:
 * - Renders the main application layout with navbar, router outlet, and footer
 * - Manages global authentication state and user profile information
 * - Initializes the dependency injection system for dynamic material loading
 * - Provides logging for application startup and authentication events
 * - Handles user logout functionality
 * - Subscribes to authentication and user profile changes
 */

import { CommonModule } from '@angular/common';
import { Component, Injector, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { FooterComponent } from './core/components/footer/footer.component';
import { setInjector } from './core/utils/dynamic-material-loader.util';
import { NavbarComponent } from './core/components/navbar/navbar.component';
import { SessionManagerService } from './auth/services/session-manager.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.scss',
})
// SEM@4ed130a60616a970c685c78ff132b21800f7ae3b: root application shell; bootstraps injector and session manager (mutates shared state)
export class AppComponent {
  title = 'TMI: Threat Modeling Improved';

  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: register the DI injector and initialize the session manager (mutates shared state)
  constructor(
    private injector: Injector,
    private sessionManager: SessionManagerService,
  ) {
    // Set the injector for dynamic material loading
    setInjector(injector);
  }
}
