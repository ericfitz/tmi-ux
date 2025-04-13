/**
 * Enum representing the possible states of the diagram editor
 */
export enum EditorState {
  /** Editor is not initialized yet */
  UNINITIALIZED = 'uninitialized',

  /** Editor is in the process of initializing */
  INITIALIZING = 'initializing',

  /** Editor is loading a diagram */
  LOADING = 'loading',

  /** Editor is stabilizing after loading */
  STABILIZING = 'stabilizing',

  /** Editor is ready for operations */
  READY = 'ready',

  /** User is editing a label */
  EDITING_LABEL = 'editing_label',

  /** User is in the process of creating an edge */
  CREATING_EDGE = 'creating_edge',

  /** Editor is performing a deletion operation */
  DELETING = 'deleting',

  /** Editor is saving a diagram */
  SAVING = 'saving',

  /** Editor is in an error state */
  ERROR = 'error',

  /** Editor is recovering from an error */
  RECOVERING = 'recovering',
}

/**
 * Interface for state transition definitions
 */
export interface StateTransition {
  /** The current state */
  from: EditorState;

  /** The state to transition to */
  to: EditorState;

  /** Optional description of the transition */
  description?: string;
}

/**
 * Valid state transitions for the diagram editor
 */
export const VALID_TRANSITIONS: StateTransition[] = [
  // Initialization transitions
  {
    from: EditorState.UNINITIALIZED,
    to: EditorState.INITIALIZING,
    description: 'Start initialization',
  },
  { from: EditorState.INITIALIZING, to: EditorState.LOADING, description: 'Start loading diagram' },
  { from: EditorState.INITIALIZING, to: EditorState.READY, description: 'Initialization complete' },
  { from: EditorState.INITIALIZING, to: EditorState.ERROR, description: 'Initialization failed' },

  // Loading transitions
  {
    from: EditorState.LOADING,
    to: EditorState.STABILIZING,
    description: 'Diagram loaded, stabilizing',
  },
  { from: EditorState.LOADING, to: EditorState.ERROR, description: 'Loading failed' },
  { from: EditorState.STABILIZING, to: EditorState.READY, description: 'Diagram stabilized' },
  { from: EditorState.STABILIZING, to: EditorState.ERROR, description: 'Stabilization failed' },

  // Normal operation transitions
  { from: EditorState.READY, to: EditorState.EDITING_LABEL, description: 'Start label editing' },
  { from: EditorState.READY, to: EditorState.CREATING_EDGE, description: 'Start edge creation' },
  { from: EditorState.READY, to: EditorState.DELETING, description: 'Start deletion' },
  { from: EditorState.READY, to: EditorState.SAVING, description: 'Start saving diagram' },
  { from: EditorState.READY, to: EditorState.LOADING, description: 'Start loading new diagram' },

  // Completion transitions
  { from: EditorState.EDITING_LABEL, to: EditorState.READY, description: 'Finish label editing' },
  { from: EditorState.CREATING_EDGE, to: EditorState.READY, description: 'Finish edge creation' },
  { from: EditorState.DELETING, to: EditorState.READY, description: 'Finish deletion' },
  { from: EditorState.SAVING, to: EditorState.READY, description: 'Finish saving' },

  // Error handling transitions
  {
    from: EditorState.EDITING_LABEL,
    to: EditorState.ERROR,
    description: 'Error during label editing',
  },
  {
    from: EditorState.CREATING_EDGE,
    to: EditorState.ERROR,
    description: 'Error during edge creation',
  },
  { from: EditorState.DELETING, to: EditorState.ERROR, description: 'Error during deletion' },
  { from: EditorState.SAVING, to: EditorState.ERROR, description: 'Error during saving' },

  // Recovery transitions
  { from: EditorState.ERROR, to: EditorState.RECOVERING, description: 'Start recovery from error' },
  { from: EditorState.RECOVERING, to: EditorState.READY, description: 'Recovery successful' },
  { from: EditorState.RECOVERING, to: EditorState.ERROR, description: 'Recovery failed' },

  // Reset transitions
  {
    from: EditorState.ERROR,
    to: EditorState.INITIALIZING,
    description: 'Reinitialize after error',
  },
  {
    from: EditorState.READY,
    to: EditorState.INITIALIZING,
    description: 'Reinitialize diagram editor',
  },
];

/**
 * Map of allowed operations for each state
 */
export const ALLOWED_OPERATIONS: Record<EditorState, string[]> = {
  [EditorState.UNINITIALIZED]: ['initialize'],

  [EditorState.INITIALIZING]: [
    'checkInitializationStatus',
    'updateLoadingMessage',
    'updateDiagram',
  ],

  [EditorState.LOADING]: ['updateDiagram', 'updateLoadingMessage'],

  [EditorState.STABILIZING]: ['waitForStabilization', 'updateLoadingMessage'],

  [EditorState.READY]: [
    'createVertex',
    'selectCell',
    'startEdgeCreation',
    'startLabelEditing',
    'deleteCell',
    'saveDiagram',
    'loadDiagram',
    'updateDiagram',
    'highlightCell',
    'toggleGridVisibility',
  ],

  [EditorState.EDITING_LABEL]: ['finishLabelEditing', 'cancelLabelEditing'],

  [EditorState.CREATING_EDGE]: [
    'selectSourceVertex',
    'selectTargetVertex',
    'createEdge',
    'cancelEdgeCreation',
  ],

  [EditorState.DELETING]: ['confirmDeletion', 'cancelDeletion'],

  [EditorState.SAVING]: ['updateLoadingMessage'],

  [EditorState.ERROR]: ['logError', 'startRecovery', 'reinitialize'],

  [EditorState.RECOVERING]: ['updateLoadingMessage', 'checkRecoveryStatus'],
};
