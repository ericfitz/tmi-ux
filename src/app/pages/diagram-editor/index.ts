/**
 * Diagram Editor module barrel file
 * This file re-exports the main module and component
 * For specific imports, use the individual barrel files
 */

// Export the module and component
export * from './diagram-editor.module';
export * from './diagram-editor.component';

// Export barrel files (but don't use * to avoid naming conflicts)
export {
  StateIndicatorComponent,
  ToolbarComponent,
  PaletteComponent,
  PropertiesPanelComponent,
  DiagramCanvasComponent,
} from './components';

// Note: For services and models, import directly from their respective barrel files:
// import { DiagramService, DiagramRendererService, ... } from './services';
// import { Diagram, DiagramTheme, ... } from './models';
