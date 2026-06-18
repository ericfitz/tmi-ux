/**
 * Point value object representing a 2D coordinate
 */
// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: immutable 2D coordinate value object with arithmetic and serialization (pure)
export class Point {
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a validated immutable 2D coordinate from x and y (pure)
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {
    this._validate();
  }

  /**
   * Creates a Point from a plain object
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: deserialize a 2D coordinate from a plain object (pure)
  static fromJSON(data: { x: number; y: number }): Point {
    return new Point(data.x, data.y);
  }

  /**
   * Creates a Point at the origin (0, 0)
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a 2D coordinate at position (0, 0) (pure)
  static origin(): Point {
    return new Point(0, 0);
  }

  /**
   * Creates a new Point with the same coordinates
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a copy of this 2D coordinate (pure)
  clone(): Point {
    return new Point(this.x, this.y);
  }

  /**
   * Adds another point to this point and returns a new Point
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute the vector sum of two 2D coordinates (pure)
  add(other: Point): Point {
    return new Point(this.x + other.x, this.y + other.y);
  }

  /**
   * Subtracts another point from this point and returns a new Point
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute the vector difference of two 2D coordinates (pure)
  subtract(other: Point): Point {
    return new Point(this.x - other.x, this.y - other.y);
  }

  /**
   * Calculates the distance to another point
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute the Euclidean distance between two 2D coordinates (pure)
  distanceTo(other: Point): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Checks if this point equals another point
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compare two 2D coordinates for exact equality (pure)
  equals(other: Point): boolean {
    return this.x === other.x && this.y === other.y;
  }

  /**
   * Returns a string representation of the point
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: format a 2D coordinate as a human-readable string (pure)
  toString(): string {
    return `Point(${this.x}, ${this.y})`;
  }

  /**
   * Converts the point to a plain object
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: serialize a 2D coordinate to a plain object (pure)
  toJSON(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Validates the point coordinates
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate that 2D coordinate values are finite numbers; throw if not (pure)
  private _validate(): void {
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) {
      throw new Error('Point coordinates must be finite numbers');
    }
  }
}
