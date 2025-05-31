import { InjectionToken } from '@angular/core';
import { IGraphAdapter } from '../interfaces/graph-adapter.interface';
import { IChangeDetectionService } from '../interfaces/change-detection.interface';
import { ISerializationService } from '../interfaces/serialization.interface';

/**
 * Injection token for the graph adapter service
 */
export const GRAPH_ADAPTER = new InjectionToken<IGraphAdapter>('GRAPH_ADAPTER');

/**
 * Injection token for the change detection service
 */
export const CHANGE_DETECTION_SERVICE = new InjectionToken<IChangeDetectionService>(
  'CHANGE_DETECTION_SERVICE',
);

/**
 * Injection token for the serialization service
 */
export const SERIALIZATION_SERVICE = new InjectionToken<ISerializationService>(
  'SERIALIZATION_SERVICE',
);
