import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule, TranslocoModule],
  templateUrl: './diagram-editor.component.html',
  styleUrl: './diagram-editor.component.scss'
})
export class DiagramEditorComponent implements OnInit {
  diagramId: string = '';
  diagramTitle: string = 'Loading diagram...';
  
  // Placeholder for diagram data
  diagramData: any = { components: [] };

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.diagramId = params.get('id') || '';
      
      // In a real app, would fetch diagram data from API
      this.loadDiagram(this.diagramId);
    });
  }

  loadDiagram(id: string): void {
    // Simulate API loading
    setTimeout(() => {
      this.diagramTitle = id.includes('new') ? 'New Diagram' : 'Existing Diagram';
      this.diagramData = {
        id: id,
        components: []
      };
    }, 500);
  }

  saveDiagram(): void {
    // Would save to API
    console.log('Saving diagram:', this.diagramId);
  }
}
