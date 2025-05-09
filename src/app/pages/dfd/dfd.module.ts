import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { DfdComponent } from './dfd.component';
import { DfdGraphService } from './services/dfd-graph.service';
import { DfdNodeService } from './services/dfd-node.service';
import { DfdPortService } from './services/dfd-port.service';
import { DfdEventService } from './services/dfd-event.service';
import { DfdHighlighterService } from './services/dfd-highlighter.service';
import { DfdLabelEditorService } from './services/dfd-label-editor.service';
import { DfdService } from './services/dfd.service';
import { DfdShapeFactoryService } from './services/dfd-shape-factory.service';
import { DfdEventBusService } from './services/dfd-event-bus.service';
import { DfdErrorService } from './services/dfd-error.service';
import { DfdAccessibilityService } from './services/dfd-accessibility.service';

/**
 * Module for the DFD component and related services
 */
@NgModule({
  declarations: [],
  imports: [CommonModule, CoreMaterialModule, DfdComponent],
  exports: [],
  providers: [
    // Core services
    DfdService,
    DfdShapeFactoryService,
    DfdEventBusService,
    DfdErrorService,
    DfdAccessibilityService,

    // Support services
    DfdGraphService,
    DfdNodeService,
    DfdPortService,
    DfdEventService,
    DfdHighlighterService,
    DfdLabelEditorService,
  ],
})
export class DfdModule {}
