import { NgModule } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatCardModule } from '@angular/material/card';

/**
 * Data Material module that includes components used for data display
 * This should be imported only in modules that need data display components
 */
@NgModule({
  exports: [MatTableModule, MatPaginatorModule, MatSortModule, MatCardModule],
})
export class DataMaterialModule {}
