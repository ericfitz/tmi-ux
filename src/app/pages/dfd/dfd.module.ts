import { NgModule, APP_INITIALIZER } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreMaterialModule } from '../../shared/material/core-material.module';
import { TranslocoModule } from '@jsverse/transloco';
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
import { DfdStateStore } from './state/dfd.state';
import { CommandManagerService } from './commands/command-manager.service';
import { CommandFactory } from './commands/command-factory.service';
import { DfdCommandService } from './services/dfd-command.service';

/**
 * Module for the DFD component and related services
 */
@NgModule({
  declarations: [],
  imports: [CommonModule, CoreMaterialModule, TranslocoModule, DfdComponent],
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

    // New state management and command pattern services
    DfdStateStore,
    CommandManagerService,
    CommandFactory,
    DfdCommandService,

    // Connect DfdCommandService with DfdLabelEditorService to avoid circular dependencies
    {
      provide: APP_INITIALIZER,
      useFactory: (
        labelEditorService: DfdLabelEditorService,
        commandService: DfdCommandService,
      ) => {
        return () => {
          // Set the command service in the label editor service
          labelEditorService.setCommandService(commandService);
          return Promise.resolve();
        };
      },
      deps: [DfdLabelEditorService, DfdCommandService],
      multi: true,
    },
  ],
})
export class DfdModule {}
