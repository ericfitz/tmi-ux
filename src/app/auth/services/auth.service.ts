import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from '../../core/rxjs-imports';

import { LoggerService } from '../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Private subjects
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private usernameSubject = new BehaviorSubject<string>('');

  // Public observables
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  username$ = this.usernameSubject.asObservable();

  constructor(
    private router: Router,
    private logger: LoggerService,
  ) {
    this.logger.info('Auth Service initialized');
    // Initialize from localStorage on service creation
    this.checkAuthStatus();
  }

  // Get authentication status
  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  // Get current username
  get username(): string {
    return this.usernameSubject.value;
  }

  // Check auth status from local storage
  checkAuthStatus(): void {
    // Log variable initialization with source information
    const isAuthenticated = this.logger.logInit(
      'isAuthenticated',
      localStorage.getItem('isAuthenticated') === 'true',
      'AuthService.checkAuthStatus',
    );

    const username = this.logger.logInit(
      'username',
      localStorage.getItem('username') || '',
      'AuthService.checkAuthStatus',
    );

    this.isAuthenticatedSubject.next(isAuthenticated);
    this.usernameSubject.next(username);

    this.logger.debug(
      `Auth status checked: authenticated=${isAuthenticated}, username=${username}`,
    );
  }

  // Mock login - in a real app, this would make an API request to a backend
  login(username: string, _password: string): void {
    this.logger.info(`Login attempt for user: ${username}`);

    // Simulate successful login
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('username', username);

    // Log updates to authentication state
    this.logger.logUpdate('authState', true, 'AuthService.login');
    this.isAuthenticatedSubject.next(true);

    this.logger.logUpdate('username', username, 'AuthService.login');
    this.usernameSubject.next(username);

    this.logger.info(`User ${username} successfully logged in`);
    void this.router.navigate(['/diagram-management']);
  }

  // Shortcut login for demo purposes
  demoLogin(): void {
    this.login('demo.user@example.com', 'password');
  }

  // Logout
  logout(): void {
    const username = this.usernameSubject.value;
    this.logger.info(`Logging out user: ${username}`);

    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');

    // Log updates to authentication state
    this.logger.logUpdate('authState', false, 'AuthService.logout');
    this.isAuthenticatedSubject.next(false);

    this.logger.logUpdate('username', '', 'AuthService.logout');
    this.usernameSubject.next('');

    this.logger.info('User logged out successfully');
    void this.router.navigate(['/']);
  }
}
