import { Node, Edge } from '@antv/x6';

// X6 Native Cell Properties (Partial Copy for Caching)
export interface X6NodeSnapshot {
  id: string;
  shape: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  attrs: Node.Properties['attrs'];
  ports: Node.Properties['ports'];
  zIndex: number;
  visible: boolean;
  type: string; // Added back as a direct property
  metadata: Array<{ key: string; value: string }>;
}

export interface X6EdgeSnapshot {
  id: string;
  shape: string;
  source: Edge.Properties['source'];
  target: Edge.Properties['target'];
  attrs: Edge.Properties['attrs'];
  labels: Edge.Properties['labels'];
  vertices: Array<{ x: number; y: number }>;
  zIndex: number;
  visible: boolean;
  metadata: Array<{ key: string; value: string }>;
}
