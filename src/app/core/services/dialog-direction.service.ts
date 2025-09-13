/**
 * Dialog Direction Service
 *
 * This service ensures that Material dialogs respect RTL/LTR direction changes
 * by monitoring language changes and updating dialog configurations accordingly.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { LanguageService } from '../../i18n/language.service';
import { Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DialogDirectionService implements OnDestroy {
  private subscription: Subscription;

  constructor(
    private languageService: LanguageService,
    private dialog: MatDialog,
  ) {
    // Subscribe to direction changes and close dialogs so they reopen with correct direction
    // The Directionality service will automatically detect the document direction changes
    this.subscription = this.languageService.direction$.subscribe(_direction => {
      // Close any open dialogs so they reopen with correct direction
      // The Directionality service reads from document.dir automatically
      this.dialog.closeAll();
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
