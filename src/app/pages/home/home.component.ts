import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-home',
  imports: [SharedModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  isAuthenticated = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Mock authentication check
    this.isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  }

  login(): void {
    // Mock login functionality
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('username', 'demo.user@example.com');
    this.isAuthenticated = true;
    this.router.navigate(['/diagram-management']);
  }
}
