import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  isAuthenticated = false;
  username = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Mock authentication check - would be connected to auth service
    this.isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    this.username = localStorage.getItem('username') || '';
  }

  logout(): void {
    // Mock logout - would be connected to auth service
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    this.isAuthenticated = false;
    this.username = '';
    this.router.navigate(['/']);
  }
}
