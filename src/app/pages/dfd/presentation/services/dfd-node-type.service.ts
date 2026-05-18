import { Injectable } from '@angular/core';
import { NodeType } from '../../domain/value-objects/node-info';

/**
 * Pure node-type mapping and data-asset predicates for the DFD editor.
 * Holds no state — all cell/selection state stays in the component.
 */
@Injectable({ providedIn: 'root' })
export class DfdNodeTypeService {
  /**
   * Map a raw shape string to a known NodeType, defaulting to 'process'
   * for unrecognized values.
   */
  mapStringToNodeType(nodeType: string): NodeType {
    switch (nodeType) {
      case 'actor':
        return 'actor';
      case 'process':
        return 'process';
      case 'store':
        return 'store';
      case 'security-boundary':
        return 'security-boundary';
      case 'text-box':
        return 'text-box';
      default:
        return 'process';
    }
  }
}
