import { v4 as uuidv4 } from 'uuid';
import { Threat } from '../../pages/tm/models/threat-model.model';

/**
 * Severity numeric keys (0=Critical, 1=High, 2=Medium, 3=Low, 4=Informational, 5=Unknown)
 */
export type ThreatSeverityKey = '0' | '1' | '2' | '3' | '4' | '5';

/**
 * Common threat types based on STRIDE model
 */
export type ThreatType =
  | 'Spoofing'
  | 'Tampering'
  | 'Repudiation'
  | 'Information Disclosure'
  | 'Denial of Service'
  | 'Elevation of Privilege'
  | 'Authentication Bypass';

/**
 * Creates a mock threat with default values that can be overridden
 * @param overrides Optional partial Threat to override default values
 * @returns A complete Threat object
 */
export function createMockThreat(overrides?: Partial<Threat>): Threat {
  const defaultThreat: Threat = {
    id: uuidv4(),
    threat_model_id: uuidv4(),
    name: 'Mock Threat',
    description: 'Auto-generated mock threat',
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    severity: '2', // Medium
    score: 5.0,
    priority: '2', // Medium (P2)
    mitigated: false,
    status: '0', // Open
    threat_type: 'Information Disclosure',
    metadata: [],
  };

  return { ...defaultThreat, ...overrides };
}

/**
 * Creates a set of mock threats for a threat model
 * @param threatModelId The ID of the threat model
 * @param diagramId Optional diagram ID to associate with the threats
 * @param count Number of threats to create (default: 3)
 * @returns An array of Threat objects
 */
export function createMockThreats(
  threatModelId: string,
  diagramId?: string,
  count: number = 3,
): Threat[] {
  const threats: Threat[] = [];

  // Common threat types and severities for realistic mock data
  const threatTypes: ThreatType[] = [
    'Spoofing',
    'Tampering',
    'Repudiation',
    'Information Disclosure',
    'Denial of Service',
    'Elevation of Privilege',
    'Authentication Bypass',
  ];

  // Severity keys: 0=Critical, 1=High, 2=Medium, 3=Low
  const severities: ThreatSeverityKey[] = ['3', '2', '1', '0'];

  for (let i = 0; i < count; i++) {
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const threatType = threatTypes[Math.floor(Math.random() * threatTypes.length)];

    threats.push(
      createMockThreat({
        id: uuidv4(),
        threat_model_id: threatModelId,
        name: `Mock ${threatType}`,
        description: `Auto-generated mock ${threatType.toLowerCase()} threat`,
        diagram_id: diagramId,
        severity,
        score: getScoreForSeverity(severity),
        priority: severity,
        threat_type: threatType,
      }),
    );
  }

  return threats;
}

/**
 * Gets a numeric score based on the severity level
 * @param severity The severity key (0=Critical, 1=High, 2=Medium, 3=Low, 4=Informational, 5=Unknown)
 * @returns A numeric score between 0 and 10
 */
function getScoreForSeverity(severity: string | null): number {
  switch (severity) {
    case '0': // Critical
      return 9.0 + Math.random();
    case '1': // High
      return 7.0 + Math.random() * 2;
    case '2': // Medium
      return 4.0 + Math.random() * 3;
    case '3': // Low
      return 1.0 + Math.random() * 3;
    case '4': // Informational
      return Math.random();
    default:
      return 5.0;
  }
}
