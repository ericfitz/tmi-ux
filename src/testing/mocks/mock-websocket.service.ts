/**
 * Mock WebSocket service for testing collaborative features
 */

import { BehaviorSubject, Observable, Subject } from 'rxjs';

/**
 * Interface for WebSocket messages
 */
export interface WebSocketMessage {
  type: string;
  data: unknown;
  userId?: string;
  userName?: string;
  timestamp?: number;
}

/**
 * Interface for connected user information
 */
export interface ConnectedUser {
  id: string;
  name: string;
  role: 'owner' | 'writer' | 'reader';
  lastActivity: number;
}

/**
 * Mock implementation of a WebSocket service for testing collaborative features
 */
// SEM@4de8eeb93111afab18f841a678c535ce9e7011dd: test double for WebSocketService simulating connection, messaging, and user presence
export class MockWebSocketService {
  private _connected = new BehaviorSubject<boolean>(false);
  private _messages = new Subject<WebSocketMessage>();
  private _connectedUsers = new BehaviorSubject<ConnectedUser[]>([]);
  private _currentProviderId = 'current-user-id';
  private _currentUserName = 'Current User';

  /**
   * Get the connection status as an observable
   */
  get connected$(): Observable<boolean> {
    return this._connected.asObservable();
  }

  /**
   * Get the messages as an observable
   */
  get messages$(): Observable<WebSocketMessage> {
    return this._messages.asObservable();
  }

  /**
   * Get the connected users as an observable
   */
  get connectedUsers$(): Observable<ConnectedUser[]> {
    return this._connectedUsers.asObservable();
  }

  /**
   * Get the current provider ID
   */
  get currentProviderId(): string {
    return this._currentProviderId;
  }

  /**
   * Get the current user name
   */
  get currentUserName(): string {
    return this._currentUserName;
  }

  /**
   * Set the current provider ID
   */
  set currentProviderId(id: string) {
    this._currentProviderId = id;
  }

  /**
   * Set the current user name
   */
  set currentUserName(name: string) {
    this._currentUserName = name;
  }

  /**
   * Connect to the WebSocket server
   * @param url The URL to connect to
   * @param authToken The authentication token
   */
  // SEM@4de8eeb93111afab18f841a678c535ce9e7011dd: simulate a WebSocket connection and emit the current user joined event (mutates shared state)
  connect(_url: string, _authToken: string): void {
    // Simulate connection
    setTimeout(() => {
      this._connected.next(true);

      // Simulate user joined message
      this.simulateUserJoined(this._currentProviderId, this._currentUserName, 'owner');
    }, 100);
  }

  /**
   * Disconnect from the WebSocket server
   */
  // SEM@4de8eeb93111afab18f841a678c535ce9e7011dd: simulate a WebSocket disconnection and remove the current user from the session (mutates shared state)
  disconnect(): void {
    this._connected.next(false);

    // Remove current user from connected users
    const users = this._connectedUsers.value.filter(user => user.id !== this._currentProviderId);
    this._connectedUsers.next(users);
  }

  /**
   * Send a message to the WebSocket server
   * @param message The message to send
   */
  // SEM@4de8eeb93111afab18f841a678c535ce9e7011dd: dispatch a WebSocket message, echoing it back after a short delay if connected (mutates shared state)
  send(message: WebSocketMessage): void {
    if (!this._connected.value) {
      console.warn('Cannot send message: not connected');
      return;
    }

    // Add user ID, name, and timestamp if not provided
    const fullMessage: WebSocketMessage = {
      ...message,
      userId: message.userId || this._currentProviderId,
      userName: message.userName || this._currentUserName,
      timestamp: message.timestamp || Date.now(),
    };

    // Echo the message back (simulating server response)
    setTimeout(() => {
      this._messages.next(fullMessage);
    }, 50);
  }

  /**
   * Simulate receiving a message from another user
   * @param message The message to simulate
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: inject a test WebSocket message as if received from a remote user (mutates shared state)
  simulateIncomingMessage(message: WebSocketMessage): void {
    // Ensure the message has a user ID, name, and timestamp
    const fullMessage: WebSocketMessage = {
      ...message,
      userId: message.userId || 'other-user-id',
      userName: message.userName || 'Other User',
      timestamp: message.timestamp || Date.now(),
    };

    this._messages.next(fullMessage);
  }

  /**
   * Simulate a user joining the collaboration
   * @param userId The ID of the user
   * @param userName The name of the user
   * @param role The role of the user
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: add a user to the connected-user list and emit a userJoined message (mutates shared state)
  simulateUserJoined(userId: string, userName: string, role: 'owner' | 'writer' | 'reader'): void {
    // Add user to connected users
    const users = [...this._connectedUsers.value];
    const existingUserIndex = users.findIndex(user => user.id === userId);

    if (existingUserIndex >= 0) {
      // Update existing user
      users[existingUserIndex] = {
        id: userId,
        name: userName,
        role,
        lastActivity: Date.now(),
      };
    } else {
      // Add new user
      users.push({
        id: userId,
        name: userName,
        role,
        lastActivity: Date.now(),
      });
    }

    this._connectedUsers.next(users);

    // Send user joined message
    this._messages.next({
      type: 'userJoined',
      data: {
        userId,
        userName,
        role,
      },
      userId,
      userName,
      timestamp: Date.now(),
    });
  }

  /**
   * Simulate a user leaving the collaboration
   * @param userId The ID of the user
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: remove a user from the connected-user list and emit a userLeft message (mutates shared state)
  simulateUserLeft(userId: string): void {
    // Remove user from connected users
    const users = this._connectedUsers.value.filter(user => user.id !== userId);
    this._connectedUsers.next(users);

    // Get user name
    const user = this._connectedUsers.value.find(user => user.id === userId);
    const userName = user ? user.name : 'Unknown User';

    // Send user left message
    this._messages.next({
      type: 'userLeft',
      data: {
        userId,
        userName,
      },
      userId,
      userName,
      timestamp: Date.now(),
    });
  }
}
