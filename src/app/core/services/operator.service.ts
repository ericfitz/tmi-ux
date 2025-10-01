import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Service for accessing operator information from environment
 */
@Injectable({
  providedIn: 'root',
})
export class OperatorService {
  /**
   * Get the name of the operator/entity that hosts this TMI instance
   */
  getOperatorName(): string {
    return environment.operatorName;
  }

  /**
   * Get the contact information for the operator of this TMI instance
   */
  getOperatorContact(): string {
    return environment.operatorContact;
  }

  /**
   * Get the jurisdiction information for the operator of this TMI instance
   */
  getOperatorJurisdiction(): string {
    return environment.operatorJurisdiction;
  }

  /**
   * Check if operator information is configured (non-empty)
   */
  hasOperatorInfo(): boolean {
    return Boolean(environment.operatorName && environment.operatorContact);
  }
}
