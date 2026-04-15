import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { SystemSetting, SystemSettingUpdate } from '@app/types/settings.types';

/**
 * Settings Admin Service
 *
 * Manages system settings through the /admin/settings API.
 * Provides CRUD operations for system settings.
 */
@Injectable({
  providedIn: 'root',
})
export class SettingsAdminService {
  constructor(private apiService: ApiService) {}

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
}
