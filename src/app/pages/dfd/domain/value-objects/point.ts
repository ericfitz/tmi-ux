/**
 * Point value object representing a 2D coordinate
 */
export class Point {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {
    this.validate();
  }

  /**
   * Creates a Point from a plain object
   */
  static fromJSON(data: { x: number; y: number }): Point {
    return new Point(data.x, data.y);
  }

  /**
   * Creates a Point at the origin (0, 0)
   */
  static origin(): Point {
    return new Point(0, 0);
  }

  /**
   * Creates a new Point with the same coordinates
   */
  clone(): Point {
    return new Point(this.x, this.y);
  }

  /**
   * Adds another point to this point and returns a new Point
   */
  add(other: Point): Point {
    return new Point(this.x + other.x, this.y + other.y);
  }

  /**
   * Subtracts another point from this point and returns a new Point
   */
  subtract(other: Point): Point {
    return new Point(this.x - other.x, this.y - other.y);
  }

  /**
   * Calculates the distance to another point
   */
  distanceTo(other: Point): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Checks if this point equals another point
   */
  equals(other: Point): boolean {
    return this.x === other.x && this.y === other.y;
  }

  /**
   * Returns a string representation of the point
   */
  toString(): string {
    return `Point(${this.x}, ${this.y})`;
  }

  /**
   * Converts the point to a plain object
   */
  toJSON(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Validates the point coordinates
   */
  private validate(): void {
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) {
      throw new Error('Point coordinates must be finite numbers');
    }
  }
}
