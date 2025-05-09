/**
 * Interface for node data
 */
export interface NodeData {
  [key: string]: unknown;
  parent?: boolean;
  embedded?: boolean;
  parentId?: string;
  label?: string;
  type?: string; // The shape type (actor, process, store, etc.)
  labelPosition?: {
    x: number;
    y: number;
  };
}
