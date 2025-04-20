import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { X6GraphService } from '../../services/x6/x6-graph.service';

@Component({
  selector: 'app-x6-diagram-canvas',
  template: ` <div class="diagram-canvas" #container></div> `,
  styles: [
    `
      .diagram-canvas {
        width: 100%;
        height: 100%;
        background-color: #f5f5f5;
        border: 1px solid #e0e0e0;
      }
    `,
  ],
  standalone: false,
})
export class X6DiagramCanvasComponent implements OnInit, OnDestroy {
  @ViewChild('container', { static: true }) containerRef!: ElementRef;

  constructor(private graphService: X6GraphService) {}

  ngOnInit(): void {
    // Initialize the graph with the container element
    this.graphService.initialize(this.containerRef.nativeElement);
  }

  ngOnDestroy(): void {
    // Destroy the graph when the component is destroyed
    this.graphService.destroy();
  }
}
