import { Component, OnInit } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { Dnd } from '@antv/x6-plugin-dnd';
import { NodeService } from '../../services/x6/node.service';
import { X6GraphService } from '../../services/x6/x6-graph.service';
import { LoggerService } from '../../../../core/services/logger.service';

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
            <div class="store-preview"></div>
          </div>
          <div class="palette-item-label">Store</div>
        </div>
        <div class="palette-item actor-node" #actorNode>
          <div class="palette-item-preview">
            <div class="actor-preview"></div>
          </div>
          <div class="palette-item-label">Actor</div>
        </div>
        <div class="palette-item edge-item" (click)="enableEdgeCreation()">
          <div class="palette-item-preview">
            <div class="edge-preview">
              <div class="edge-line"></div>
              <div class="edge-arrow"></div>
            </div>
          </div>
          <div class="palette-item-label">Edge</div>
        </div>
        <div class="palette-item boundary-node" #boundaryNode>
          <div class="palette-item-preview">
            <div class="boundary-preview"></div>
          </div>
          <div class="palette-item-label">Boundary</div>
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
      .store-preview {
        width: 80px;
        height: 40px;
        background-color: #ffffff;
        border: 2px solid #5f95ff;
        border-radius: 50% / 20%;
        position: relative;
        overflow: hidden;
      }
      .store-preview::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: 50% / 20%;
        border-top: 2px solid #5f95ff;
        border-bottom: 2px solid #5f95ff;
        box-sizing: border-box;
      }
      .actor-preview {
        width: 40px;
        height: 40px;
        border: 2px solid #5f95ff;
        border-radius: 50%;
        background-color: #ffffff;
      }
      .edge-preview {
        width: 80px;
        height: 40px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .edge-line {
        width: 70px;
        height: 2px;
        background-color: #5f95ff;
        position: relative;
      }
      .edge-arrow {
        position: absolute;
        right: 5px;
        width: 0;
        height: 0;
        border-top: 6px solid transparent;
        border-bottom: 6px solid transparent;
        border-left: 10px solid #5f95ff;
      }
      .boundary-preview {
        width: 80px;
        height: 40px;
        border: 2px dashed #aaaaaa;
        border-radius: 10px;
        background-color: #f8f8f8;
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
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    // We need to wait for the graph to be initialized
    // Set up an interval to check for graph initialization
    const initInterval = setInterval(() => {
      this.graph = this.graphService.getGraph();

      if (this.graph) {
        clearInterval(initInterval);
        this.initializePalette();
      }
    }, 100);
  }

  /**
   * Initialize the palette once the graph is available
   */
  private initializePalette(): void {
    // Initialize the DND addon with options to fix passive event listener warnings
    this.dnd = new Dnd({
      target: this.graph!,
      scaled: false,
      getDragNode: node => node.clone(), // Return a copy of the node
      validateNode: () => true, // Always validate nodes
    });

    // Add a listener for when a node is added to the graph
    this.graph!.on('node:added', ({ node }) => {
      // Check if this is a temporary node from DND
      if (node.data && node.data.temp) {
        // Get the position and type
        const x = node.getPosition().x;
        const y = node.getPosition().y;
        const nodeType = node.data.type;

        // Remove the temporary node
        node.remove();

        // Create a permanent node based on the type
        switch (nodeType) {
          case 'process':
            this.nodeService.createProcessNode(x, y, 'Process');
            break;
          case 'store':
            this.nodeService.createStoreNode(x, y, 'Store');
            break;
          case 'actor':
            this.nodeService.createActorNode(x, y, 'Actor');
            break;
          case 'boundary':
            this.nodeService.createBoundaryNode(x, y, 'Boundary');
            break;
        }
      }
    });

    // Set up the drag and drop for each node type
    this.setupDragAndDrop();
  }

  private setupDragAndDrop(): void {
    if (!this.dnd || !this.graph) return;

    // Get the DOM elements - use more specific selectors to avoid conflicts
    const processNode = document.querySelector('.palette-item.process-node') as HTMLElement;
    const storeNode = document.querySelector('.palette-item.store-node') as HTMLElement;
    const actorNode = document.querySelector('.palette-item.actor-node') as HTMLElement;
    const boundaryNode = document.querySelector('.palette-item.boundary-node') as HTMLElement;

    if (processNode) {
      processNode.addEventListener('mousedown', e => {
        try {
          // Create a process node for dragging
          const node = this.graph!.createNode({
            shape: 'rect',
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
              label: {
                text: 'Process',
                fill: '#333333',
                fontSize: 14,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                refX: '50%',
                refY: '50%',
              },
            },
            data: {
              type: 'process',
              label: 'Process',
              temp: true, // Mark as temporary node
            },
          });

          this.dnd!.start(node, e);
        } catch (error) {
          this.logger.error('Error creating process node', error);
        }
      });
    }

    if (storeNode) {
      storeNode.addEventListener('mousedown', e => {
        try {
          // Create a store node for dragging
          const node = this.graph!.createNode({
            shape: 'rect',
            width: 120,
            height: 60,
            attrs: {
              body: {
                fill: '#ffffff',
                stroke: '#5F95FF',
                strokeWidth: 1,
                rx: 20,
                ry: 20,
              },
              label: {
                text: 'Store',
                fill: '#333333',
                fontSize: 14,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                refX: '50%',
                refY: '50%',
              },
            },
            data: {
              type: 'store',
              label: 'Store',
              temp: true, // Mark as temporary node
            },
          });

          this.dnd!.start(node, e);
        } catch (error) {
          this.logger.error('Error creating store node', error);
        }
      });
    }

    if (actorNode) {
      actorNode.addEventListener('mousedown', e => {
        try {
          // Create an actor node for dragging
          const node = this.graph!.createNode({
            shape: 'circle',
            width: 80,
            height: 80,
            attrs: {
              body: {
                fill: '#ffffff',
                stroke: '#5F95FF',
                strokeWidth: 1,
              },
              label: {
                text: 'Actor',
                fill: '#333333',
                fontSize: 14,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                refX: '50%',
                refY: '50%',
              },
            },
            data: {
              type: 'actor',
              label: 'Actor',
              temp: true, // Mark as temporary node
            },
          });

          this.dnd!.start(node, e);
        } catch (error) {
          this.logger.error('Error creating actor node', error);
        }
      });
    }

    if (boundaryNode) {
      boundaryNode.addEventListener('mousedown', e => {
        try {
          // Create a boundary node for dragging
          const node = this.graph!.createNode({
            shape: 'rect',
            width: 180,
            height: 120,
            attrs: {
              body: {
                fill: '#f8f8f8',
                stroke: '#aaaaaa',
                strokeWidth: 1,
                strokeDasharray: '5,5',
                rx: 10,
                ry: 10,
              },
              label: {
                text: 'Boundary',
                fill: '#666666',
                fontSize: 14,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                refX: '50%',
                refY: '50%',
              },
            },
            data: {
              type: 'boundary',
              label: 'Boundary',
              temp: true, // Mark as temporary node
            },
            zIndex: -1, // Place below other shapes
          });

          this.dnd!.start(node, e);
        } catch (error) {
          this.logger.error('Error creating boundary node', error);
        }
      });
    }
  }

  /**
   * Enable edge creation mode in the graph
   */
  enableEdgeCreation(): void {
    if (!this.graph) return;

    // Show a message to the user
    alert(
      'Edge creation mode enabled. Click on a source node and then a target node to create an edge.',
    );

    // Add a one-time listener for node clicks
    let sourceNodeId: string | null = null;

    const clickHandler = (args: any) => {
      const node = args.node;
      if (!node) return;

      if (!sourceNodeId) {
        // First click - set source node
        sourceNodeId = node.id;

        // Highlight the source node
        try {
          node.attr('body/stroke', '#ff0000');
          node.attr('body/strokeWidth', 2);
        } catch (e) {
          this.logger.error('Could not highlight node', e);
        }
      } else {
        // Second click - create edge between source and target
        const targetNodeId = node.id;

        if (sourceNodeId === targetNodeId) {
          alert('Cannot create an edge to the same node');
          return;
        }

        // Create the edge
        try {
          this.graph!.addEdge({
            source: { cell: sourceNodeId },
            target: { cell: targetNodeId },
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
          });
        } catch (e) {
          this.logger.error('Error creating edge', e);
          alert('Failed to create edge');
        }

        // Reset the source node highlight
        try {
          const sourceNode = this.graph!.getCellById(sourceNodeId);
          if (sourceNode) {
            sourceNode.attr('body/stroke', '#5F95FF');
            sourceNode.attr('body/strokeWidth', 1);
          }
        } catch (e) {
          this.logger.error('Could not reset node highlight', e);
        }

        // Reset the source node and remove the listener
        sourceNodeId = null;
        this.graph!.off('node:click', clickHandler);
      }
    };

    // Add the click handler
    this.graph.on('node:click', clickHandler);
  }
}
