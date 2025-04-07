import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { DiagramManagementRoutingModule } from './diagram-management-routing.module';
import { DiagramManagementComponent } from './diagram-management.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [CommonModule, SharedModule, DiagramManagementRoutingModule, DiagramManagementComponent],
})
export class DiagramManagementModule {}
