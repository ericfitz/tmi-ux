import * as mxgraph from '@maxgraph/core';

/**
 * Utility to serialize the current default styles into a JSON file
 * This is a one-time function to extract the current styles
 */
export function serializeDefaultTheme(): string {
  // Create a temporary container
  const container = document.createElement('div');
  
  // Create a temporary graph to get the default styles
  const graph = new mxgraph.Graph(container);
  
  // Get default vertex style
  const vertexStyle = graph.getStylesheet().getDefaultVertexStyle();
  
  // Configure the vertex style as in DiagramRendererService
  vertexStyle['fillColor'] = '#ffffff';
  vertexStyle['strokeColor'] = '#1565c0';
  vertexStyle['rounded'] = true;
  vertexStyle['shadow'] = true;
  
  // Get default edge style
  const edgeStyle = graph.getStylesheet().getDefaultEdgeStyle();
  
  // Configure the edge style as in DiagramRendererService
  edgeStyle['strokeColor'] = '#78909c';
  edgeStyle['edgeStyle'] = 'orthogonalEdgeStyle';
  edgeStyle['shadow'] = true;
  edgeStyle['rounded'] = true;
  edgeStyle['jettySize'] = 'auto';
  edgeStyle['orthogonalLoop'] = 1;
  
  // Define a highlighted style for vertices
  const highlightedStyle = {};
  Object.assign(highlightedStyle, vertexStyle);
  highlightedStyle['strokeColor'] = '#ff0000';
  highlightedStyle['strokeWidth'] = 3;
  graph.getStylesheet().putCellStyle('highlighted', highlightedStyle);
  
  // Define edge creation mode style
  const edgeCreationStyle = {};
  Object.assign(edgeCreationStyle, vertexStyle);
  edgeCreationStyle['strokeColor'] = '#4caf50';
  edgeCreationStyle['strokeWidth'] = 2;
  edgeCreationStyle['fillColor'] = '#e8f5e9';
  graph.getStylesheet().putCellStyle('edgeCreation', edgeCreationStyle);
  
  // Add process style
  const processStyle = {...vertexStyle};
  processStyle['whiteSpace'] = 'wrap';
  processStyle['html'] = 1;
  processStyle['fillColor'] = '#f5f5f5';
  processStyle['strokeColor'] = '#666666';
  graph.getStylesheet().putCellStyle('process', processStyle);
  
  // Add store style
  const storeStyle = {...vertexStyle};
  storeStyle['shape'] = 'cylinder';
  storeStyle['whiteSpace'] = 'wrap';
  storeStyle['html'] = 1;
  storeStyle['boundedLbl'] = 1;
  storeStyle['fillColor'] = '#dae8fc';
  storeStyle['strokeColor'] = '#6c8ebf';
  graph.getStylesheet().putCellStyle('store', storeStyle);
  
  // Add actor style
  const actorStyle = {...vertexStyle};
  actorStyle['shape'] = 'umlActor';
  actorStyle['verticalLabelPosition'] = 'bottom';
  actorStyle['verticalAlign'] = 'top';
  actorStyle['html'] = 1;
  actorStyle['fillColor'] = '#d5e8d4';
  actorStyle['strokeColor'] = '#82b366';
  graph.getStylesheet().putCellStyle('actor', actorStyle);
  
  // Add flow style for edges
  const flowStyle = {...edgeStyle};
  flowStyle['strokeColor'] = '#4D4D4D';
  flowStyle['endArrow'] = 'classic';
  flowStyle['html'] = 1;
  flowStyle['rounded'] = true;
  flowStyle['edgeStyle'] = 'orthogonalEdgeStyle';
  graph.getStylesheet().putCellStyle('flow', flowStyle);
  
  // Extract styles from the stylesheet
  const styles = graph.getStylesheet().styles;
  
  // Create the theme data object
  const themeData = {
    defaultVertexStyle: vertexStyle,
    defaultEdgeStyle: edgeStyle,
    styles: styles,
    // Additional settings
    gridEnabled: true,
    gridSize: 10,
    backgroundColor: '#ffffff',
    // Marker settings
    marker: {
      validColor: '#00ff00',
      invalidColor: '#ff0000',
      hotspot: 0.3
    }
  };
  
  // Serialize to JSON
  return JSON.stringify(themeData, null, 2);
}