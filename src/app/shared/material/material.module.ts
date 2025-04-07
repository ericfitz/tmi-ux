import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

// Angular Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

const materialModules = [
  MatToolbarModule,
  MatButtonModule,
  MatIconModule,
  MatMenuModule,
  MatSidenavModule,
  MatListModule,
  MatCardModule,
  MatFormFieldModule,
  MatInputModule,
  MatSnackBarModule,
  MatDialogModule,
  MatProgressSpinnerModule,
  MatTableModule,
  MatPaginatorModule,
  MatSortModule,
  MatTooltipModule,
];

@NgModule({
  imports: [CommonModule, ...materialModules],
  exports: [...materialModules],
})
export class MaterialModule {}
