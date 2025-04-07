import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { DiagramEditorRoutingModule } from './diagram-editor-routing.module';
import { DiagramEditorComponent } from './diagram-editor.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [CommonModule, SharedModule, DiagramEditorRoutingModule, DiagramEditorComponent],
})
export class DiagramEditorModule {}
