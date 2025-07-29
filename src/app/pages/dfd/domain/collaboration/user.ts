/**
 * User Domain Model
 *
 * This file defines the User domain model for collaborative DFD editing.
 * It represents a user entity with identity, visual properties, and validation.
 *
 * Key functionality:
 * - Defines User entity with ID, name, email, avatar, and color properties
 * - Provides factory methods for user creation with generated colors
 * - Supports JSON serialization and deserialization for API communication
 * - Generates consistent user colors based on user ID hash
 * - Provides user initials calculation for avatar display
 * - Includes comprehensive validation for required fields and email format
 * - Supports equality comparison between user instances
 * - Immutable design with readonly properties for data integrity
 * - Color palette specifically chosen for good contrast and visibility
 * - Integrates with collaboration presence system
 */

/**
 * Represents a user in the collaboration system
 */
export class User {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly avatar?: string,
    public readonly color?: string,
  ) {
    this._validate();
  }

  /**
   * Create a user with a generated color
   */
  static create(id: string, name: string, email: string, avatar?: string): User {
    const color = this._generateUserColor(id);
    return new User(id, name, email, avatar, color);
  }

  /**
   * Create user from JSON data
   */
  static fromJSON(data: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    color?: string;
  }): User {
    return new User(data.id, data.name, data.email, data.avatar, data.color);
  }

  /**
   * Generate a consistent color for a user based on their ID
   */
  private static _generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
      '#98D8C8',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1E9',
      '#F8C471',
      '#82E0AA',
      '#F1948A',
      '#85C1E9',
      '#D7BDE2',
    ];

    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  /**
   * Check if this user equals another user
   */
  equals(other: User): boolean {
    return this.id === other.id;
  }

  /**
   * Get user initials for display
   */
  getInitials(): string {
    return this.name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    color?: string;
  } {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      avatar: this.avatar,
      color: this.color,
    };
  }

  /**
   * Validate user data
   */
  private _validate(): void {
    if (!this.id || this.id.trim().length === 0) {
      throw new Error('User ID is required');
    }

    if (!this.name || this.name.trim().length === 0) {
      throw new Error('User name is required');
    }

    if (!this.email || this.email.trim().length === 0) {
      throw new Error('User email is required');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      throw new Error('Invalid email format');
    }
  }
}
