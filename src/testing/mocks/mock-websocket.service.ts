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
export class MockWebSocketService {
  private _connected = new BehaviorSubject<boolean>(false);
  private _messages = new Subject<WebSocketMessage>();
  private _connectedUsers = new BehaviorSubject<ConnectedUser[]>([]);
  private _currentUserId = 'current-user-id';
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
   * Get the current user ID
   */
  get currentUserId(): string {
    return this._currentUserId;
  }

  /**
   * Get the current user name
   */
  get currentUserName(): string {
    return this._currentUserName;
  }

  /**
   * Set the current user ID
   */
  set currentUserId(id: string) {
    this._currentUserId = id;
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
  connect(_url: string, _authToken: string): void {
    // Simulate connection
    setTimeout(() => {
      this._connected.next(true);

      // Simulate user joined message
      this.simulateUserJoined(this._currentUserId, this._currentUserName, 'owner');
    }, 100);
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this._connected.next(false);

    // Remove current user from connected users
    const users = this._connectedUsers.value.filter(user => user.id !== this._currentUserId);
    this._connectedUsers.next(users);
  }

  /**
   * Send a message to the WebSocket server
   * @param message The message to send
   */
  send(message: WebSocketMessage): void {
    if (!this._connected.value) {
      console.warn('Cannot send message: not connected');
      return;
    }

    // Add user ID, name, and timestamp if not provided
    const fullMessage: WebSocketMessage = {
      ...message,
      userId: message.userId || this._currentUserId,
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
