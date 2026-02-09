import { Component, DestroyRef, inject, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, startWith, map } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { AdminUser } from '@app/types/user.types';

export interface UserPickerDialogData {
  title: string;
  excludeUserId?: string;
}

@Component({
  selector: 'app-user-picker-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatAutocompleteModule,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <mat-dialog-content>
      @if (!selectedUser) {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'transfer.userPicker.searchLabel'">Search by email</mat-label>
          <input
            matInput
            [formControl]="userSearchControl"
            [matAutocomplete]="auto"
            [placeholder]="'transfer.userPicker.searchPlaceholder' | transloco"
            cdkFocusInitial
          />
          <mat-icon matPrefix>search</mat-icon>
          <mat-autocomplete
            #auto="matAutocomplete"
            [displayWith]="displayUser"
            (optionSelected)="onUserSelected($event)"
          >
            @for (user of filteredUsers$ | async; track user.internal_uuid) {
              <mat-option [value]="user">
                <div class="user-option">
                  <span class="user-name">{{ user.name }}</span>
                  <span class="user-email">{{ user.email }}</span>
                </div>
              </mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>
      } @else {
        <div class="selected-user">
          <div class="user-info">
            <div class="user-name">{{ selectedUser.name }}</div>
            <div class="user-email">{{ selectedUser.email }}</div>
          </div>
          <button mat-icon-button (click)="onClearUser()" [matTooltip]="'common.clear' | transloco">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button mat-raised-button color="primary" (click)="onConfirm()" [disabled]="!selectedUser">
        <span [transloco]="'common.confirm'">Confirm</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }

      mat-dialog-content {
        min-width: 400px;
      }

      .user-option {
        display: flex;
        flex-direction: column;
        line-height: 1.3;
      }

      .user-name {
        font-weight: 500;
      }

      .user-email {
        font-size: 12px;
        color: var(--theme-text-secondary);
      }

      .selected-user {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--theme-surface-variant, rgba(0, 0, 0, 0.05));
        border-radius: 8px;
      }

      .user-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
    `,
  ],
})
export class UserPickerDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  userSearchControl = new FormControl('');
  filteredUsers$!: Observable<AdminUser[]>;
  selectedUser: AdminUser | null = null;

  constructor(
    public dialogRef: MatDialogRef<UserPickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserPickerDialogData,
    private userAdminService: UserAdminService,
  ) {}

  ngOnInit(): void {
    this.setupUserAutocomplete();
  }

  private setupUserAutocomplete(): void {
    this.filteredUsers$ = this.userSearchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => {
        if (typeof value === 'string' && value.length >= 2) {
          return this.userAdminService.list({ email: value, limit: 10 }).pipe(
            takeUntilDestroyed(this.destroyRef),
            map(response => {
              if (this.data.excludeUserId) {
                return response.users.filter(u => u.internal_uuid !== this.data.excludeUserId);
              }
              return response.users;
            }),
          );
        }
        return of([]);
      }),
    );
  }

  displayUser(user: AdminUser | null): string {
    if (!user) {
      return '';
    }
    return `${user.name} (${user.email})`;
  }

  onUserSelected(event: MatAutocompleteSelectedEvent): void {
    this.selectedUser = event.option.value as AdminUser;
  }

  onClearUser(): void {
    this.selectedUser = null;
    this.userSearchControl.setValue('');
  }

  onConfirm(): void {
    if (this.selectedUser) {
      this.dialogRef.close(this.selectedUser);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
