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
// SEM@14b8ec771b44f60607221ee931558b5895f47951: service providing CRUD operations for admin system settings via API
export class SettingsAdminService {
  // SEM@14b8ec771b44f60607221ee931558b5895f47951: inject ApiService dependency for HTTP access to the settings API
  constructor(private apiService: ApiService) {}

  /**
   * List all system settings
   */
  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: fetch all system settings from the admin API
  listSettings(): Observable<SystemSetting[]> {
    return this.apiService.get<SystemSetting[]>('/admin/settings');
  }

  /**
   * Get a specific system setting by key
   */
  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: fetch a single system setting by key from the admin API
  getSetting(key: string): Observable<SystemSetting> {
    return this.apiService.get<SystemSetting>(`/admin/settings/${key}`);
  }

  /**
   * Create or update a system setting
   */
  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: store or update a system setting value via the admin API
  updateSetting(key: string, update: Partial<SystemSettingUpdate>): Observable<SystemSetting> {
    return this.apiService.put<SystemSetting>(`/admin/settings/${key}`, update);
  }

  /**
   * Delete a system setting
   */
  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: delete a system setting by key via the admin API
  deleteSetting(key: string): Observable<void> {
    return this.apiService.delete<void>(`/admin/settings/${key}`);
  }
}
