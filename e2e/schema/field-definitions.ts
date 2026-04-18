import fieldData from './field-definitions.json' with { type: 'json' };

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
export const SURVEY_RESPONSE_FIELDS: FieldDef[] = data.entities.survey_response;
export const SURVEY_TEMPLATE_FIELDS: FieldDef[] = data.entities.survey_template;
export const DASHBOARD_FIELDS: FieldDef[] = data.entities.dashboard;
export const ADMIN_USER_FIELDS: FieldDef[] = data.entities.admin_user;
export const ADMIN_GROUP_FIELDS: FieldDef[] = data.entities.admin_group;
export const ADMIN_QUOTA_FIELDS: FieldDef[] = data.entities.admin_quota;
export const ADMIN_WEBHOOK_FIELDS: FieldDef[] = data.entities.admin_webhook;
export const ADMIN_ADDON_FIELDS: FieldDef[] = data.entities.admin_addon;
export const ADMIN_SETTING_FIELDS: FieldDef[] = data.entities.admin_setting;
