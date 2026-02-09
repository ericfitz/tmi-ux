/**
 * Settings Type Definitions
 *
 * Types for system settings managed through the /admin/settings API
 */

export type SettingType = 'string' | 'int' | 'bool' | 'json';

/**
 * System setting returned from the API
 */
export interface SystemSetting {
  key: string;
  value: string;
  type: SettingType;
  description?: string;
  modified_at?: string;
  modified_by?: string;
}

/**
 * Request body for creating or updating a system setting
 */
export interface SystemSettingUpdate {
  value: string;
  type: SettingType;
  description?: string;
}

/**
 * Extended system setting with inline editing state
 */
export interface EditableSystemSetting extends SystemSetting {
  editing: boolean;
  saving: boolean;
  editValues?: {
    value: string;
    description: string;
  };
}

/**
 * Response from POST /admin/settings/migrate
 */
export interface MigrateSettingsResponse {
  migrated: number;
  skipped: number;
  settings: SystemSetting[];
}
