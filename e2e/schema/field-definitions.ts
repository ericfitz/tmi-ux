import fieldData from './field-definitions.json';

export interface FieldDef {
  apiName: string;
  uiSelector: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'toggle' | 'date' | 'chips';
  required: boolean;
  editable: boolean;
  options?: string[];
  validationRules?: string[];
}

interface FieldDefinitions {
  version: string;
  description: string;
  entities: Record<string, FieldDef[]>;
}

const data = fieldData as FieldDefinitions;

export const THREAT_MODEL_FIELDS: FieldDef[] = data.entities.threat_model;
export const THREAT_FIELDS: FieldDef[] = data.entities.threat;
export const ASSET_FIELDS: FieldDef[] = data.entities.asset;
export const DOCUMENT_FIELDS: FieldDef[] = data.entities.document;
export const REPOSITORY_FIELDS: FieldDef[] = data.entities.repository;
export const NOTE_FIELDS: FieldDef[] = data.entities.note;
export const TEAM_FIELDS: FieldDef[] = data.entities.team;
export const PROJECT_FIELDS: FieldDef[] = data.entities.project;
