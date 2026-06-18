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
// SEM@3410970da6c2ced5ae2f12b5eaccac4618a73b69: resolve operator identity fields from server config or environment fallback
export class OperatorService {
  // SEM@3410970da6c2ced5ae2f12b5eaccac4618a73b69: inject BrandingConfigService dependency (pure)
  constructor(private branding: BrandingConfigService) {}

  // SEM@3410970da6c2ced5ae2f12b5eaccac4618a73b69: fetch the operator name, preferring server config over environment (pure)
  getOperatorName(): string {
    return this.resolve('name') ?? environment.operatorName;
  }

  // SEM@3410970da6c2ced5ae2f12b5eaccac4618a73b69: fetch the operator contact, preferring server config over environment (pure)
  getOperatorContact(): string {
    return this.resolve('contact') ?? environment.operatorContact;
  }

  // SEM@3410970da6c2ced5ae2f12b5eaccac4618a73b69: fetch the operator jurisdiction, preferring server config over environment (pure)
  getOperatorJurisdiction(): string {
    return this.resolve('jurisdiction') ?? environment.operatorJurisdiction;
  }

  // SEM@3410970da6c2ced5ae2f12b5eaccac4618a73b69: validate that both operator name and contact are available (pure)
  hasOperatorInfo(): boolean {
    return Boolean(this.getOperatorName() && this.getOperatorContact());
  }

  /** Returns a non-empty server-provided value, or null if absent/empty. */
  // SEM@3410970da6c2ced5ae2f12b5eaccac4618a73b69: fetch a non-empty server-provided operator field or return null (pure)
  private resolve(field: 'name' | 'contact' | 'jurisdiction'): string | null {
    const value = this.branding.serverOperator?.[field];
    return value && value.trim() ? value : null;
  }
}
