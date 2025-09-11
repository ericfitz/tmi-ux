/**
 * Dialog Direction Service
 *
 * This service ensures that Material dialogs respect RTL/LTR direction changes
 * by monitoring language changes and updating dialog configurations accordingly.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Directionality } from '@angular/cdk/bidi';
import { LanguageService } from '../../i18n/language.service';
import { Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DialogDirectionService implements OnDestroy {
  private subscription: Subscription;

  constructor(
    private languageService: LanguageService,
    private directionality: Directionality,
    private dialog: MatDialog,
  ) {
    // Subscribe to direction changes and update dialog configuration
    this.subscription = this.languageService.direction$.subscribe(direction => {
      // Update the Directionality service value using internal API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (this.directionality as any).value = direction;

      // Emit change to update existing dialogs
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (this.directionality as any).change.next(direction);

      // Close any open dialogs so they reopen with correct direction
      this.dialog.closeAll();
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
