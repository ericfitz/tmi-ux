import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Interface defining feature flags for the migration process
 */
export interface MigrationFlags {
  useNewGraphAdapter: boolean;
  useNewCommandBus: boolean;
  useNewCollaboration: boolean;
  useNewStateManagement: boolean;
  useNewEventSystem: boolean;
}

/**
 * Default migration flags - all disabled initially for safe rollout
 */
const DEFAULT_FLAGS: MigrationFlags = {
  useNewGraphAdapter: true, // Enable new graph adapter
  useNewCommandBus: true, // Enable new command bus
  useNewCollaboration: false, // Keep collaboration disabled for now
  useNewStateManagement: true, // Enable new state management
  useNewEventSystem: false, // Keep event system disabled for now
};

/**
 * Service to manage feature flags during the migration from legacy to clean architecture
 * Allows gradual rollout of new features with easy rollback capability
 */
@Injectable({
  providedIn: 'root',
})
export class MigrationFlagsService {
  private _flags = new BehaviorSubject<MigrationFlags>(DEFAULT_FLAGS);

  constructor(private logger: LoggerService) {
    this.logger.info('MigrationFlagsService initialized with default flags', DEFAULT_FLAGS);
  }

  /**
   * Get current flags as observable
   */
  get flags$(): Observable<MigrationFlags> {
    return this._flags.asObservable();
  }

  /**
   * Get current flags value
   */
  get flags(): MigrationFlags {
    return this._flags.value;
  }

  /**
   * Check if a specific flag is enabled
   * @param flag The flag to check
   * @returns True if the flag is enabled
   */
  isEnabled(flag: keyof MigrationFlags): boolean {
    return this._flags.value[flag];
  }

  /**
   * Enable a specific migration flag
   * @param flag The flag to enable
   */
  enableFlag(flag: keyof MigrationFlags): void {
    const currentFlags = this._flags.value;
    const newFlags = { ...currentFlags, [flag]: true };
    this._flags.next(newFlags);
    this.logger.info(`Migration flag enabled: ${flag}`, newFlags);
  }

  /**
   * Disable a specific migration flag
   * @param flag The flag to disable
   */
  disableFlag(flag: keyof MigrationFlags): void {
    const currentFlags = this._flags.value;
    const newFlags = { ...currentFlags, [flag]: false };
    this._flags.next(newFlags);
    this.logger.info(`Migration flag disabled: ${flag}`, newFlags);
  }

  /**
   * Enable multiple flags at once
   * @param flags Array of flags to enable
   */
  enableFlags(flags: Array<keyof MigrationFlags>): void {
    const currentFlags = this._flags.value;
    const newFlags = { ...currentFlags };
    flags.forEach(flag => {
      newFlags[flag] = true;
    });
    this._flags.next(newFlags);
    this.logger.info(`Multiple migration flags enabled: ${flags.join(', ')}`, newFlags);
  }

  /**
   * Disable multiple flags at once
   * @param flags Array of flags to disable
   */
  disableFlags(flags: Array<keyof MigrationFlags>): void {
    const currentFlags = this._flags.value;
    const newFlags = { ...currentFlags };
    flags.forEach(flag => {
      newFlags[flag] = false;
    });
    this._flags.next(newFlags);
    this.logger.info(`Multiple migration flags disabled: ${flags.join(', ')}`, newFlags);
  }

  /**
   * Reset all flags to default (disabled) state
   */
  resetFlags(): void {
    this._flags.next(DEFAULT_FLAGS);
    this.logger.info('All migration flags reset to default state', DEFAULT_FLAGS);
  }

  /**
   * Enable all flags (for full migration)
   */
  enableAllFlags(): void {
    const allEnabled: MigrationFlags = {
      useNewGraphAdapter: true,
      useNewCommandBus: true,
      useNewCollaboration: true,
      useNewStateManagement: true,
      useNewEventSystem: true,
    };
    this._flags.next(allEnabled);
    this.logger.info('All migration flags enabled', allEnabled);
  }

  /**
   * Get migration progress as percentage
   * @returns Percentage of flags that are enabled (0-100)
   */
  getMigrationProgress(): number {
    const flags = this._flags.value;
    const totalFlags = Object.keys(flags).length;
    const enabledFlags = Object.values(flags).filter(Boolean).length;
    return Math.round((enabledFlags / totalFlags) * 100);
  }

  /**
   * Check if migration is complete (all flags enabled)
   * @returns True if all flags are enabled
   */
  isMigrationComplete(): boolean {
    const flags = this._flags.value;
    return Object.values(flags).every(Boolean);
  }

  /**
   * Get a summary of current migration state
   * @returns Object with migration statistics
   */
  getMigrationSummary(): {
    progress: number;
    isComplete: boolean;
    enabledFlags: Array<keyof MigrationFlags>;
    disabledFlags: Array<keyof MigrationFlags>;
  } {
    const flags = this._flags.value;
    const enabledFlags = Object.keys(flags).filter(
      key => flags[key as keyof MigrationFlags],
    ) as Array<keyof MigrationFlags>;
    const disabledFlags = Object.keys(flags).filter(
      key => !flags[key as keyof MigrationFlags],
    ) as Array<keyof MigrationFlags>;

    return {
      progress: this.getMigrationProgress(),
      isComplete: this.isMigrationComplete(),
      enabledFlags,
      disabledFlags,
    };
  }
}
