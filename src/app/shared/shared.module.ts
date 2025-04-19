import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MaterialModule } from './material/material.module';

@NgModule({
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, MaterialModule],
  exports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, MaterialModule],
})
export class SharedModule {}
