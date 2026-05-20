import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BrandingConfigService } from './branding-config.service';

/**
 * Service for accessing operator information.
 *
 * Resolves each field by preferring the server's GET /config response
 * (fetched at startup by BrandingConfigService) and falling back to the
 * build-time environment when the server did not provide a value.
 */
@Injectable({
  providedIn: 'root',
})
export class OperatorService {
  constructor(private branding: BrandingConfigService) {}

  getOperatorName(): string {
    return this.resolve('name') ?? environment.operatorName;
  }

  getOperatorContact(): string {
    return this.resolve('contact') ?? environment.operatorContact;
  }

  getOperatorJurisdiction(): string {
    return this.resolve('jurisdiction') ?? environment.operatorJurisdiction;
  }

  hasOperatorInfo(): boolean {
    return Boolean(this.getOperatorName() && this.getOperatorContact());
  }

  /** Returns a non-empty server-provided value, or null if absent/empty. */
  private resolve(field: 'name' | 'contact' | 'jurisdiction'): string | null {
    const value = this.branding.serverOperator?.[field];
    return value && value.trim() ? value : null;
  }
}
