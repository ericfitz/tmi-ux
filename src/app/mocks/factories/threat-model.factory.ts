import { v4 as uuidv4 } from 'uuid';
import { ThreatModel } from '../../pages/tm/models/threat-model.model';

/**
 * Creates a mock threat model with default values that can be overridden
 * @param overrides Optional partial ThreatModel to override default values
 * @returns A complete ThreatModel object
 */
export function createMockThreatModel(overrides?: Partial<ThreatModel>): ThreatModel {
  const defaultThreatModel: ThreatModel = {
    id: uuidv4(),
    name: 'Mock Threat Model',
    description: 'Auto-generated mock threat model',
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    owner: 'user@example.com',
    created_by: 'user@example.com',
    threat_model_framework: 'STRIDE',
    authorization: [{ subject: 'user@example.com', subject_type: 'user', role: 'owner' }],
    metadata: [],
    diagrams: [],
    threats: [],
  };

  return { ...defaultThreatModel, ...overrides };
}
