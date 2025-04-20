import { Component, OnInit } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { Dnd } from '@antv/x6-plugin-dnd';
import { NodeService } from '../../services/x6/node.service';
import { X6GraphService } from '../../services/x6/x6-graph.service';

@Component({
  selector: 'app-x6-palette',
  template: `
    <div class="palette">
      <h3>Shapes</h3>
      <div class="palette-items">
        <div class="palette-item process-node" #processNode>
          <div class="palette-item-preview">
            <div class="process-preview"></div>
          </div>
          <div class="palette-item-label">Process</div>
        </div>
        <div class="palette-item store-node" #storeNode>
          <div class="palette-item-preview">
            <div class="store-preview-top"></div>
            <div class="store-preview-body"></div>
            <div class="store-preview-bottom"></div>
          </div>
          <div class="palette-item-label">Store</div>
        </div>
        <div class="palette-item actor-node" #actorNode>
          <div class="palette-item-preview">
            <div class="actor-preview"></div>
          </div>
          <div class="palette-item-label">Actor</div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .palette {
        height: 100%;
        overflow-y: auto;
      }
      h3 {
        margin: 0 0 10px 0;
        font-size: 16px;
        font-weight: 500;
      }
      .palette-items {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .palette-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        cursor: grab;
        transition: all 0.2s;
      }
      .palette-item:hover {
        background-color: #f5f5f5;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      .palette-item-preview {
        width: 100%;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .palette-item-label {
        margin-top: 5px;
        font-size: 12px;
      }
      .process-preview {
        width: 80px;
        height: 40px;
        border: 2px solid #5f95ff;
        border-radius: 6px;
        background-color: #ffffff;
      }
      .store-preview-top {
        width: 80px;
        height: 8px;
        background-color: #ffffff;
        border: 2px solid #5f95ff;
        border-bottom: none;
        border-radius: 6px 6px 0 0;
      }
      .store-preview-body {
        width: 80px;
        height: 24px;
        background-color: #ffffff;
        border-left: 2px solid #5f95ff;
        border-right: 2px solid #5f95ff;
      }
      .store-preview-bottom {
        width: 80px;
        height: 8px;
        background-color: #ffffff;
        border: 2px solid #5f95ff;
        border-top: none;
        border-radius: 0 0 6px 6px;
      }
      .actor-preview {
        width: 40px;
        height: 40px;
        border: 2px solid #5f95ff;
        border-radius: 50%;
        background-color: #ffffff;
      }
    `,
  ],
  standalone: false,
})
export class X6PaletteComponent implements OnInit {
  private dnd: Dnd | null = null;
  private graph: Graph | null = null;

  constructor(
    private graphService: X6GraphService,
    private nodeService: NodeService,
  ) {}

  ngOnInit(): void {
    // Get the graph instance
    this.graph = this.graphService.getGraph();

    if (!this.graph) {
      console.error('Graph not initialized');
      return;
    }

    // Initialize the DND addon
    this.dnd = new Dnd({
      target: this.graph,
      scaled: false,
    });

    // Set up the drag and drop for each node type
    setTimeout(() => {
      this.setupDragAndDrop();
    }, 500);
  }

  private setupDragAndDrop(): void {
    if (!this.dnd || !this.graph) return;

    // Get the DOM elements
    const processNode = document.querySelector('.process-node') as HTMLElement;
    const storeNode = document.querySelector('.store-node') as HTMLElement;
    const actorNode = document.querySelector('.actor-node') as HTMLElement;

    if (processNode) {
      processNode.addEventListener('mousedown', e => {
        const node = this.graph!.createNode({
          shape: 'process-node',
          width: 120,
          height: 60,
          attrs: {
            body: {
              fill: '#ffffff',
              stroke: '#5F95FF',
              strokeWidth: 1,
              rx: 6,
              ry: 6,
            },
          },
          data: {
            type: 'process',
            label: 'Process',
          },
        });

        this.dnd!.start(node, e);
      });
    }

    if (storeNode) {
      storeNode.addEventListener('mousedown', e => {
        const node = this.graph!.createNode({
          shape: 'store-node',
          width: 120,
          height: 60,
          attrs: {
            body: {
              fill: '#ffffff',
              stroke: '#5F95FF',
              strokeWidth: 1,
            },
          },
          data: {
            type: 'store',
            label: 'Store',
          },
        });

        this.dnd!.start(node, e);
      });
    }

    if (actorNode) {
      actorNode.addEventListener('mousedown', e => {
        const node = this.graph!.createNode({
          shape: 'actor-node',
          width: 80,
          height: 100,
          attrs: {
            body: {
              fill: '#ffffff',
              stroke: '#5F95FF',
              strokeWidth: 1,
            },
          },
          data: {
            type: 'actor',
            label: 'Actor',
          },
        });

        this.dnd!.start(node, e);
      });
    }
  }
}
