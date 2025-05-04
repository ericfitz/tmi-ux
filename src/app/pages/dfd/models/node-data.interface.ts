/**
 * Interface for node data
 */
export interface NodeData {
  parent?: boolean;
  embedded?: boolean;
  parentId?: string;
  [key: string]: unknown;
}
