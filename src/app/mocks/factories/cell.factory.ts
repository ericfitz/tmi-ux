import { v4 as uuidv4 } from 'uuid';
import { Cell } from '../../pages/tm/models/diagram.model';

/**
 * Cell types supported by the factory
 */
export type CellType = 'process' | 'store' | 'actor' | 'edge' | 'textbox' | 'security-boundary';

/**
 * Creates a mock cell with default values that can be overridden
 * @param type The type of cell to create (process, store, actor, edge, etc.)
 * @param overrides Optional partial Cell to override default values
 * @returns A complete Cell object
 */
export function createMockCell(type: CellType = 'process', overrides?: Partial<Cell>): Cell {
  const id = overrides?.id || uuidv4();
  const isEdge = type === 'edge';

  const defaultCell: Cell = {
    id,
    shape: type,
    value: isEdge ? '' : `Mock ${type.charAt(0).toUpperCase() + type.slice(1)}`,
    geometry: isEdge
      ? undefined
      : {
          x: Math.floor(Math.random() * 500),
          y: Math.floor(Math.random() * 300),
          width: 120,
          height: 60,
        },
    style: getStyleForType(type),
    vertex: !isEdge,
    edge: isEdge,
    parent: null,
    source: isEdge ? 'source_id' : undefined,
    target: isEdge ? 'target_id' : undefined,
  };

  return { ...defaultCell, ...overrides };
}

/**
 * Gets the appropriate style string for a given cell type
 * @param type The type of cell
 * @returns A style string for the cell type
 */
function getStyleForType(type: CellType): string {
  switch (type) {
    case 'process':
      return 'shape=process;whiteSpace=wrap;html=1;';
    case 'store':
      return 'shape=cylinder;whiteSpace=wrap;html=1;';
    case 'actor':
      return 'shape=actor;whiteSpace=wrap;html=1;';
    case 'edge':
      return 'endArrow=classic;html=1;';
    case 'textbox':
      return 'text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;';
    case 'security-boundary':
      return 'shape=rectangle;whiteSpace=wrap;html=1;dashed=1;dashPattern=8 4;strokeWidth=2;';
    default:
      return 'whiteSpace=wrap;html=1;';
  }
}
