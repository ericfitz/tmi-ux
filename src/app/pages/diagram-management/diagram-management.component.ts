import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';

@Component({
  selector: 'app-diagram-management',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule],
  templateUrl: './diagram-management.component.html',
  styleUrl: './diagram-management.component.scss'
})
export class DiagramManagementComponent implements OnInit {
  // Placeholder for diagrams list
  diagrams: any[] = [
    { id: '123e4567-e89b-12d3-a456-426614174000', name: 'System Architecture', modifiedAt: new Date() },
    { id: '456e7890-e12f-34d5-a678-426614174001', name: 'Data Flow Diagram', modifiedAt: new Date(Date.now() - 86400000) } // 1 day ago
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Would fetch diagrams from API in a real implementation
  }

  createDiagram(): void {
    // Would create diagram via API, then redirect with real ID
    const newId = 'new-diagram-' + Date.now();
    this.router.navigate(['/diagram-editor', newId]);
  }

  openDiagram(id: string): void {
    this.router.navigate(['/diagram-editor', id]);
  }

  deleteDiagram(id: string, event: MouseEvent): void {
    event.stopPropagation(); // Prevent opening diagram when clicking delete
    
    // Would delete diagram via API
    this.diagrams = this.diagrams.filter(d => d.id !== id);
  }
}
