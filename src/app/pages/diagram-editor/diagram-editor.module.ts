import { NgModule } from '@angular/core';

import { DiagramEditorRoutingModule } from './diagram-editor-routing.module';

/**
 * This module is used for lazy loading the diagram editor.
 * The DiagramEditorComponent is a standalone component, so we don't need to import it here.
 * This ensures that @maxgraph/core and other diagram-related dependencies are only loaded
 * when this module is loaded, not in the initial bundle.
 */
@NgModule({
  imports: [DiagramEditorRoutingModule],
})
export class DiagramEditorModule {}
