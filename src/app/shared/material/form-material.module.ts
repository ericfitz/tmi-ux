import { NgModule } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';

/**
 * Form Material module that includes components used in forms
 * This should be imported only in modules that need form components
 */
@NgModule({
  exports: [MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatRadioModule],
})
export class FormMaterialModule {}
