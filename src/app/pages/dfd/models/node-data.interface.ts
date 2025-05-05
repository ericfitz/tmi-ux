/**
 * Interface for node data
 */
export interface NodeData {
  [key: string]: unknown;
  parent?: boolean;
  embedded?: boolean;
  parentId?: string;
  label?: string;
  labelPosition?: {
    x: number;
    y: number;
  };
}
