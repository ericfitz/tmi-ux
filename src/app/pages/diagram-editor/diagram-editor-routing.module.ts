import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DiagramEditorComponent } from './diagram-editor.component';

const routes: Routes = [
  {
    path: '',
    component: DiagramEditorComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DiagramEditorRoutingModule { }
