import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

import { MaterialModule } from '../../shared/material/material.module';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-threat-models',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule, TranslocoModule],
  templateUrl: './threat-models.component.html',
  styleUrl: './threat-models.component.scss',
})
export class ThreatModelsComponent implements OnInit {
  // Placeholder for threat models list
  diagrams: Array<{ id: string; name: string; modifiedAt: Date }> = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'System Architecture',
      modifiedAt: new Date(),
    },
    {
      id: '456e7890-e12f-34d5-a678-426614174001',
      name: 'Data Flow Diagram',
      modifiedAt: new Date(Date.now() - 86400000),
    }, // 1 day ago
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Would fetch threat models from API in a real implementation
  }

  createDiagram(): void {
    // Would create diagram via API, then redirect with real ID
    const newId = 'new-diagram-' + Date.now();
    void this.router.navigate(['/dfd', newId]);
  }

  openDiagram(id: string): void {
    void this.router.navigate(['/dfd', id]);
  }

  deleteDiagram(id: string, event: MouseEvent): void {
    event.stopPropagation(); // Prevent opening diagram when clicking delete

    // Would delete diagram via API
    this.diagrams = this.diagrams.filter(d => d.id !== id);
  }
}
