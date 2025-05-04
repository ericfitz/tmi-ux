import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { DfdComponent } from './dfd.component';
import { DfdGraphService } from './services/dfd-graph.service';
import { DfdNodeService } from './services/dfd-node.service';
import { DfdPortService } from './services/dfd-port.service';
import { DfdEventService } from './services/dfd-event.service';
import { DfdHighlighterService } from './services/dfd-highlighter.service';

/**
 * Module for the DFD component and related services
 */
@NgModule({
  declarations: [],
  imports: [CommonModule, CoreMaterialModule, DfdComponent],
  exports: [],
  providers: [
    DfdGraphService,
    DfdNodeService,
    DfdPortService,
    DfdEventService,
    DfdHighlighterService,
  ],
})
export class DfdModule {}
