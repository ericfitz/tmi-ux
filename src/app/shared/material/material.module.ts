import { NgModule } from '@angular/core';

// Feature-specific Material modules
import { CoreMaterialModule } from './core-material.module';
import { FormMaterialModule } from './form-material.module';
import { DataMaterialModule } from './data-material.module';
import { FeedbackMaterialModule } from './feedback-material.module';

/**
 * Main Material module that re-exports all feature-specific modules
 * This is kept for backward compatibility, but new components should
 * import only the specific modules they need
 */
@NgModule({
  exports: [CoreMaterialModule, FormMaterialModule, DataMaterialModule, FeedbackMaterialModule],
})
export class MaterialModule {}
