import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private usernameSubject = new BehaviorSubject<string>('');
  
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  username$ = this.usernameSubject.asObservable();

  constructor(private router: Router) {
    // Initialize from localStorage on service creation
    this.checkAuthStatus();
  }

  // Check auth status from local storage
  checkAuthStatus(): void {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    const username = localStorage.getItem('username') || '';
    
    this.isAuthenticatedSubject.next(isAuthenticated);
    this.usernameSubject.next(username);
  }

  // Mock login - in a real app, this would make an API request to a backend
  login(username: string, password: string): void {
    // Simulate successful login
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('username', username);
    
    this.isAuthenticatedSubject.next(true);
    this.usernameSubject.next(username);
    
    this.router.navigate(['/diagram-management']);
  }

  // Shortcut login for demo purposes
  demoLogin(): void {
    this.login('demo.user@example.com', 'password');
  }

  // Logout
  logout(): void {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    
    this.isAuthenticatedSubject.next(false);
    this.usernameSubject.next('');
    
    this.router.navigate(['/']);
  }

  // Get authentication status
  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  // Get current username
  get username(): string {
    return this.usernameSubject.value;
  }
}
