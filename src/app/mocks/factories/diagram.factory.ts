import { v4 as uuidv4 } from 'uuid';
import { Diagram } from '../../pages/tm/models/diagram.model';

/**
 * Creates a mock diagram with default values that can be overridden
 * @param overrides Optional partial Diagram to override default values
 * @returns A complete Diagram object
 */
export function createMockDiagram(overrides?: Partial<Diagram>): Diagram {
  const defaultDiagram: Diagram = {
    id: uuidv4(),
    name: 'Mock Diagram',
    type: 'DFD-1.0.0',
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    update_vector: 1,
    metadata: [],
    cells: [],
  };

  return { ...defaultDiagram, ...overrides };
}
