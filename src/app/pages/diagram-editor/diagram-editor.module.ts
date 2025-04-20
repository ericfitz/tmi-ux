import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { DiagramEditorRoutingModule } from './diagram-editor-routing.module';
import { DiagramEditorComponent } from './diagram-editor.component';

// X6 Components
import { X6DiagramCanvasComponent } from './components/x6/diagram-canvas.component';
import { ProcessNodeComponent } from './components/x6/process-node.component';
import { StoreNodeComponent } from './components/x6/store-node.component';
import { ActorNodeComponent } from './components/x6/actor-node.component';
import { X6PaletteComponent } from './components/x6/palette.component';
import { X6PropertiesPanelComponent } from './components/x6/properties-panel.component';

// X6 Services
import { X6GraphService } from './services/x6/x6-graph.service';
import { NodeService } from './services/x6/node.service';
import { EdgeService } from './services/x6/edge.service';
import { DiagramService } from './services/x6/diagram.service';
import { HistoryService } from './services/x6/history.service';
import { ExportImportService } from './services/x6/export-import.service';

@NgModule({
  declarations: [
    DiagramEditorComponent,
    X6DiagramCanvasComponent,
    ProcessNodeComponent,
    StoreNodeComponent,
    ActorNodeComponent,
    X6PaletteComponent,
    X6PropertiesPanelComponent,
  ],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DiagramEditorRoutingModule],
  providers: [
    X6GraphService,
    NodeService,
    EdgeService,
    DiagramService,
    HistoryService,
    ExportImportService,
  ],
})
export class DiagramEditorModule {}
