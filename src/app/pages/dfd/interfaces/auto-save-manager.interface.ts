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
  AutoSaveEventHandler,
} from '../types/auto-save.types';
import { SaveResult } from '../types/persistence.types';

/**
 * Main interface for the auto-save manager
 * Provides centralized auto-save logic and coordination
 */
export interface IAutoSaveManager {
  // Core auto-save functionality
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: dispatch an auto-save trigger event and return the save result
  trigger(event: AutoSaveTriggerEvent, context: AutoSaveContext): Observable<SaveResult | null>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: dispatch a user-initiated save and return the save result
  triggerManualSave(context: AutoSaveContext): Observable<SaveResult>;

  // Policy management
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: update the full auto-save policy (mutates shared state)
  setPolicy(policy: AutoSavePolicy): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: update the auto-save mode without replacing the full policy (mutates shared state)
  setPolicyMode(mode: AutoSaveMode): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch the current auto-save policy (pure)
  getPolicy(): AutoSavePolicy;

  // State management
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: activate auto-save so future triggers are processed (mutates shared state)
  enable(): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: deactivate auto-save so future triggers are suppressed (mutates shared state)
  disable(): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return whether auto-save is currently active (pure)
  isEnabled(): boolean;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch the current auto-save lifecycle state (pure)
  getState(): AutoSaveState;

  // Configuration
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: apply a partial configuration update to the auto-save manager (mutates shared state)
  configure(config: Partial<AutoSaveConfig>): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch the full current auto-save configuration (pure)
  getConfiguration(): AutoSaveConfig;

  // Extensibility
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: register a change analyzer in the auto-save pipeline (mutates shared state)
  addAnalyzer(analyzer: ChangeAnalyzer): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: unregister a change analyzer from the auto-save pipeline (mutates shared state)
  removeAnalyzer(analyzer: ChangeAnalyzer): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: register a save decision maker in the auto-save pipeline (mutates shared state)
  addDecisionMaker(decisionMaker: SaveDecisionMaker): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: unregister a save decision maker from the auto-save pipeline (mutates shared state)
  removeDecisionMaker(decisionMaker: SaveDecisionMaker): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: subscribe a handler to auto-save lifecycle events (mutates shared state)
  addEventListener(handler: AutoSaveEventHandler): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: unsubscribe a handler from auto-save lifecycle events (mutates shared state)
  removeEventListener(handler: AutoSaveEventHandler): void;

  // Observables for monitoring
  readonly state$: Observable<AutoSaveState>;
  readonly events$: Observable<AutoSaveEvent>;
  readonly saveCompleted$: Observable<SaveResult>;
  readonly saveFailed$: Observable<{ error: string; context: AutoSaveContext }>;

  // Statistics and monitoring
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch accumulated auto-save statistics counters (pure)
  getStats(): AutoSaveStats;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: clear all accumulated auto-save statistics counters (mutates shared state)
  resetStats(): void;

  // Control and debugging
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: bypass policy and immediately persist the diagram, returning save result
  forceSave(context: AutoSaveContext): Observable<SaveResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: abort a scheduled pending save before it executes (mutates shared state)
  cancelPendingSave(): boolean;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return whether a save is currently queued (pure)
  isPendingSave(): boolean;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return the date of the next scheduled auto-save, or null (pure)
  getNextScheduledSave(): Date | null;

  // Cleanup
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: release all auto-save manager resources and timers (mutates shared state)
  dispose(): void;
}
