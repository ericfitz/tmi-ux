import { NgModule } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Feedback Material module that includes components used for user feedback
 * This should be imported only in modules that need feedback components
 */
@NgModule({
  exports: [MatProgressSpinnerModule, MatSnackBarModule, MatDialogModule, MatTooltipModule],
})
export class FeedbackMaterialModule {}
