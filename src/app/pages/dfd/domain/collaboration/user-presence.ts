import { Point } from '../value-objects/point';
import { User } from './user';

/**
 * Represents the presence status of a user
 */
export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  OFFLINE = 'offline',
}

/**
 * Represents user activity in the collaboration session
 */
export enum UserActivity {
  VIEWING = 'viewing',
  EDITING = 'editing',
  SELECTING = 'selecting',
  IDLE = 'idle',
}

/**
 * Represents a user's cursor position and selection
 */
export interface CursorState {
  position: Point;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  isVisible: boolean;
}

/**
 * Represents a user's presence in the collaboration session
 */
export class UserPresence {
  constructor(
    public readonly user: User,
    public readonly status: PresenceStatus,
    public readonly activity: UserActivity,
    public readonly lastSeen: Date,
    public readonly cursorState?: CursorState,
    public readonly currentTool?: string,
  ) {
    this._validate();
  }

  /**
   * Create initial presence for a user joining the session
   */
  static createInitial(user: User): UserPresence {
    return new UserPresence(user, PresenceStatus.ONLINE, UserActivity.VIEWING, new Date());
  }

  /**
   * Update presence status
   */
  withStatus(status: PresenceStatus): UserPresence {
    return new UserPresence(
      this.user,
      status,
      this.activity,
      new Date(),
      this.cursorState,
      this.currentTool,
    );
  }

  /**
   * Update user activity
   */
  withActivity(activity: UserActivity): UserPresence {
    return new UserPresence(
      this.user,
      this.status,
      activity,
      new Date(),
      this.cursorState,
      this.currentTool,
    );
  }

  /**
   * Update cursor state
   */
  withCursorState(cursorState: CursorState): UserPresence {
    return new UserPresence(
      this.user,
      this.status,
      this.activity,
      new Date(),
      cursorState,
      this.currentTool,
    );
  }

  /**
   * Update current tool
   */
  withTool(tool: string): UserPresence {
    return new UserPresence(
      this.user,
      this.status,
      UserActivity.EDITING,
      new Date(),
      this.cursorState,
      tool,
    );
  }

  /**
   * Mark user as away due to inactivity
   */
  markAsAway(): UserPresence {
    return new UserPresence(
      this.user,
      PresenceStatus.AWAY,
      UserActivity.IDLE,
      this.lastSeen,
      this.cursorState,
      this.currentTool,
    );
  }

  /**
   * Mark user as offline
   */
  markAsOffline(): UserPresence {
    return new UserPresence(
      this.user,
      PresenceStatus.OFFLINE,
      UserActivity.IDLE,
      new Date(),
      undefined,
      undefined,
    );
  }

  /**
   * Check if user is actively editing
   */
  isActivelyEditing(): boolean {
    return (
      this.status === PresenceStatus.ONLINE &&
      (this.activity === UserActivity.EDITING || this.activity === UserActivity.SELECTING)
    );
  }

  /**
   * Check if user is online
   */
  isOnline(): boolean {
    return this.status === PresenceStatus.ONLINE;
  }

  /**
   * Check if cursor should be visible
   */
  isCursorVisible(): boolean {
    return (
      this.isOnline() && this.cursorState?.isVisible === true && this.activity !== UserActivity.IDLE
    );
  }

  /**
   * Get time since last activity in milliseconds
   */
  getTimeSinceLastSeen(): number {
    return Date.now() - this.lastSeen.getTime();
  }

  /**
   * Check if user has been inactive for specified duration
   */
  isInactiveFor(milliseconds: number): boolean {
    return this.getTimeSinceLastSeen() > milliseconds;
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): {
    user: ReturnType<User['toJSON']>;
    status: PresenceStatus;
    activity: UserActivity;
    lastSeen: string;
    cursorState?: CursorState;
    currentTool?: string;
  } {
    return {
      user: this.user.toJSON(),
      status: this.status,
      activity: this.activity,
      lastSeen: this.lastSeen.toISOString(),
      cursorState: this.cursorState,
      currentTool: this.currentTool,
    };
  }

  /**
   * Create presence from JSON data
   */
  static fromJSON(data: {
    user: ReturnType<User['toJSON']>;
    status: PresenceStatus;
    activity: UserActivity;
    lastSeen: string;
    cursorState?: CursorState;
    currentTool?: string;
  }): UserPresence {
    return new UserPresence(
      User.fromJSON(data.user),
      data.status,
      data.activity,
      new Date(data.lastSeen),
      data.cursorState,
      data.currentTool,
    );
  }

  /**
   * Validate presence data
   */
  private _validate(): void {
    if (!this.user) {
      throw new Error('User is required for presence');
    }

    if (!Object.values(PresenceStatus).includes(this.status)) {
      throw new Error(`Invalid presence status: ${this.status}`);
    }

    if (!Object.values(UserActivity).includes(this.activity)) {
      throw new Error(`Invalid user activity: ${this.activity}`);
    }

    if (!this.lastSeen || isNaN(this.lastSeen.getTime())) {
      throw new Error('Valid lastSeen date is required');
    }

    if (this.cursorState) {
      if (!this.cursorState.position) {
        throw new Error('Cursor position is required when cursor state is provided');
      }

      if (!Array.isArray(this.cursorState.selectedNodeIds)) {
        throw new Error('Selected node IDs must be an array');
      }

      if (!Array.isArray(this.cursorState.selectedEdgeIds)) {
        throw new Error('Selected edge IDs must be an array');
      }
    }
  }
}
