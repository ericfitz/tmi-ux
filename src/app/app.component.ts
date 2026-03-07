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
import { Component, Injector } from '@angular/core';
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
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'TMI: Threat Modeling Improved';

  constructor(
    private injector: Injector,
    private sessionManager: SessionManagerService,
  ) {
    // Set the injector for dynamic material loading
    setInjector(injector);
  }
}
