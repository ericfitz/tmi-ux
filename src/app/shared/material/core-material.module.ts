import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Core Material module that includes only the essential components
 * used in the app shell (navbar, footer, etc.)
 */
@NgModule({
  exports: [MatButtonModule, MatIconModule, MatToolbarModule, MatMenuModule, MatTooltipModule],
})
export class CoreMaterialModule {}
