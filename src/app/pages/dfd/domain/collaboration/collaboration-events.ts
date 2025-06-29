import { BaseDomainEvent } from '../events/domain-event';
import { User } from './user';
import { UserPresence } from './user-presence';
import { AnyDiagramCommand } from '../commands/diagram-commands';

/**
 * Event fired when a user joins a collaboration session
 */
export class UserJoinedSessionEvent extends BaseDomainEvent {
  constructor(
    sessionId: string,
    public readonly user: User,
    public readonly joinedAt: Date = new Date(),
  ) {
    super('USER_JOINED_SESSION', sessionId, 1, {
      user: user.toJSON(),
      joinedAt: joinedAt.toISOString(),
    });
  }
}

/**
 * Event fired when a user leaves a collaboration session
 */
export class UserLeftSessionEvent extends BaseDomainEvent {
  constructor(
    sessionId: string,
    public readonly userId: string,
    public readonly leftAt: Date = new Date(),
  ) {
    super('USER_LEFT_SESSION', sessionId, 1, {
      userId,
      leftAt: leftAt.toISOString(),
    });
  }
}

/**
 * Event fired when a user's presence is updated
 */
export class UserPresenceUpdatedEvent extends BaseDomainEvent {
  constructor(
    sessionId: string,
    public readonly presence: UserPresence,
    public readonly updatedAt: Date = new Date(),
  ) {
    super('USER_PRESENCE_UPDATED', sessionId, 1, {
      presence: presence.toJSON(),
      updatedAt: updatedAt.toISOString(),
    });
  }
}

/**
 * Event fired when a collaborative command is executed
 */
export class CollaborativeCommandExecutedEvent extends BaseDomainEvent {
  constructor(
    sessionId: string,
    public readonly command: AnyDiagramCommand,
    public readonly executedBy: string,
    public readonly executedAt: Date = new Date(),
  ) {
    super('COLLABORATIVE_COMMAND_EXECUTED', sessionId, 1, {
      command: {
        type: command.type,
        diagramId: command.diagramId,
        userId: command.userId,
        commandId: command.commandId,
        timestamp: command.timestamp.toISOString(),
      },
      executedBy,
      executedAt: executedAt.toISOString(),
    });
  }
}

/**
 * Event fired when a command conflict is detected
 */
export class CommandConflictDetectedEvent extends BaseDomainEvent {
  constructor(
    sessionId: string,
    public readonly conflictingCommand: AnyDiagramCommand,
    public readonly existingCommand: AnyDiagramCommand,
    public readonly conflictType: ConflictType,
    public readonly detectedAt: Date = new Date(),
  ) {
    super('COMMAND_CONFLICT_DETECTED', sessionId, 1, {
      conflictingCommand: {
        type: conflictingCommand.type,
        commandId: conflictingCommand.commandId,
        userId: conflictingCommand.userId,
      },
      existingCommand: {
        type: existingCommand.type,
        commandId: existingCommand.commandId,
        userId: existingCommand.userId,
      },
      conflictType,
      detectedAt: detectedAt.toISOString(),
    });
  }
}

/**
 * Event fired when a command conflict is resolved
 */
export class CommandConflictResolvedEvent extends BaseDomainEvent {
  constructor(
    sessionId: string,
    public readonly conflictId: string,
    public readonly resolution: ConflictResolution,
    public readonly resolvedBy: string,
    public readonly resolvedAt: Date = new Date(),
  ) {
    super('COMMAND_CONFLICT_RESOLVED', sessionId, 1, {
      conflictId,
      resolution,
      resolvedBy,
      resolvedAt: resolvedAt.toISOString(),
    });
  }
}

/**
 * Event fired when the session state is synchronized
 */
export class SessionStateSynchronizedEvent extends BaseDomainEvent {
  constructor(
    sessionId: string,
    public readonly synchronizedAt: Date = new Date(),
    public readonly participantCount: number = 0,
  ) {
    super('SESSION_STATE_SYNCHRONIZED', sessionId, 1, {
      synchronizedAt: synchronizedAt.toISOString(),
      participantCount,
    });
  }
}

/**
 * Event fired when a user's cursor position is updated
 */
export class UserCursorUpdatedEvent extends BaseDomainEvent {
  constructor(
    sessionId: string,
    public readonly userId: string,
    public readonly cursorState: {
      position: { x: number; y: number };
      selectedNodeIds: string[];
      selectedEdgeIds: string[];
      isVisible: boolean;
    },
    public readonly updatedAt: Date = new Date(),
  ) {
    super('USER_CURSOR_UPDATED', sessionId, 1, {
      userId,
      cursorState,
      updatedAt: updatedAt.toISOString(),
    });
  }
}

/**
 * Types of conflicts that can occur between commands
 */
export enum ConflictType {
  CONCURRENT_EDIT = 'concurrent_edit',
  RESOURCE_LOCK = 'resource_lock',
  DEPENDENCY_VIOLATION = 'dependency_violation',
  STATE_INCONSISTENCY = 'state_inconsistency',
}

/**
 * Types of conflict resolutions
 */
export enum ConflictResolution {
  ACCEPT_INCOMING = 'accept_incoming',
  REJECT_INCOMING = 'reject_incoming',
  MERGE_CHANGES = 'merge_changes',
  MANUAL_RESOLUTION = 'manual_resolution',
}

/**
 * Union type of all collaboration events
 */
export type AnyCollaborationEvent =
  | UserJoinedSessionEvent
  | UserLeftSessionEvent
  | UserPresenceUpdatedEvent
  | CollaborativeCommandExecutedEvent
  | CommandConflictDetectedEvent
  | CommandConflictResolvedEvent
  | SessionStateSynchronizedEvent
  | UserCursorUpdatedEvent;
