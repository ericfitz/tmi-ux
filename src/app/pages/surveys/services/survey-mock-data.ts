/**
 * Mock data for survey feature development
 * Will be replaced by API calls when backend is ready
 */

import {
  SurveyTemplate,
  SurveyVersion,
  SurveySubmission,
  SurveyJsonSchema,
} from '@app/types/survey.types';

// ============================================
// Sample Survey JSON Schemas
// ============================================

export const SECURITY_INTAKE_SURVEY: SurveyJsonSchema = {
  title: 'Security Review Intake',
  description: 'Please provide information about your project for security review.',
  showProgressBar: 'top',
  showQuestionNumbers: 'on',
  pages: [
    {
      name: 'project_info',
      title: 'Project Information',
      elements: [
        {
          type: 'text',
          name: 'project_name',
          title: 'Project Name',
          description: 'The name of your project or service',
          isRequired: true,
          mapsToTmField: { path: 'name' },
        },
        {
          type: 'comment',
          name: 'project_description',
          title: 'Project Description',
          description: 'Provide a brief description of what your project does',
          isRequired: true,
          mapsToTmField: { path: 'description' },
        },
        {
          type: 'text',
          name: 'jira_epic',
          title: 'JIRA Epic or Issue URL',
          inputType: 'url',
          placeholder: 'https://jira.example.com/browse/PROJ-123',
          mapsToTmField: { path: 'issue_uri' },
        },
        {
          type: 'dropdown',
          name: 'project_phase',
          title: 'Project Phase',
          isRequired: true,
          choices: [
            { value: 'design', text: 'Design / Planning' },
            { value: 'development', text: 'In Development' },
            { value: 'testing', text: 'Testing / QA' },
            { value: 'production', text: 'Production' },
            { value: 'maintenance', text: 'Maintenance' },
          ],
          mapsToTmField: { path: 'metadata.{key}', metadataKey: 'project_phase' },
        },
      ],
    },
    {
      name: 'team_info',
      title: 'Team Information',
      elements: [
        {
          type: 'text',
          name: 'team_name',
          title: 'Team Name',
          isRequired: true,
          mapsToTmField: { path: 'metadata.{key}', metadataKey: 'team_name' },
        },
        {
          type: 'text',
          name: 'tech_lead_email',
          title: 'Technical Lead Email',
          inputType: 'email',
          isRequired: true,
        },
        {
          type: 'text',
          name: 'product_owner_email',
          title: 'Product Owner Email',
          inputType: 'email',
        },
      ],
    },
    {
      name: 'technical_details',
      title: 'Technical Details',
      elements: [
        {
          type: 'checkbox',
          name: 'data_types',
          title: 'What types of data does your project handle?',
          isRequired: true,
          choices: [
            { value: 'pii', text: 'Personally Identifiable Information (PII)' },
            { value: 'phi', text: 'Protected Health Information (PHI)' },
            { value: 'financial', text: 'Financial / Payment Data' },
            { value: 'credentials', text: 'Credentials / Secrets' },
            { value: 'internal', text: 'Internal Business Data' },
            { value: 'public', text: 'Public Data Only' },
          ],
        },
        {
          type: 'radiogroup',
          name: 'external_facing',
          title: 'Is this project externally accessible?',
          isRequired: true,
          choices: [
            { value: 'yes', text: 'Yes - accessible from the internet' },
            { value: 'partner', text: 'Partner only - accessible to specific partners' },
            { value: 'no', text: 'No - internal only' },
          ],
        },
        {
          type: 'checkbox',
          name: 'auth_methods',
          title: 'What authentication methods are used?',
          choices: [
            { value: 'oauth', text: 'OAuth 2.0 / OIDC' },
            { value: 'saml', text: 'SAML' },
            { value: 'api_key', text: 'API Keys' },
            { value: 'jwt', text: 'JWT Tokens' },
            { value: 'mtls', text: 'Mutual TLS' },
            { value: 'none', text: 'No Authentication' },
          ],
        },
      ],
    },
    {
      name: 'architecture',
      title: 'Architecture',
      elements: [
        {
          type: 'text',
          name: 'repo_url',
          title: 'Source Code Repository URL',
          inputType: 'url',
          mapsToTmField: { path: 'repositories[].uri' },
        },
        {
          type: 'text',
          name: 'architecture_doc',
          title: 'Architecture Documentation URL',
          inputType: 'url',
          mapsToTmField: { path: 'documents[].uri' },
        },
        {
          type: 'comment',
          name: 'architecture_summary',
          title: 'Architecture Summary',
          description: 'Briefly describe the high-level architecture',
        },
        {
          type: 'paneldynamic',
          name: 'components',
          title: 'Key Components',
          description: 'List the main components of your system',
          panelAddText: 'Add Component',
          panelRemoveText: 'Remove',
          minPanelCount: 1,
          maxPanelCount: 10,
          templateElements: [
            {
              type: 'text',
              name: 'component_name',
              title: 'Component Name',
              isRequired: true,
              mapsToTmField: { path: 'assets[].name' },
            },
            {
              type: 'dropdown',
              name: 'component_type',
              title: 'Component Type',
              choices: [
                { value: 'service', text: 'Service / API' },
                { value: 'data', text: 'Database / Data Store' },
                { value: 'infrastructure', text: 'Infrastructure' },
                { value: 'software', text: 'Software / Library' },
              ],
              mapsToTmField: { path: 'assets[].type' },
            },
            {
              type: 'comment',
              name: 'component_description',
              title: 'Description',
              mapsToTmField: { path: 'assets[].description' },
            },
          ],
        },
      ],
    },
    {
      name: 'timeline',
      title: 'Timeline & Priority',
      elements: [
        {
          type: 'text',
          name: 'target_date',
          title: 'Target Launch Date',
          inputType: 'date',
        },
        {
          type: 'radiogroup',
          name: 'urgency',
          title: 'Review Urgency',
          isRequired: true,
          choices: [
            { value: 'critical', text: 'Critical - blocking launch' },
            { value: 'high', text: 'High - needed within 2 weeks' },
            { value: 'normal', text: 'Normal - standard review timeline' },
            { value: 'low', text: 'Low - planning ahead' },
          ],
          mapsToTmField: { path: 'metadata.{key}', metadataKey: 'review_urgency' },
        },
        {
          type: 'comment',
          name: 'additional_notes',
          title: 'Additional Notes',
          description: 'Any other information the security team should know',
        },
      ],
    },
  ],
  showCompletedPage: true,
  completedHtml:
    '<h3>Thank you for submitting your security review request!</h3><p>The security team will review your submission and reach out if they need additional information.</p>',
};

export const QUICK_ASSESSMENT_SURVEY: SurveyJsonSchema = {
  title: 'Quick Security Assessment',
  description: 'A brief assessment for low-risk changes.',
  showProgressBar: 'off',
  pages: [
    {
      name: 'assessment',
      title: 'Quick Assessment',
      elements: [
        {
          type: 'text',
          name: 'change_name',
          title: 'Change Name / Description',
          isRequired: true,
          mapsToTmField: { path: 'name' },
        },
        {
          type: 'radiogroup',
          name: 'change_type',
          title: 'Type of Change',
          isRequired: true,
          choices: [
            { value: 'config', text: 'Configuration Change' },
            { value: 'dependency', text: 'Dependency Update' },
            { value: 'bugfix', text: 'Bug Fix' },
            { value: 'feature', text: 'Minor Feature' },
          ],
        },
        {
          type: 'boolean',
          name: 'handles_sensitive_data',
          title: 'Does this change handle sensitive data?',
          isRequired: true,
        },
        {
          type: 'boolean',
          name: 'changes_auth',
          title: 'Does this change affect authentication or authorization?',
          isRequired: true,
        },
        {
          type: 'boolean',
          name: 'external_exposure',
          title: 'Does this change affect external-facing functionality?',
          isRequired: true,
        },
        {
          type: 'comment',
          name: 'justification',
          title: 'Brief Justification',
          description: 'Why is this considered low-risk?',
          visibleIf:
            '{handles_sensitive_data} = false and {changes_auth} = false and {external_exposure} = false',
        },
      ],
    },
  ],
};

// ============================================
// Mock Templates
// ============================================

export const MOCK_SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'tpl-001',
    name: 'Security Review Intake',
    description: 'Standard intake form for new security review requests',
    status: 'active',
    current_version: 2,
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    created_by: 'admin-user-1',
    modified_by: 'admin-user-1',
  },
  {
    id: 'tpl-002',
    name: 'Quick Security Assessment',
    description: 'Brief assessment for low-risk changes',
    status: 'active',
    current_version: 1,
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    created_by: 'admin-user-1',
    modified_by: 'admin-user-1',
  },
  {
    id: 'tpl-003',
    name: 'Cloud Migration Assessment',
    description: 'Assessment for cloud migration projects (draft)',
    status: 'inactive',
    current_version: 1,
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    created_by: 'admin-user-2',
    modified_by: 'admin-user-2',
  },
];

// ============================================
// Mock Versions
// ============================================

export const MOCK_SURVEY_VERSIONS: SurveyVersion[] = [
  {
    id: 'ver-001-1',
    template_id: 'tpl-001',
    version: 1,
    survey_json: {
      ...SECURITY_INTAKE_SURVEY,
      title: 'Security Review Intake (v1)',
    },
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    created_by: 'admin-user-1',
  },
  {
    id: 'ver-001-2',
    template_id: 'tpl-001',
    version: 2,
    survey_json: SECURITY_INTAKE_SURVEY,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    created_by: 'admin-user-1',
    change_summary: 'Added dynamic panel for components',
  },
  {
    id: 'ver-002-1',
    template_id: 'tpl-002',
    version: 1,
    survey_json: QUICK_ASSESSMENT_SURVEY,
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    created_by: 'admin-user-1',
  },
  {
    id: 'ver-003-1',
    template_id: 'tpl-003',
    version: 1,
    survey_json: {
      title: 'Cloud Migration Assessment',
      description: 'Assessment for cloud migration projects',
      pages: [
        {
          name: 'page1',
          title: 'Cloud Migration Details',
          elements: [
            {
              type: 'text',
              name: 'project_name',
              title: 'Project Name',
              isRequired: true,
            },
          ],
        },
      ],
    },
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    created_by: 'admin-user-2',
  },
];

// ============================================
// Mock Submissions
// ============================================

export const MOCK_SURVEY_SUBMISSIONS: SurveySubmission[] = [
  {
    id: 'sub-001',
    template_id: 'tpl-001',
    template_name: 'Security Review Intake',
    template_version: 2,
    user_id: 'user-alice',
    user_email: 'alice@example.com',
    user_display_name: 'Alice Johnson',
    status: 'submitted',
    data: {
      project_name: 'Payment Gateway v2',
      project_description: 'New payment processing service with enhanced fraud detection',
      jira_epic: 'https://jira.example.com/browse/PAY-100',
      project_phase: 'development',
      team_name: 'Payments Team',
      tech_lead_email: 'alice@example.com',
      data_types: ['financial', 'pii'],
      external_facing: 'yes',
      auth_methods: ['oauth', 'jwt'],
      urgency: 'high',
    },
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    submitted_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'sub-002',
    template_id: 'tpl-001',
    template_name: 'Security Review Intake',
    template_version: 2,
    user_id: 'user-bob',
    user_email: 'bob@example.com',
    user_display_name: 'Bob Smith',
    status: 'in_review',
    data: {
      project_name: 'Customer Portal Redesign',
      project_description: 'Modernizing the customer-facing portal with new UI framework',
      project_phase: 'testing',
      team_name: 'Customer Experience',
      tech_lead_email: 'bob@example.com',
      data_types: ['pii'],
      external_facing: 'yes',
      auth_methods: ['oauth', 'saml'],
      urgency: 'normal',
    },
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    submitted_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    reviewed_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'sub-003',
    template_id: 'tpl-002',
    template_name: 'Quick Security Assessment',
    template_version: 1,
    user_id: 'user-carol',
    user_email: 'carol@example.com',
    user_display_name: 'Carol Williams',
    status: 'pending_triage',
    data: {
      change_name: 'Update logging library to v3.0',
      change_type: 'dependency',
      handles_sensitive_data: false,
      changes_auth: false,
      external_exposure: false,
      justification: 'Security patch for the logging library with no API changes',
    },
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    submitted_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    reviewed_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    threat_model_id: 'tm-existing-123',
  },
  {
    id: 'sub-004',
    template_id: 'tpl-001',
    template_name: 'Security Review Intake',
    template_version: 2,
    user_id: 'user-alice',
    user_email: 'alice@example.com',
    user_display_name: 'Alice Johnson',
    status: 'draft',
    data: {
      project_name: 'Internal Analytics Dashboard',
      project_description: 'Dashboard for viewing internal metrics',
      team_name: 'Payments Team',
    },
    ui_state: {
      currentPageNo: 1,
      isCompleted: false,
    },
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'sub-005',
    template_id: 'tpl-001',
    template_name: 'Security Review Intake',
    template_version: 2,
    user_id: 'user-dan',
    user_email: 'dan@example.com',
    user_display_name: 'Dan Miller',
    status: 'submitted',
    data: {
      project_name: 'API Rate Limiting Service',
      project_description: 'New service to handle API rate limiting across all services',
      project_phase: 'development',
      team_name: 'Platform Team',
      tech_lead_email: 'dan@example.com',
      data_types: ['internal'],
      external_facing: 'no',
      auth_methods: ['mtls', 'jwt'],
      urgency: 'normal',
    },
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    submitted_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];
