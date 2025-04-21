import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../core/services/logger.service';

// Import only the specific Material modules needed
import { CoreMaterialModule } from '../../shared/material/core-material.module';

@Component({
  selector: 'app-zzz',
  standalone: true,
  imports: [CommonModule, CoreMaterialModule, TranslocoModule],
  templateUrl: './zzz.component.html',
  styleUrl: './zzz.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZzzComponent implements OnInit, OnDestroy {
  @ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef;

  private graph: Graph | null = null;

  constructor(private logger: LoggerService) {}

  ngOnInit(): void {
    this.initializeGraph();
  }

  ngOnDestroy(): void {
    if (this.graph) {
      this.graph.dispose();
      this.graph = null;
    }
  }

  /**
   * Initialize the X6 graph
   */
  private initializeGraph(): void {
    try {
      // Create the graph
      this.graph = new Graph({
        container: this.graphContainer.nativeElement,
        width: this.graphContainer.nativeElement.clientWidth,
        height: this.graphContainer.nativeElement.clientHeight,
        grid: {
          visible: true,
          type: 'doubleMesh',
          args: [
            {
              color: '#CCCCCC',
              thickness: 1,
            },
            {
              color: '#5F95FF',
              thickness: 1,
              factor: 4,
            },
          ],
        },
        background: {
          color: '#F8F9FA',
        },
        mousewheel: {
          enabled: true,
          zoomAtMousePosition: true,
          modifiers: 'ctrl',
          minScale: 0.5,
          maxScale: 3,
        },
        connecting: {
          router: 'manhattan',
          connector: {
            name: 'rounded',
            args: {
              radius: 8,
            },
          },
          anchor: 'center',
          connectionPoint: 'anchor',
          allowBlank: false,
          snap: {
            radius: 20,
          },
          createEdge: () => {
            return this.graph?.createEdge({
              shape: 'edge',
              attrs: {
                line: {
                  stroke: '#5F95FF',
                  strokeWidth: 2,
                  targetMarker: {
                    name: 'classic',
                    size: 8,
                  },
                },
              },
              router: {
                name: 'manhattan',
              },
            });
          },
          validateConnection({ sourceView, targetView, sourceMagnet, targetMagnet }) {
            if (sourceView === targetView) {
              return false;
            }
            if (!sourceMagnet) {
              return false;
            }
            if (!targetMagnet) {
              return false;
            }
            return true;
          },
        },
        highlighting: {
          magnetAvailable: {
            name: 'stroke',
            args: {
              padding: 4,
              attrs: {
                strokeWidth: 2,
                stroke: '#5F95FF',
              },
            },
          },
          magnetAdsorbed: {
            name: 'stroke',
            args: {
              padding: 4,
              attrs: {
                strokeWidth: 2,
                stroke: '#5F95FF',
              },
            },
          },
        },
      });

      // Add a simple rectangle node as an example
      this.graph.addNode({
        x: 100,
        y: 100,
        width: 100,
        height: 60,
        attrs: {
          body: {
            fill: '#ffffff',
            stroke: '#5F95FF',
            strokeWidth: 2,
            rx: 4,
            ry: 4,
          },
          label: {
            text: 'Example Node',
            fill: '#333333',
            fontSize: 14,
            textAnchor: 'middle',
            textVerticalAnchor: 'middle',
          },
        },
      });

      this.logger.info('X6 graph initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing X6 graph', error);
    }
  }
}
