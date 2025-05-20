import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { DOCUMENT } from '@angular/common';

import { LoggerService } from '../../../../core/services/logger.service';
import {
  DfdCollaborationService,
  CollaborationUser,
} from '../../services/dfd-collaboration.service';

/**
 * Component for managing collaboration in the DFD editor
 */
@Component({
  selector: 'app-dfd-collaboration',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatBadgeModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslocoModule,
  ],
  templateUrl: './collaboration.component.html',
  styleUrls: ['./collaboration.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfdCollaborationComponent implements OnInit, OnDestroy {
  // Collaboration state
  isCollaborating = false;
  collaborationUsers: CollaborationUser[] = [];

  // URL copy feedback
  linkCopied = false;

  // Subscription management
  private _subscriptions = new Subscription();

  constructor(
    private _logger: LoggerService,
    private _cdr: ChangeDetectorRef,
    private _collaborationService: DfdCollaborationService,
    private _dialog: MatDialog,
    private _snackBar: MatSnackBar,
    @Inject(DOCUMENT) private _document: Document,
  ) {}

  ngOnInit(): void {
    this._logger.info('DfdCollaborationComponent initialized');

    // Subscribe to collaboration status changes
    this._subscriptions.add(
      this._collaborationService.isCollaborating$.subscribe(isCollaborating => {
        this.isCollaborating = isCollaborating;
        this._cdr.markForCheck();
      }),
    );

    // Subscribe to collaboration users changes
    this._subscriptions.add(
      this._collaborationService.collaborationUsers$.subscribe(users => {
        this.collaborationUsers = users;
        this._cdr.markForCheck();
      }),
    );
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this._subscriptions.unsubscribe();

    // End collaboration if active when component is destroyed
    if (this.isCollaborating) {
      this._collaborationService.endCollaboration().pipe(take(1)).subscribe();
    }
  }

  /**
   * Toggle collaboration on/off
   */
  toggleCollaboration(): void {
    if (this.isCollaborating) {
      this._collaborationService
        .endCollaboration()
        .pipe(take(1))
        .subscribe(success => {
          if (success) {
            this._logger.info('Collaboration ended successfully');
          } else {
            this._logger.error('Failed to end collaboration');
          }
        });
    } else {
      this._collaborationService
        .startCollaboration()
        .pipe(take(1))
        .subscribe(success => {
          if (success) {
            this._logger.info('Collaboration started successfully');
          } else {
            this._logger.error('Failed to start collaboration');
          }
        });
    }
  }

  /**
   * Copy the current URL to clipboard
   */
  copyLinkToClipboard(): void {
    try {
      const currentUrl = this._document.location.href;
      navigator.clipboard.writeText(currentUrl).then(
        () => {
          this._logger.info('URL copied to clipboard', { url: currentUrl });
          this._snackBar.open('Link copied to clipboard', 'Close', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });
        },
        (error: unknown) => {
          this._logger.error('Failed to copy URL to clipboard', { error });
          this._snackBar.open('Failed to copy link', 'Close', {
            duration: 3000,
          });
        },
      );
    } catch (error) {
      this._logger.error('Error copying URL to clipboard', { error });
    }
  }

  /**
   * Remove a user from the collaboration session
   * @param userId The ID of the user to remove
   */
  removeUser(userId: string): void {
    this._collaborationService
      .removeUser(userId)
      .pipe(take(1))
      .subscribe(success => {
        if (success) {
          this._logger.info('User removed successfully', { userId });
        } else {
          this._logger.error('Failed to remove user', { userId });
        }
      });
  }

  /**
   * Update a user's role in the collaboration session
   * @param userId The ID of the user to update
   * @param role The new role to assign
   */
  updateUserRole(userId: string, role: 'owner' | 'writer' | 'reader'): void {
    this._collaborationService
      .updateUserRole(userId, role)
      .pipe(take(1))
      .subscribe(success => {
        if (success) {
          this._logger.info('User role updated successfully', { userId, role });
        } else {
          this._logger.error('Failed to update user role', { userId, role });
        }
      });
  }

  /**
   * Check if the current user has a specific permission
   * @param permission The permission to check
   * @returns boolean indicating if the user has the permission
   */
  hasPermission(permission: 'edit' | 'invite' | 'remove' | 'changeRole'): boolean {
    return this._collaborationService.hasPermission(permission);
  }

  /**
   * Get the status color for a user
   * @param status The user's status
   * @returns A CSS color class
   */
  getStatusColor(status: 'active' | 'idle' | 'disconnected'): string {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'idle':
        return 'status-idle';
      case 'disconnected':
        return 'status-disconnected';
      default:
        return '';
    }
  }

  // The getRoleDisplayName method is no longer needed as we're using translations
}
