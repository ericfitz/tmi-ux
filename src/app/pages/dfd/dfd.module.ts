import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { TranslocoModule } from '@jsverse/transloco';
import { DfdComponent } from './dfd.component';
import { DfdStateStore } from './state/dfd.state';
import { X6GraphAdapter } from './infrastructure/adapters/x6-graph.adapter';
import { X6KeyboardHandler } from './infrastructure/adapters/x6-keyboard-handler';

/**
 * Module for the DFD component and related services
 * Simplified to work directly with X6 without command bus
 */
@NgModule({
  declarations: [],
  imports: [CommonModule, CoreMaterialModule, TranslocoModule, DfdComponent],
  exports: [],
  providers: [
    // State management
    DfdStateStore,

    // Infrastructure adapters
    X6GraphAdapter,
    X6KeyboardHandler,
  ],
})
export class DfdModule {}
