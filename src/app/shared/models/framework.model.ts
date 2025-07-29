export interface FrameworkThreatType {
  name: string;
  'applies-to': string[];
}

export interface Framework {
  'framework-name': string;
  'threat-types': FrameworkThreatType[];
}

export interface FrameworkModel {
  name: string;
  threatTypes: ThreatTypeModel[];
}

export interface ThreatTypeModel {
  name: string;
  appliesTo: string[];
}
