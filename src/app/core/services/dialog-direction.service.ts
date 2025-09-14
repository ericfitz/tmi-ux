/**
 * Dialog Direction Service
 *
 * This service ensures that Material dialogs respect RTL/LTR direction changes
 * by monitoring language changes and updating dialog configurations accordingly.
 */

import { Injectable, OnDestroy, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
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
    @Inject(DOCUMENT) private document: Document,
  ) {
    // Subscribe to direction changes and update dialog configuration
    this.subscription = this.languageService.direction$.subscribe(direction => {
      // Update the document direction attribute - this is the proper way in Angular CDK v20+
      // The Directionality service automatically detects changes to the document's dir attribute
      this.document.documentElement.setAttribute('dir', direction);

      // Alternative: also set on body element for additional compatibility
      this.document.body.setAttribute('dir', direction);

      // Close any open dialogs so they reopen with correct direction
      // The Directionality service will pick up the new direction automatically
      this.dialog.closeAll();
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
