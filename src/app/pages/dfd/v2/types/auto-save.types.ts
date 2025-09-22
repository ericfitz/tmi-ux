/**
 * Types for the unified auto-save system
 */

import { SaveResult } from './persistence.types';
import { GraphOperation } from './graph-operation.types';

/**
 * Auto-save trigger types
 */
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
export type AutoSaveMode = 
  | 'aggressive'     // Save immediately on any change
  | 'normal'         // Save after debounce period
  | 'conservative'   // Save only on significant changes
  | 'manual'         // Disable auto-save
  | 'collaboration'; // Optimized for collaborative editing

/**
 * Auto-save evaluation result
 */
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
export type ChangeSignificance = 
  | 'critical'      // Data loss prevention (should always save)
  | 'significant'   // Important changes (should save with debounce)
  | 'minor'         // Small changes (batch with others)
  | 'cosmetic';     // Visual only (usually skip)

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
 * Default auto-save policies for different modes
 */
export const AUTO_SAVE_POLICIES: Record<AutoSaveMode, AutoSavePolicy> = {
  aggressive: {
    mode: 'aggressive',
    debounceMs: 100,
    maxPendingChanges: 1,
    periodicSaveIntervalMs: 10000,
    enableInCollaboration: false,
    enableDuringLoad: false,
    significanceThreshold: 'cosmetic',
    triggers: ['history-modified', 'metadata-changed', 'threat-changed'],
    excludeOperationTypes: [],
    maxRetryAttempts: 3,
    retryDelayMs: 1000,
  },
  normal: {
    mode: 'normal',
    debounceMs: 1000,
    maxPendingChanges: 5,
    periodicSaveIntervalMs: 30000,
    enableInCollaboration: false,
    enableDuringLoad: false,
    significanceThreshold: 'minor',
    triggers: ['history-modified', 'metadata-changed', 'threat-changed'],
    excludeOperationTypes: ['load-diagram'],
    maxRetryAttempts: 3,
    retryDelayMs: 2000,
  },
  conservative: {
    mode: 'conservative',
    debounceMs: 3000,
    maxPendingChanges: 10,
    periodicSaveIntervalMs: 60000,
    enableInCollaboration: false,
    enableDuringLoad: false,
    significanceThreshold: 'significant',
    triggers: ['history-modified', 'metadata-changed', 'threat-changed'],
    excludeOperationTypes: ['load-diagram'],
    maxRetryAttempts: 2,
    retryDelayMs: 5000,
  },
  manual: {
    mode: 'manual',
    debounceMs: 0,
    maxPendingChanges: 0,
    periodicSaveIntervalMs: 0,
    enableInCollaboration: false,
    enableDuringLoad: false,
    significanceThreshold: 'critical',
    triggers: ['manual-trigger'],
    excludeOperationTypes: ['history-modified', 'metadata-changed'],
    maxRetryAttempts: 1,
    retryDelayMs: 0,
  },
  collaboration: {
    mode: 'collaboration',
    debounceMs: 500,
    maxPendingChanges: 3,
    periodicSaveIntervalMs: 120000,
    enableInCollaboration: true,
    enableDuringLoad: false,
    significanceThreshold: 'significant',
    triggers: ['periodic-save', 'collaboration-sync'],
    excludeOperationTypes: ['history-modified', 'load-diagram'],
    maxRetryAttempts: 2,
    retryDelayMs: 3000,
  },
};

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
  analyze(event: AutoSaveTriggerEvent): ChangeAnalysis;
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
  decide(event: AutoSaveTriggerEvent, analysis: ChangeAnalysis, policy: AutoSavePolicy): AutoSaveDecision;
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
  handle(event: AutoSaveEvent): void;
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

/**
 * Default auto-save configuration
 */
export const DEFAULT_AUTO_SAVE_CONFIG: AutoSaveConfig = {
  defaultPolicy: 'normal',
  enableStatistics: true,
  enableEventLogging: true,
  maxEventLogSize: 1000,
  debugMode: false,
  customAnalyzers: [],
  customDecisionMakers: [],
  eventHandlers: [],
};