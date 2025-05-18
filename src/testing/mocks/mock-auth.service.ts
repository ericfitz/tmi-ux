/**
 * Mock authentication service for testing
 */

import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Interface for the user object
 */
export interface User {
  email: string;
  role: 'owner' | 'writer' | 'reader';
  isAuthenticated: boolean;
}

/**
 * Mock implementation of an authentication service for testing
 */
export class MockAuthService {
  private _currentUser = new BehaviorSubject<User | null>(null);

  /**
   * Get the current user as an observable
   */
  get currentUser$(): Observable<User | null> {
    return this._currentUser.asObservable();
  }

  /**
   * Get the current user
   */
  get currentUser(): User | null {
    return this._currentUser.value;
  }

  /**
   * Login with the specified email and role
   * @param email The email address to login with
   * @param role The role to assign to the user
   */
  login(email: string, role: 'owner' | 'writer' | 'reader' = 'owner'): void {
    this._currentUser.next({
      email,
      role,
      isAuthenticated: true,
    });
  }

  /**
   * Logout the current user
   */
  logout(): void {
    this._currentUser.next(null);
  }

  /**
   * Check if the current user has the specified role
   * @param role The role to check for
   * @returns True if the current user has the specified role, false otherwise
   */
  hasRole(role: 'owner' | 'writer' | 'reader'): boolean {
    const user = this._currentUser.value;
    if (!user) {
      return false;
    }

    // Owner has all permissions
    if (user.role === 'owner') {
      return true;
    }

    // Writer has writer and reader permissions
    if (user.role === 'writer') {
      return role === 'writer' || role === 'reader';
    }

    // Reader has only reader permissions
    return user.role === 'reader' && role === 'reader';
  }

  /**
   * Check if the current user is authenticated
   * @returns True if the current user is authenticated, false otherwise
   */
  isAuthenticated(): boolean {
    const user = this._currentUser.value;
    return user !== null && user.isAuthenticated;
  }

  /**
   * Check if the current user can edit
   * @returns True if the current user can edit, false otherwise
   */
  canEdit(): boolean {
    return this.hasRole('writer') || this.hasRole('owner');
  }

  /**
   * Check if the current user can delete
   * @returns True if the current user can delete, false otherwise
   */
  canDelete(): boolean {
    return this.hasRole('owner');
  }
}
