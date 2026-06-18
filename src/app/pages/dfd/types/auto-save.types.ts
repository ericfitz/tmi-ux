/**
 * Types for the unified auto-save system
 */

import { SaveResult } from './persistence.types';
import { GraphOperation } from './graph-operation.types';

/**
 * Auto-save trigger types
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: union type of events that can initiate an auto-save (pure)
export type AutoSaveTrigger =
  | 'history-modified'
  | 'metadata-changed'
  | 'threat-changed'
  | 'manual-trigger'
  | 'periodic-save'
  | 'collaboration-sync';

/**
 * Auto-save policy modes
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: union type of auto-save policy aggressiveness modes (pure)
export type AutoSaveMode =
  | 'aggressive' // Save immediately on any change
  | 'normal' // Save after debounce period
  | 'conservative' // Save only on significant changes
  | 'manual' // Disable auto-save
  | 'collaboration'; // Optimized for collaborative editing

/**
 * Auto-save evaluation result
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: union type of outcomes from an auto-save eligibility evaluation (pure)
export type AutoSaveDecision =
  | 'save-immediately'
  | 'save-debounced'
  | 'save-batched'
  | 'skip-insignificant'
  | 'skip-collaboration'
  | 'skip-loading'
  | 'skip-error';

/**
 * Change significance levels
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: union type ranking diagram change importance for save prioritization (pure)
export type ChangeSignificance =
  | 'critical' // Data loss prevention (should always save)
  | 'significant' // Important changes (should save with debounce)
  | 'minor' // Small changes (batch with others)
  | 'cosmetic'; // Visual only (usually skip)

/**
 * Auto-save trigger event
 */
export interface AutoSaveTriggerEvent {
  readonly trigger: AutoSaveTrigger;
  readonly timestamp: Date;
  readonly operation?: GraphOperation;
  readonly metadata?: Record<string, unknown>;
  readonly significance: ChangeSignificance;
}

/**
 * Auto-save policy configuration
 */
export interface AutoSavePolicy {
  readonly mode: AutoSaveMode;
  readonly debounceMs: number;
  readonly maxPendingChanges: number;
  readonly periodicSaveIntervalMs: number;
  readonly enableInCollaboration: boolean;
  readonly enableDuringLoad: boolean;
  readonly significanceThreshold: ChangeSignificance;
  readonly triggers: AutoSaveTrigger[];
  readonly excludeOperationTypes: string[];
  readonly maxRetryAttempts: number;
  readonly retryDelayMs: number;
}

/**
 * Auto-save state information
 */
export interface AutoSaveState {
  readonly enabled: boolean;
  readonly policy: AutoSavePolicy;
  readonly lastSaveTime: Date | null;
  readonly lastSaveResult: SaveResult | null;
  readonly pendingChanges: number;
  readonly isDebouncing: boolean;
  readonly isSaving: boolean;
  readonly consecutiveFailures: number;
  readonly nextScheduledSave: Date | null;
}

/**
 * Auto-save statistics
 */
export interface AutoSaveStats {
  readonly totalTriggers: number;
  readonly triggersProcessed: number;
  readonly triggersSkipped: number;
  readonly savesInitiated: number;
  readonly savesSuccessful: number;
  readonly savesFailed: number;
  readonly averageDebounceTimeMs: number;
  readonly averageSaveTimeMs: number;
  readonly triggersByType: Record<AutoSaveTrigger, number>;
  readonly decisionsByType: Record<AutoSaveDecision, number>;
  readonly lastResetTime: Date;
}

/**
 * Interface for auto-save change analyzers
 */
export interface ChangeAnalyzer {
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: evaluate a trigger event and return its change analysis (pure)
  analyze(event: AutoSaveTriggerEvent): ChangeAnalysis;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate whether this analyzer handles a given trigger type (pure)
  canAnalyze(trigger: AutoSaveTrigger): boolean;
}

/**
 * Result of change analysis
 */
export interface ChangeAnalysis {
  readonly significance: ChangeSignificance;
  readonly decision: AutoSaveDecision;
  readonly reason: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Interface for auto-save decision makers
 */
export interface SaveDecisionMaker {
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: compute the auto-save decision from an event, analysis, and policy (pure)
  decide(
    event: AutoSaveTriggerEvent,
    analysis: ChangeAnalysis,
    policy: AutoSavePolicy,
  ): AutoSaveDecision;
  readonly priority: number;
}

/**
 * Auto-save execution context
 */
export interface AutoSaveContext {
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly isCollaborating: boolean;
  readonly isLoading: boolean;
  readonly userPermissions: string[];
  readonly lastManualSave?: Date;
  readonly collaborationMode?: string;
}

/**
 * Auto-save event types
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: union type of lifecycle event names in the auto-save pipeline (pure)
export type AutoSaveEventType =
  | 'trigger-received'
  | 'analysis-completed'
  | 'decision-made'
  | 'save-started'
  | 'save-completed'
  | 'save-failed'
  | 'save-skipped'
  | 'policy-changed'
  | 'state-updated';

/**
 * Auto-save events
 */
export interface AutoSaveEvent {
  readonly type: AutoSaveEventType;
  readonly timestamp: Date;
  readonly trigger?: AutoSaveTriggerEvent;
  readonly analysis?: ChangeAnalysis;
  readonly decision?: AutoSaveDecision;
  readonly result?: SaveResult;
  readonly error?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Interface for auto-save event handlers
 */
export interface AutoSaveEventHandler {
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: dispatch an auto-save event to this handler for processing
  handle(event: AutoSaveEvent): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate whether this handler processes a given auto-save event type (pure)
  canHandle(eventType: AutoSaveEventType): boolean;
}

/**
 * Configuration for auto-save manager
 */
export interface AutoSaveConfig {
  readonly defaultPolicy: AutoSaveMode;
  readonly enableStatistics: boolean;
  readonly enableEventLogging: boolean;
  readonly maxEventLogSize: number;
  readonly debugMode: boolean;
  readonly customAnalyzers: ChangeAnalyzer[];
  readonly customDecisionMakers: SaveDecisionMaker[];
  readonly eventHandlers: AutoSaveEventHandler[];
}
