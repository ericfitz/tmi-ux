import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { Dnd } from '@antv/x6-plugin-dnd';
import { NodeService } from '../../services/x6/node.service';
import { X6GraphService } from '../../services/x6/x6-graph.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { ThemeService } from '../../services/theme/theme.service';
import { NodeRegistryService } from '../../services/x6/node-registry.service';

@Component({
  selector: 'app-x6-palette',
  template: `
    <div class="palette">
      <h3>Shapes</h3>
      <div #paletteContainer class="palette-graph-container"></div>
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
      .palette-graph-container {
        width: 100%;
        height: 400px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        background-color: #ffffff;
      }
    `,
  ],
  standalone: false,
})
export class X6PaletteComponent implements OnInit, OnDestroy {
  @ViewChild('paletteContainer', { static: true }) paletteContainer!: ElementRef;

  private dnd: Dnd | null = null;
  private graph: Graph | null = null;
  private paletteGraph: Graph | null = null;

  // Node definitions
  private readonly nodeDefinitions = [
    { type: 'process', shape: 'process-node', label: 'Process' },
    { type: 'store', shape: 'store-node', label: 'Store' },
    { type: 'actor', shape: 'actor-node', label: 'Actor' },
    { type: 'boundary', shape: 'boundary-node', label: 'Boundary' },
  ];

  constructor(
    private graphService: X6GraphService,
    private nodeService: NodeService,
    private logger: LoggerService,
    private themeService: ThemeService,
    private nodeRegistryService: NodeRegistryService,
  ) {}

  ngOnInit(): void {
    // Ensure node shapes are registered
    this.nodeRegistryService.registerNodeShapes();

    // We need to wait for the main graph to be initialized
    const initInterval = setInterval(() => {
      this.graph = this.graphService.getGraph();

      if (this.graph) {
        clearInterval(initInterval);
        this.initializePalette();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.paletteGraph) {
      this.paletteGraph.dispose();
      this.paletteGraph = null;
    }

    if (this.dnd) {
      this.dnd = null;
    }
  }

  /**
   * Initialize the palette once the graph is available
   */
  private initializePalette(): void {
    try {
      // Create the palette graph
      this.paletteGraph = new Graph({
        container: this.paletteContainer.nativeElement,
        width: this.paletteContainer.nativeElement.clientWidth,
        height: 400,
        grid: false,
        interacting: {
          nodeMovable: false,
          edgeMovable: false,
          edgeLabelMovable: false,
          arrowheadMovable: false,
          vertexMovable: false,
          vertexAddable: false,
          vertexDeletable: false,
        },
        background: {
          color: '#ffffff',
        },
      });

      // Initialize the DND addon
      this.dnd = new Dnd({
        target: this.graph!,
        scaled: false,
        validateNode: () => true,
      });

      // Add a listener for when a node is added to the graph
      this.graph!.on('node:added', ({ node }) => {
        try {
          // Check if this is a temporary node from DND
          if (node.data && node.data.type) {
            // Get the position and type
            const position = node.getPosition();
            const nodeType = node.data.type;

            this.logger.info(`Node added: ${nodeType} at position ${position.x}, ${position.y}`);

            // Remove the temporary node
            node.remove();

            // Create a permanent node based on the type
            switch (nodeType) {
              case 'process':
                this.nodeService.createProcessNode(position.x, position.y, 'Process');
                break;
              case 'store':
                this.nodeService.createStoreNode(position.x, position.y, 'Store');
                break;
              case 'actor':
                this.nodeService.createActorNode(position.x, position.y, 'Actor');
                break;
              case 'boundary':
                this.nodeService.createBoundaryNode(position.x, position.y, 'Boundary');
                break;
              default:
                this.logger.warn(`Unknown node type: ${nodeType}`);
            }
          }
        } catch (error) {
          this.logger.error('Error processing added node', error);
        }
      });

      // Add nodes to the palette
      this.addNodesToPalette();

      this.logger.info('Palette initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing palette', error);
    }
  }

  /**
   * Add nodes to the palette
   */
  private addNodesToPalette(): void {
    if (!this.paletteGraph) return;

    const containerWidth = this.paletteContainer.nativeElement.clientWidth;
    // Use 40% of container width for each column, with 10% padding on each side
    const columnWidth = containerWidth * 0.4;
    const xPositions = [containerWidth * 0.2, containerWidth * 0.8];

    let yPosition = 20;
    let column = 0;

    // Add each node type to the palette
    this.nodeDefinitions.forEach((nodeDef, index) => {
      try {
        // Calculate position - 2 nodes per row
        const xPosition = xPositions[column];

        // Determine node size - scale to make them similar heights
        let width, height;

        switch (nodeDef.shape) {
          case 'actor-node':
            width = 40;
            height = 50;
            break;
          case 'store-node':
            width = 50;
            height = 50;
            break;
          case 'process-node':
            width = 60;
            height = 35;
            break;
          case 'boundary-node':
            width = 70;
            height = 45;
            break;
          default:
            width = 50;
            height = 35;
        }

        // Create a node based on the shape
        const node = this.paletteGraph!.createNode({
          shape: nodeDef.shape,
          x: xPosition,
          y: yPosition,
          width,
          height,
          attrs: {
            label: {
              text: nodeDef.label,
            },
          },
          data: {
            type: nodeDef.type,
          },
        });

        // Add the node to the graph
        this.paletteGraph!.addNode(node);

        // Set up drag and drop for this node
        this.setupNodeDragAndDrop(node, nodeDef.type);

        // Move to next column or row
        column = (column + 1) % 2;
        if (column === 0) {
          yPosition += 80; // Move to next row
        }
      } catch (error) {
        this.logger.error(`Error adding ${nodeDef.type} node to palette`, error);
      }
    });

    // Add an edge example
    yPosition += 20;
    const centerX = this.paletteContainer.nativeElement.clientWidth / 2;
    const edgeLabel = this.paletteGraph.addNode({
      x: centerX,
      y: yPosition,
      width: 100,
      height: 30,
      attrs: {
        body: {
          fill: 'transparent',
          stroke: 'transparent',
        },
        label: {
          text: 'Edge',
          fill: '#333333',
          fontSize: 14,
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
        },
      },
    });

    // Add a visual edge example
    const sourceNode = this.paletteGraph.addNode({
      x: centerX - 50,
      y: yPosition + 40,
      width: 20,
      height: 20,
      attrs: {
        body: {
          fill: '#ffffff',
          stroke: '#5F95FF',
          strokeWidth: 1,
          rx: 4,
          ry: 4,
        },
      },
      visible: true,
    });

    const targetNode = this.paletteGraph.addNode({
      x: centerX + 50,
      y: yPosition + 40,
      width: 20,
      height: 20,
      attrs: {
        body: {
          fill: '#ffffff',
          stroke: '#5F95FF',
          strokeWidth: 1,
          rx: 4,
          ry: 4,
        },
      },
      visible: true,
    });

    this.paletteGraph.addEdge({
      source: sourceNode,
      target: targetNode,
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

    // Add click handler for edge creation
    edgeLabel.on('click', () => {
      this.enableEdgeCreation();
    });
  }

  /**
   * Set up drag and drop for a node
   */
  private setupNodeDragAndDrop(node: Node, type: string): void {
    if (!this.dnd || !this.paletteGraph) return;

    // Make the node draggable
    node.on('mousedown', (event: any) => {
      try {
        this.logger.info(`Mouse down on ${type} node`);

        // Create a clone of the node for dragging
        const dragNode = node.clone();

        // Set the data type for the node
        dragNode.setData({ type });

        // Start the drag operation
        if (event.originalEvent) {
          this.logger.info(`Starting drag operation for ${type} node`);
          this.dnd!.start(dragNode, event.originalEvent as MouseEvent);
        } else {
          this.logger.warn('No original event found for drag operation');
        }
      } catch (error) {
        this.logger.error('Error starting drag operation', error);
      }
    });
  }

  /**
   * Enable edge creation mode in the graph
   */
  enableEdgeCreation(): void {
    if (!this.graph) return;

    this.logger.info(
      'Edge creation mode is now enabled by default. Simply drag from one node to another to create an edge.',
    );

    // Display a temporary tooltip or notification
    const notification = document.createElement('div');
    notification.textContent = 'Drag from one node to another to create an edge';
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = '#5F95FF';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '4px';
    notification.style.zIndex = '1000';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';

    document.body.appendChild(notification);

    // Remove the notification after 3 seconds
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }
}
