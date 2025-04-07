import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DiagramEditorRoutingModule } from './diagram-editor-routing.module';
import { DiagramEditorComponent } from './diagram-editor.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    DiagramEditorComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    DiagramEditorRoutingModule
  ]
})
export class DiagramEditorModule { }
