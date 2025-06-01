import { User } from './user';
import { UserPresence, PresenceStatus, UserActivity } from './user-presence';
import { Point } from '../value-objects/point';
import {
  AnyCollaborationEvent,
  UserJoinedSessionEvent,
  UserLeftSessionEvent,
  UserPresenceUpdatedEvent,
  CollaborativeCommandExecutedEvent,
  CommandConflictDetectedEvent,
  CommandConflictResolvedEvent,
  SessionStateSynchronizedEvent,
  UserCursorUpdatedEvent,
  ConflictType,
  ConflictResolution,
} from './collaboration-events';
import { AnyDiagramCommand } from '../commands/diagram-commands';

/**
 * Represents the state of a collaboration session
 */
export enum SessionState {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended',
}

/**
 * Represents a command conflict that needs resolution
 */
export interface CommandConflict {
  id: string;
  conflictingCommand: AnyDiagramCommand;
  existingCommand: AnyDiagramCommand;
  type: ConflictType;
  detectedAt: Date;
  resolvedAt?: Date;
  resolution?: ConflictResolution;
  resolvedBy?: string;
}

/**
 * Aggregate root for collaboration sessions
 */
export class CollaborationSession {
  private readonly _uncommittedEvents: AnyCollaborationEvent[] = [];
  private readonly _participants = new Map<string, UserPresence>();
  private readonly _commandHistory: AnyDiagramCommand[] = [];
  private readonly _conflicts = new Map<string, CommandConflict>();

  constructor(
    public readonly id: string,
    public readonly diagramId: string,
    public readonly createdBy: string,
    public readonly createdAt: Date,
    private _state: SessionState = SessionState.ACTIVE,
    private _lastActivity: Date = new Date(),
    private _version: number = 1,
  ) {
    this._validate();
  }

  // Getters
  get state(): SessionState {
    return this._state;
  }

  get lastActivity(): Date {
    return this._lastActivity;
  }

  get version(): number {
    return this._version;
  }

  get participantCount(): number {
    return this._participants.size;
  }

  get activeParticipantCount(): number {
    return Array.from(this._participants.values()).filter(p => p.isOnline()).length;
  }

  /**
   * Create a new collaboration session
   */
  static create(
    sessionId: string,
    diagramId: string,
    createdBy: string,
    creator: User,
  ): CollaborationSession {
    const session = new CollaborationSession(sessionId, diagramId, createdBy, new Date());

    // Add creator as first participant
    session.addParticipant(creator);

    return session;
  }

  /**
   * Add a participant to the session
   */
  addParticipant(user: User): void {
    if (this._state !== SessionState.ACTIVE) {
      throw new Error('Cannot add participants to inactive session');
    }

    if (this._participants.has(user.id)) {
      throw new Error(`User ${user.id} is already in the session`);
    }

    const presence = UserPresence.createInitial(user);
    this._participants.set(user.id, presence);
    this._updateActivity();

    this._addEvent(new UserJoinedSessionEvent(this.id, user));
  }

  /**
   * Remove a participant from the session
   */
  removeParticipant(userId: string): void {
    if (!this._participants.has(userId)) {
      throw new Error(`User ${userId} is not in the session`);
    }

    this._participants.delete(userId);
    this._updateActivity();

    this._addEvent(new UserLeftSessionEvent(this.id, userId));

    // End session if no participants remain
    if (this._participants.size === 0) {
      this._endSession();
    }
  }

  /**
   * Update user presence
   */
  updateUserPresence(userId: string, presence: UserPresence): void {
    if (!this._participants.has(userId)) {
      throw new Error(`User ${userId} is not in the session`);
    }

    this._participants.set(userId, presence);
    this._updateActivity();

    this._addEvent(new UserPresenceUpdatedEvent(this.id, presence));
  }

  /**
   * Update user cursor position
   */
  updateUserCursor(
    userId: string,
    cursorState: {
      position: { x: number; y: number };
      selectedNodeIds: string[];
      selectedEdgeIds: string[];
      isVisible: boolean;
    },
  ): void {
    const presence = this._participants.get(userId);
    if (!presence) {
      throw new Error(`User ${userId} is not in the session`);
    }

    const updatedPresence = presence.withCursorState({
      position: new Point(cursorState.position.x, cursorState.position.y),
      selectedNodeIds: cursorState.selectedNodeIds,
      selectedEdgeIds: cursorState.selectedEdgeIds,
      isVisible: cursorState.isVisible,
    });

    this._participants.set(userId, updatedPresence);
    this._updateActivity();

    this._addEvent(new UserCursorUpdatedEvent(this.id, userId, cursorState));
  }

  /**
   * Execute a collaborative command
   */
  executeCommand(command: AnyDiagramCommand): void {
    if (this._state !== SessionState.ACTIVE) {
      throw new Error('Cannot execute commands in inactive session');
    }

    // Check for conflicts
    const conflict = this._detectConflict(command);
    if (conflict) {
      this._conflicts.set(conflict.id, conflict);
      this._addEvent(
        new CommandConflictDetectedEvent(
          this.id,
          conflict.conflictingCommand,
          conflict.existingCommand,
          conflict.type,
        ),
      );
      return;
    }

    // Add to command history
    this._commandHistory.push(command);
    this._updateActivity();

    this._addEvent(new CollaborativeCommandExecutedEvent(this.id, command, command.userId));
  }

  /**
   * Resolve a command conflict
   */
  resolveConflict(conflictId: string, resolution: ConflictResolution, resolvedBy: string): void {
    const conflict = this._conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    conflict.resolution = resolution;
    conflict.resolvedBy = resolvedBy;
    conflict.resolvedAt = new Date();

    this._updateActivity();

    this._addEvent(new CommandConflictResolvedEvent(this.id, conflictId, resolution, resolvedBy));

    // Execute the command if resolution is to accept incoming
    if (resolution === ConflictResolution.ACCEPT_INCOMING) {
      this._commandHistory.push(conflict.conflictingCommand);
    }
  }

  /**
   * Pause the session
   */
  pauseSession(): void {
    if (this._state !== SessionState.ACTIVE) {
      throw new Error('Can only pause active sessions');
    }

    this._state = SessionState.PAUSED;
    this._updateActivity();
  }

  /**
   * Resume the session
   */
  resumeSession(): void {
    if (this._state !== SessionState.PAUSED) {
      throw new Error('Can only resume paused sessions');
    }

    this._state = SessionState.ACTIVE;
    this._updateActivity();
  }

  /**
   * End the session
   */
  endSession(): void {
    this._endSession();
  }

  /**
   * Synchronize session state
   */
  synchronizeState(): void {
    this._updateActivity();
    this._addEvent(new SessionStateSynchronizedEvent(this.id, new Date(), this.participantCount));
  }

  /**
   * Get all participants
   */
  getParticipants(): UserPresence[] {
    return Array.from(this._participants.values());
  }

  /**
   * Get active participants
   */
  getActiveParticipants(): UserPresence[] {
    return this.getParticipants().filter(p => p.isOnline());
  }

  /**
   * Get participant by user ID
   */
  getParticipant(userId: string): UserPresence | undefined {
    return this._participants.get(userId);
  }

  /**
   * Get command history
   */
  getCommandHistory(): AnyDiagramCommand[] {
    return [...this._commandHistory];
  }

  /**
   * Get unresolved conflicts
   */
  getUnresolvedConflicts(): CommandConflict[] {
    return Array.from(this._conflicts.values()).filter(c => !c.resolvedAt);
  }

  /**
   * Get uncommitted events
   */
  getUncommittedEvents(): AnyCollaborationEvent[] {
    return [...this._uncommittedEvents];
  }

  /**
   * Mark events as committed
   */
  markEventsAsCommitted(): void {
    this._uncommittedEvents.length = 0;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this._state === SessionState.ACTIVE;
  }

  /**
   * Check if session has been inactive for specified duration
   */
  isInactiveFor(milliseconds: number): boolean {
    return Date.now() - this._lastActivity.getTime() > milliseconds;
  }

  /**
   * Convert to snapshot for serialization
   */
  toSnapshot(): {
    id: string;
    diagramId: string;
    createdBy: string;
    createdAt: string;
    state: SessionState;
    lastActivity: string;
    version: number;
    participants: ReturnType<UserPresence['toJSON']>[];
    commandHistoryCount: number;
    unresolvedConflictCount: number;
  } {
    return {
      id: this.id,
      diagramId: this.diagramId,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      state: this._state,
      lastActivity: this._lastActivity.toISOString(),
      version: this._version,
      participants: this.getParticipants().map(p => p.toJSON()),
      commandHistoryCount: this._commandHistory.length,
      unresolvedConflictCount: this.getUnresolvedConflicts().length,
    };
  }

  /**
   * Detect conflicts between commands
   */
  private _detectConflict(command: AnyDiagramCommand): CommandConflict | null {
    // Simple conflict detection - check for concurrent edits on same resource
    const recentCommands = this._commandHistory
      .filter(c => Date.now() - c.timestamp.getTime() < 5000) // Last 5 seconds
      .filter(c => c.userId !== command.userId); // From different users

    for (const existingCommand of recentCommands) {
      if (this._commandsConflict(command, existingCommand)) {
        return {
          id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          conflictingCommand: command,
          existingCommand,
          type: ConflictType.CONCURRENT_EDIT,
          detectedAt: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Check if two commands conflict
   */
  private _commandsConflict(cmd1: AnyDiagramCommand, cmd2: AnyDiagramCommand): boolean {
    // Check for conflicts on same node
    if (cmd1.type.includes('NODE') && cmd2.type.includes('NODE')) {
      const nodeId1 = (cmd1 as { nodeId: string }).nodeId;
      const nodeId2 = (cmd2 as { nodeId: string }).nodeId;
      return nodeId1 === nodeId2;
    }

    // Check for conflicts on same edge
    if (cmd1.type.includes('EDGE') && cmd2.type.includes('EDGE')) {
      const edgeId1 = (cmd1 as { edgeId: string }).edgeId;
      const edgeId2 = (cmd2 as { edgeId: string }).edgeId;
      return edgeId1 === edgeId2;
    }

    return false;
  }

  /**
   * End the session
   */
  private _endSession(): void {
    this._state = SessionState.ENDED;
    this._updateActivity();
  }

  /**
   * Update last activity timestamp
   */
  private _updateActivity(): void {
    this._lastActivity = new Date();
    this._version++;
  }

  /**
   * Add an event to the uncommitted events list
   */
  private _addEvent(event: AnyCollaborationEvent): void {
    this._uncommittedEvents.push(event);
  }

  /**
   * Validate session data
   */
  private _validate(): void {
    if (!this.id || this.id.trim().length === 0) {
      throw new Error('Session ID is required');
    }

    if (!this.diagramId || this.diagramId.trim().length === 0) {
      throw new Error('Diagram ID is required');
    }

    if (!this.createdBy || this.createdBy.trim().length === 0) {
      throw new Error('Created by user ID is required');
    }

    if (!this.createdAt || isNaN(this.createdAt.getTime())) {
      throw new Error('Valid created at date is required');
    }
  }
}
