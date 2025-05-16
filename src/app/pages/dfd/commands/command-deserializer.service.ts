import { Injectable } from '@angular/core';
import { Command } from './command.interface';

/**
 * Type definition for command deserializer functions
 */
export type CommandDeserializer = (data: Record<string, unknown>) => Command;

/**
 * Service for deserializing commands from JSON strings
 */
@Injectable({
  providedIn: 'root',
})
export class CommandDeserializerService {
  private deserializers = new Map<string, CommandDeserializer>();

  /**
   * Register a deserializer for a specific command type
   * @param type The command type identifier
   * @param deserializer The function to deserialize the command
   */
  registerDeserializer(type: string, deserializer: CommandDeserializer): void {
    this.deserializers.set(type, deserializer);
  }

  /**
   * Deserialize a JSON string into a Command object
   * @param json The JSON string to deserialize
   * @returns The deserialized Command object
   * @throws Error if the command type is not registered or the JSON is invalid
   */
  deserialize(json: string): Command {
    try {
      const parsed = JSON.parse(json);

      if (!parsed.type || typeof parsed.type !== 'string') {
        throw new Error('Invalid command format: missing or invalid type');
      }

      const deserializer = this.deserializers.get(parsed.type);
      if (!deserializer) {
        throw new Error(`No deserializer registered for command type: ${parsed.type}`);
      }

      const command = deserializer(parsed.data);

      // Set the command origin if it exists in the serialized data
      if (parsed.origin && (parsed.origin === 'local' || parsed.origin === 'remote')) {
        command.origin = parsed.origin;
      }

      return command;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to deserialize command: ${error.message}`);
      }
      throw new Error('Failed to deserialize command: unknown error');
    }
  }

  /**
   * Check if a deserializer is registered for a specific command type
   * @param type The command type identifier
   * @returns True if a deserializer is registered, false otherwise
   */
  hasDeserializer(type: string): boolean {
    return this.deserializers.has(type);
  }

  /**
   * Get all registered command types
   * @returns Array of registered command types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.deserializers.keys());
  }
}
