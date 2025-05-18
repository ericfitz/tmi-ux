import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { MOCK_THREAT_MODELS, ThreatModel } from '../models/threat-model.model';

@Injectable({
  providedIn: 'root',
})
export class ThreatModelService {
  private threatModels: ThreatModel[] = [...MOCK_THREAT_MODELS];

  constructor() {}

  /**
   * Get all threat models
   */
  getThreatModels(): Observable<ThreatModel[]> {
    // In a real implementation, this would call the API
    return of(this.threatModels);
  }

  /**
   * Get a threat model by ID
   */
  getThreatModelById(id: string): Observable<ThreatModel | undefined> {
    // In a real implementation, this would call the API
    const threatModel = this.threatModels.find(tm => tm.id === id);
    return of(threatModel);
  }

  /**
   * Create a new threat model
   */
  createThreatModel(
    name: string,
    description?: string,
    framework: 'STRIDE' | 'CIA' | 'LINDDUN' | 'DIE' | 'PLOT4ai' = 'STRIDE',
    issueUrl?: string,
  ): Observable<ThreatModel> {
    // In a real implementation, this would call the API
    const now = new Date().toISOString();
    const currentUser = 'user@example.com'; // Would come from auth service in real implementation

    const newThreatModel: ThreatModel = {
      id: uuidv4(),
      name,
      description,
      created_at: now,
      modified_at: now,
      owner: currentUser,
      created_by: currentUser,
      threat_model_framework: framework,
      issue_url: issueUrl,
      authorization: [
        {
          subject: currentUser,
          role: 'owner',
        },
      ],
      metadata: [],
      diagrams: [],
      threats: [],
    };

    this.threatModels.push(newThreatModel);
    return of(newThreatModel);
  }

  /**
   * Update a threat model
   */
  updateThreatModel(threatModel: ThreatModel): Observable<ThreatModel> {
    // In a real implementation, this would call the API
    const index = this.threatModels.findIndex(tm => tm.id === threatModel.id);
    if (index !== -1) {
      // Update the modified timestamp
      threatModel.modified_at = new Date().toISOString();
      this.threatModels[index] = { ...threatModel };
      return of(this.threatModels[index]);
    }
    return of(threatModel); // Return the original if not found
  }

  /**
   * Delete a threat model
   */
  deleteThreatModel(id: string): Observable<boolean> {
    // In a real implementation, this would call the API
    const initialLength = this.threatModels.length;
    this.threatModels = this.threatModels.filter(tm => tm.id !== id);
    return of(this.threatModels.length < initialLength);
  }
}
