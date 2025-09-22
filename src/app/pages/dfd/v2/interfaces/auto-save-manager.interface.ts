/**
 * Interface for the unified auto-save manager
 */

import { Observable } from 'rxjs';
import {
  AutoSaveTriggerEvent,
  AutoSavePolicy,
  AutoSaveMode,
  AutoSaveState,
  AutoSaveStats,
  AutoSaveEvent,
  AutoSaveConfig,
  AutoSaveContext,
  ChangeAnalyzer,
  SaveDecisionMaker,
  AutoSaveEventHandler
} from '../types/auto-save.types';
import { SaveResult } from '../types/persistence.types';

/**
 * Main interface for the auto-save manager
 * Provides centralized auto-save logic and coordination
 */
export interface IAutoSaveManager {
  // Core auto-save functionality
  trigger(event: AutoSaveTriggerEvent, context: AutoSaveContext): Observable<SaveResult | null>;
  triggerManualSave(context: AutoSaveContext): Observable<SaveResult>;
  
  // Policy management
  setPolicy(policy: AutoSavePolicy): void;
  setPolicyMode(mode: AutoSaveMode): void;
  getPolicy(): AutoSavePolicy;
  
  // State management
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
  getState(): AutoSaveState;
  
  // Configuration
  configure(config: Partial<AutoSaveConfig>): void;
  getConfiguration(): AutoSaveConfig;
  
  // Extensibility
  addAnalyzer(analyzer: ChangeAnalyzer): void;
  removeAnalyzer(analyzer: ChangeAnalyzer): void;
  addDecisionMaker(decisionMaker: SaveDecisionMaker): void;
  removeDecisionMaker(decisionMaker: SaveDecisionMaker): void;
  addEventListener(handler: AutoSaveEventHandler): void;
  removeEventListener(handler: AutoSaveEventHandler): void;
  
  // Observables for monitoring
  readonly state$: Observable<AutoSaveState>;
  readonly events$: Observable<AutoSaveEvent>;
  readonly saveCompleted$: Observable<SaveResult>;
  readonly saveFailed$: Observable<{ error: string; context: AutoSaveContext }>;
  
  // Statistics and monitoring
  getStats(): AutoSaveStats;
  resetStats(): void;
  
  // Control and debugging
  forceSave(context: AutoSaveContext): Observable<SaveResult>;
  cancelPendingSave(): boolean;
  isPendingSave(): boolean;
  getNextScheduledSave(): Date | null;
  
  // Cleanup
  dispose(): void;
}

/**
 * Factory interface for creating auto-save managers
 */
export interface IAutoSaveManagerFactory {
  create(config?: Partial<AutoSaveConfig>): IAutoSaveManager;
  createWithPolicy(policy: AutoSavePolicy): IAutoSaveManager;
  createForMode(mode: AutoSaveMode): IAutoSaveManager;
}