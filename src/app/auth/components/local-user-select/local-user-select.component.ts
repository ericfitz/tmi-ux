import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { LocalOAuthProviderService } from '../../services/local-oauth-provider.service';

@Component({
  selector: 'app-local-user-select',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  template: `
    <div class="local-auth-container">
      <mat-card class="auth-card">
        <mat-card-header>
          <div class="header-with-icon">
            <i class="fa-solid fa-laptop-code local-icon"></i>
            <div>
              <mat-card-title>Local Development Login</mat-card-title>
              <mat-card-subtitle>Select a user for testing</mat-card-subtitle>
            </div>
          </div>
        </mat-card-header>
        <mat-card-content>
          <div class="user-list">
            <button
              mat-stroked-button
              *ngFor="let user of users"
              (click)="selectUser(user.id)"
              class="user-button"
            >
              <div class="user-info">
                <i class="fa-solid fa-user user-icon"></i>
                <div class="user-details">
                  <div class="user-name">{{ user.name }}</div>
                  <div class="user-email">{{ user.email }}</div>
                </div>
              </div>
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .local-auth-container {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 40px 20px;
        max-width: 100%;
      }

      .auth-card {
        max-width: 400px;
        width: 100%;
      }

      .header-with-icon {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .local-icon {
        font-size: 32px;
        color: #6c757d;
      }

      .user-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .user-button {
        padding: 16px;
        text-align: left;
        transition: background-color 0.2s ease;

        &:hover {
          background-color: rgba(0, 0, 0, 0.04);
        }
      }

      .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .user-icon {
        font-size: 20px;
        color: #6c757d;
        width: 24px;
        text-align: center;
      }

      .user-details {
        display: flex;
        flex-direction: column;
      }

      .user-name {
        font-weight: 500;
        font-size: 16px;
      }

      .user-email {
        font-size: 14px;
        color: rgba(0, 0, 0, 0.6);
      }
    `,
  ],
})
export class LocalUserSelectComponent implements OnInit {
  users: Array<{ id: string; name: string; email: string; picture?: string }> = [];
  private state: string = '';

  constructor(
    private route: ActivatedRoute,
    private localProvider: LocalOAuthProviderService,
    private router: Router,
  ) {
    this.users = this.localProvider.getUsers();
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.state = (params['state'] as string) || '';
    });
  }

  selectUser(userId: string): void {
    const code = this.localProvider.generateAuthCode(userId);
    void this.router.navigate(['/auth/callback'], {
      queryParams: { code, state: this.state },
    });
  }
}
