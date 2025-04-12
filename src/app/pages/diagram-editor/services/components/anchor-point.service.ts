import { Injectable } from '@angular/core';
import { Point } from '@maxgraph/core';

import { LoggerService } from '../../../../core/services/logger.service';
import { AnchorPointPosition } from '../interfaces/diagram-renderer.interface';

/**
 * Service to manage anchor points for vertices
 */
@Injectable({
  providedIn: 'root'
})
export class AnchorPointService {
  // Anchor point markers and positions
  private anchorPositionMap = new Map<string, {x: number, y: number, position: AnchorPointPosition}>();
  private activeAnchorMarkers = new Map<string, any>();
  
  // Cached references
  private graph: any = null;
  private model: any = null;
  
  constructor(private logger: LoggerService) {
    this.logger.info('AnchorPointService initialized');
  }
  
  /**
   * Set the graph instance
   */
  setGraph(graph: any): void {
    this.graph = graph;
    this.model = graph ? graph.getModel() : null;
  }
  
  /**
   * Show anchor points for a vertex
   */
  showVertexAnchorPoints(cellId: string): void {
    if (!this.graph || !cellId) {
      return;
    }
    
    try {
      const cell = this.model.getCell(cellId);
      if (!cell || !this.model.isVertex(cell)) {
        return;
      }
      
      this.logger.debug(`Showing anchor points for vertex: ${cellId}`);
      
      // Hide any existing anchor points first
      this.hideAllAnchorPoints();
      
      // Create anchor points around the vertex
      this.createAnchorPointMarkers(cell);
    } catch (error) {
      this.logger.error(`Error showing anchor points for vertex: ${cellId}`, error);
    }
  }
  
  /**
   * Hide all anchor points
   */
  hideAllAnchorPoints(): void {
    try {
      this.logger.debug('Hiding all anchor points');
      
      // Remove all markers
      this.activeAnchorMarkers.forEach((marker) => {
        if (marker && marker.destroy) {
          marker.destroy();
        }
      });
      
      // Clear collections
      this.activeAnchorMarkers.clear();
      this.anchorPositionMap.clear();
    } catch (error) {
      this.logger.error('Error hiding anchor points', error);
    }
  }
  
  /**
   * Create anchor point markers around a vertex
   */
  private createAnchorPointMarkers(vertex: any): void {
    if (!this.graph || !vertex) {
      return;
    }
    
    try {
      const state = this.graph.view.getState(vertex);
      if (!state) {
        return;
      }
      
      // Get the geometry of the vertex
      const geometry = this.model.getGeometry(vertex);
      if (!geometry) {
        return;
      }
      
      // Define anchor positions
      const positions: AnchorPointPosition[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      
      // Create an anchor point at each position
      for (const position of positions) {
        const coords = this.getAnchorPointCoordinates(position, state);
        if (coords) {
          // Store the position
          this.anchorPositionMap.set(
            `${vertex.id}_${position}`,
            { x: coords.x, y: coords.y, position }
          );
          
          // Create the marker
          const marker = this.createAnchorPointMarker(
            vertex.id,
            position,
            coords.x,
            coords.y
          );
          
          // Store the marker
          this.activeAnchorMarkers.set(`${vertex.id}_${position}`, marker);
        }
      }
      
      this.logger.debug(`Created ${positions.length} anchor points for vertex: ${vertex.id}`);
    } catch (error) {
      this.logger.error('Error creating anchor point markers', error);
    }
  }
  
  /**
   * Create an anchor point marker
   */
  private createAnchorPointMarker(
    vertexId: string,
    position: AnchorPointPosition,
    x: number,
    y: number
  ): any {
    if (!this.graph) {
      return null;
    }
    
    try {
      // Create a marker element
      const marker = document.createElement('div');
      marker.className = 'anchor-point-marker';
      marker.id = `anchor_${vertexId}_${position}`;
      marker.style.position = 'absolute';
      marker.style.width = '8px';
      marker.style.height = '8px';
      marker.style.borderRadius = '50%';
      marker.style.backgroundColor = '#1565c0';
      marker.style.border = '1px solid #ffffff';
      marker.style.left = `${x - 4}px`;
      marker.style.top = `${y - 4}px`;
      marker.style.zIndex = '100';
      marker.setAttribute('data-vertex-id', vertexId);
      marker.setAttribute('data-position', position);
      
      // Add to container
      this.graph.container.appendChild(marker);
      
      // Add marker to the collection to track for cleanup
      const destroy = () => {
        if (marker.parentNode) {
          marker.parentNode.removeChild(marker);
        }
      };
      
      // Store the destroy function
      (marker as any).destroy = destroy;
      
      return marker;
    } catch (error) {
      this.logger.error(`Error creating anchor point marker: ${vertexId}_${position}`, error);
      return null;
    }
  }
  
  /**
   * Get coordinates for an anchor point position
   */
  private getAnchorPointCoordinates(
    position: AnchorPointPosition,
    state: any
  ): { x: number, y: number } | null {
    if (!state) {
      return null;
    }
    
    // Get the bounds
    const x = state.x;
    const y = state.y;
    const width = state.width;
    const height = state.height;
    
    // Calculate position
    switch (position) {
      case 'N':
        return { x: x + width / 2, y };
      case 'NE':
        return { x: x + width, y };
      case 'E':
        return { x: x + width, y: y + height / 2 };
      case 'SE':
        return { x: x + width, y: y + height };
      case 'S':
        return { x: x + width / 2, y: y + height };
      case 'SW':
        return { x, y: y + height };
      case 'W':
        return { x, y: y + height / 2 };
      case 'NW':
        return { x, y };
      case 'C':
        return { x: x + width / 2, y: y + height / 2 };
      default:
        return null;
    }
  }
  
  /**
   * Find the nearest anchor point to coordinates
   */
  findNearestAnchorPoint(x: number, y: number, maxDistance: number = 20): {
    vertexId: string;
    position: AnchorPointPosition;
    x: number;
    y: number;
  } | null {
    try {
      let nearest = null;
      let minDistance = maxDistance;
      
      // Check all anchor points
      for (const [key, anchorInfo] of this.anchorPositionMap.entries()) {
        const dx = anchorInfo.x - x;
        const dy = anchorInfo.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minDistance) {
          minDistance = distance;
          const [vertexId, position] = key.split('_');
          nearest = {
            vertexId,
            position: position as AnchorPointPosition,
            x: anchorInfo.x,
            y: anchorInfo.y
          };
        }
      }
      
      return nearest;
    } catch (error) {
      this.logger.error('Error finding nearest anchor point', error);
      return null;
    }
  }
  
  /**
   * Highlight an anchor point
   */
  highlightAnchorPoint(vertexId: string, position: AnchorPointPosition, highlight: boolean): void {
    try {
      const marker = this.activeAnchorMarkers.get(`${vertexId}_${position}`);
      if (!marker) {
        return;
      }
      
      // Change appearance for highlight
      if (highlight) {
        marker.style.backgroundColor = '#4caf50';
        marker.style.width = '10px';
        marker.style.height = '10px';
        marker.style.left = `${parseInt(marker.style.left) - 1}px`;
        marker.style.top = `${parseInt(marker.style.top) - 1}px`;
      } else {
        marker.style.backgroundColor = '#1565c0';
        marker.style.width = '8px';
        marker.style.height = '8px';
        marker.style.left = `${parseInt(marker.style.left) + 1}px`;
        marker.style.top = `${parseInt(marker.style.top) + 1}px`;
      }
    } catch (error) {
      this.logger.error(`Error highlighting anchor point: ${vertexId}_${position}`, error);
    }
  }
  
  /**
   * Snap an edge to an anchor point
   */
  snapEdgeToAnchor(
    edge: any,
    sourceVertex: any,
    targetVertex: any,
    sourcePosition: AnchorPointPosition,
    targetPosition: AnchorPointPosition
  ): void {
    if (!this.graph || !edge || !sourceVertex || !targetVertex) {
      return;
    }
    
    try {
      // Get states
      const sourceState = this.graph.view.getState(sourceVertex);
      const targetState = this.graph.view.getState(targetVertex);
      
      if (!sourceState || !targetState) {
        return;
      }
      
      // Get source anchor coordinates
      const sourceCoords = this.getAnchorPointCoordinates(sourcePosition, sourceState);
      const targetCoords = this.getAnchorPointCoordinates(targetPosition, targetState);
      
      if (!sourceCoords || !targetCoords) {
        return;
      }
      
      // Set edge terminal points
      this.setEdgeTerminalPoint(edge, sourceCoords.x, sourceCoords.y, true);
      this.setEdgeTerminalPoint(edge, targetCoords.x, targetCoords.y, false);
      
      // Refresh the edge
      this.graph.refresh(edge);
    } catch (error) {
      this.logger.error('Error snapping edge to anchor points', error);
    }
  }
  
  /**
   * Set edge terminal point
   */
  private setEdgeTerminalPoint(edge: any, x: number, y: number, isSource: boolean): void {
    if (!this.graph || !edge) {
      return;
    }
    
    try {
      // Get the geometry
      const geometry = this.model.getGeometry(edge);
      if (!geometry) {
        return;
      }
      
      // Clone the geometry to modify it
      const newGeometry = geometry.clone();
      
      // Create point
      const point = new Point(x, y);
      
      // Set source or target point
      if (isSource) {
        newGeometry.setSourcePoint(point);
      } else {
        newGeometry.setTargetPoint(point);
      }
      
      // Update the model
      this.model.setGeometry(edge, newGeometry);
    } catch (error) {
      this.logger.error('Error setting edge terminal point', error);
    }
  }
}