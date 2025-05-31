/**
 * Base interface for all domain events
 */
export interface DomainEvent {
  /**
   * Unique identifier for the event
   */
  readonly id: string;

  /**
   * Type of the event
   */
  readonly type: string;

  /**
   * Timestamp when the event occurred
   */
  readonly timestamp: number;

  /**
   * ID of the aggregate that generated this event
   */
  readonly aggregateId: string;

  /**
   * Version of the aggregate when this event was generated
   */
  readonly aggregateVersion: number;

  /**
   * Optional metadata associated with the event
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Base class for domain events
 */
export abstract class BaseDomainEvent implements DomainEvent {
  public readonly id: string;
  public readonly timestamp: number;

  constructor(
    public readonly type: string,
    public readonly aggregateId: string,
    public readonly aggregateVersion: number,
    public readonly metadata?: Record<string, unknown>,
  ) {
    this.id = this.generateEventId();
    this.timestamp = Date.now();
  }

  /**
   * Generates a unique event ID
   */
  private generateEventId(): string {
    return `${this.type}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Converts the event to a plain object for serialization
   */
  toJSON(): {
    id: string;
    type: string;
    timestamp: number;
    aggregateId: string;
    aggregateVersion: number;
    metadata?: Record<string, unknown>;
  } {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      aggregateId: this.aggregateId,
      aggregateVersion: this.aggregateVersion,
      metadata: this.metadata,
    };
  }

  /**
   * Returns a string representation of the event
   */
  toString(): string {
    return `${this.type}(${this.id}, ${this.aggregateId})`;
  }
}
