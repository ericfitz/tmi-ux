import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  SystemSetting,
  SystemSettingUpdate,
  MigrateSettingsResponse,
} from '@app/types/settings.types';

/**
 * Settings Admin Service
 *
 * Manages system settings through the /admin/settings API.
 * Provides CRUD operations and settings migration functionality.
 */
@Injectable({
  providedIn: 'root',
})
export class SettingsAdminService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List all system settings
   */
  listSettings(): Observable<SystemSetting[]> {
    return this.apiService.get<SystemSetting[]>('/admin/settings');
  }

  /**
   * Get a specific system setting by key
   */
  getSetting(key: string): Observable<SystemSetting> {
    return this.apiService.get<SystemSetting>(`/admin/settings/${key}`);
  }

  /**
   * Create or update a system setting
   */
  updateSetting(key: string, update: Partial<SystemSettingUpdate>): Observable<SystemSetting> {
    return this.apiService.put<SystemSetting>(`/admin/settings/${key}`, update);
  }

  /**
   * Delete a system setting
   */
  deleteSetting(key: string): Observable<void> {
    return this.apiService.delete<void>(`/admin/settings/${key}`);
  }

  /**
   * Migrate settings from server configuration to database
   */
  migrateSettings(overwrite: boolean): Observable<MigrateSettingsResponse> {
    return this.apiService.post<MigrateSettingsResponse>(
      `/admin/settings/migrate${overwrite ? '?overwrite=true' : ''}`,
      {},
    );
  }
}
