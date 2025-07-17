import { InjectionToken } from '@angular/core';
import { IGraphAdapter } from '../interfaces/graph-adapter.interface';
import { ISerializationService } from '../interfaces/serialization.interface';

/**
 * Injection token for the graph adapter service
 */
export const GRAPH_ADAPTER = new InjectionToken<IGraphAdapter>('GRAPH_ADAPTER');

/**
 * Injection token for the serialization service
 */
export const SERIALIZATION_SERVICE = new InjectionToken<ISerializationService>(
  'SERIALIZATION_SERVICE',
);
