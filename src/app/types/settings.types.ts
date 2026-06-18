/**
 * Settings Type Definitions
 *
 * Types for system settings managed through the /admin/settings API
 */

// SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: enumerate system setting value types for storage and parsing (pure)
export type SettingType = 'string' | 'int' | 'bool' | 'json';

// SEM@c1b74b47ac4be6cb7de402ea149e6f0131e2acab: enumerate origins from which a system setting value may derive (pure)
export type SettingSource = 'database' | 'config' | 'environment' | 'vault';

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
  source?: SettingSource;
  read_only?: boolean;
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
