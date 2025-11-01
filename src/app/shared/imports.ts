/**
 * Shared Import Constants
 *
 * This file provides reusable import constants for standalone components
 * to reduce duplication and standardize imports across the application.
 *
 * Usage:
 * import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS } from '@app/shared/imports';
 *
 * @Component({
 *   standalone: true,
 *   imports: [...COMMON_IMPORTS, ...CORE_MATERIAL_IMPORTS]
 * })
 */

import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Material imports organized by feature
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatChipsModule } from '@angular/material/chips';

// Shared directives
import { ScrollIndicatorDirective } from './directives/scroll-indicator.directive';

// Export directive for direct use
export { ScrollIndicatorDirective };

/**
 * Common Angular imports used by most components
 */
export const COMMON_IMPORTS = [
  CommonModule,
  FormsModule,
  ReactiveFormsModule,
  RouterModule,
] as const;

/**
 * Core Material components for basic UI (buttons, icons, toolbar, menu)
 */
export const CORE_MATERIAL_IMPORTS = [
  MatButtonModule,
  MatIconModule,
  MatToolbarModule,
  MatMenuModule,
  MatTooltipModule,
  MatDividerModule,
] as const;

/**
 * Form-related Material components
 */
export const FORM_MATERIAL_IMPORTS = [
  MatFormFieldModule,
  MatInputModule,
  MatSelectModule,
  MatCheckboxModule,
  MatRadioModule,
  MatSlideToggleModule,
] as const;

/**
 * Data display Material components (tables, cards, lists)
 */
export const DATA_MATERIAL_IMPORTS = [
  MatTableModule,
  MatPaginatorModule,
  MatSortModule,
  MatCardModule,
  MatListModule,
  MatGridListModule,
  MatBadgeModule,
  MatChipsModule,
] as const;

/**
 * User feedback Material components (dialogs, snackbars, spinners)
 */
export const FEEDBACK_MATERIAL_IMPORTS = [
  MatProgressSpinnerModule,
  MatSnackBarModule,
  MatDialogModule,
] as const;

/**
 * All Material imports (use sparingly - prefer specific imports)
 */
export const ALL_MATERIAL_IMPORTS = [
  ...CORE_MATERIAL_IMPORTS,
  ...FORM_MATERIAL_IMPORTS,
  ...DATA_MATERIAL_IMPORTS,
  ...FEEDBACK_MATERIAL_IMPORTS,
] as const;

/**
 * Common combination for basic components with forms
 */
export const COMMON_STANDALONE_IMPORTS = [
  ...COMMON_IMPORTS,
  ...CORE_MATERIAL_IMPORTS,
  ...FORM_MATERIAL_IMPORTS,
] as const;

/**
 * Common combination for data display components
 */
export const DATA_DISPLAY_IMPORTS = [
  ...COMMON_IMPORTS,
  ...CORE_MATERIAL_IMPORTS,
  ...DATA_MATERIAL_IMPORTS,
] as const;

/**
 * Common combination for dialog components
 */
export const DIALOG_IMPORTS = [
  ...COMMON_IMPORTS,
  ...CORE_MATERIAL_IMPORTS,
  ...FORM_MATERIAL_IMPORTS,
  MatDialogModule,
  ScrollIndicatorDirective,
] as const;
