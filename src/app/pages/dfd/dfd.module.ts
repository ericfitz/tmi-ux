import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { TranslocoModule } from '@jsverse/transloco';
import { DfdComponent } from './dfd.component';
import { DfdStateStore } from './state/dfd.state';

// New architecture services
import { CommandBusInitializerService } from './application/services/command-bus-initializer.service';
import {
  CommandBusService,
  CommandValidationMiddleware,
  CommandLoggingMiddleware,
  CommandSerializationMiddleware,
} from './application/services/command-bus.service';
import {
  DIAGRAM_REPOSITORY_TOKEN,
  CreateDiagramCommandHandler,
  AddNodeCommandHandler,
  UpdateNodePositionCommandHandler,
  UpdateNodeDataCommandHandler,
  RemoveNodeCommandHandler,
  AddEdgeCommandHandler,
  UpdateEdgeDataCommandHandler,
  RemoveEdgeCommandHandler,
  UpdateDiagramMetadataCommandHandler,
} from './application/handlers/diagram-command-handlers';
import { InMemoryDiagramRepository } from './infrastructure/repositories/in-memory-diagram.repository';
import { X6GraphAdapter } from './infrastructure/adapters/x6-graph.adapter';

/**
 * Module for the DFD component and related services
 */
@NgModule({
  declarations: [],
  imports: [CommonModule, CoreMaterialModule, TranslocoModule, DfdComponent],
  exports: [],
  providers: [
    // Legacy services
    DfdStateStore,

    // Command Bus and middleware
    CommandBusService,
    CommandValidationMiddleware,
    CommandLoggingMiddleware,
    CommandSerializationMiddleware,

    // Repository implementation
    {
      provide: DIAGRAM_REPOSITORY_TOKEN,
      useClass: InMemoryDiagramRepository,
    },

    // Command Handlers (explicitly provided to ensure proper DI)
    CreateDiagramCommandHandler,
    AddNodeCommandHandler,
    UpdateNodePositionCommandHandler,
    UpdateNodeDataCommandHandler,
    RemoveNodeCommandHandler,
    AddEdgeCommandHandler,
    UpdateEdgeDataCommandHandler,
    RemoveEdgeCommandHandler,
    UpdateDiagramMetadataCommandHandler,

    // CommandBus initializer
    CommandBusInitializerService,

    // Infrastructure adapters
    X6GraphAdapter,
  ],
})
export class DfdModule {}
