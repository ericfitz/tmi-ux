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
    position: isEdge ? undefined : { x: Math.floor(Math.random() * 500), y: Math.floor(Math.random() * 300) },
    size: isEdge ? undefined : { width: 120, height: 60 },
    parent: null,
    source: isEdge ? 'source_id' : undefined,
    target: isEdge ? 'target_id' : undefined,
  };

  return { ...defaultCell, ...overrides };
}
