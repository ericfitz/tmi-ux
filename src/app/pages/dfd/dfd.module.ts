import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { TranslocoModule } from '@jsverse/transloco';
import { DfdComponent } from './dfd.component';
import { DfdHighlighterService } from './services/dfd-highlighter.service';
import { DfdStateStore } from './state/dfd.state';

/**
 * Module for the DFD component and related services
 */
@NgModule({
  declarations: [],
  imports: [CommonModule, CoreMaterialModule, TranslocoModule, DfdComponent],
  exports: [],
  providers: [
    // Remaining services - legacy services removed during clean architecture migration
    DfdHighlighterService,
    DfdStateStore,
  ],
})
export class DfdModule {}
