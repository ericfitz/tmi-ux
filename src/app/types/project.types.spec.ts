// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest
import { describe, it, expect } from 'vitest';
import { PROJECT_STATUSES, ProjectStatus, RelatedProject, ProjectPatch } from './project.types';
import { ResponsibleParty, RelationshipType } from './team.types';

describe('Project types', () => {
  it('should export PROJECT_STATUSES with all expected values', () => {
    expect(PROJECT_STATUSES).toEqual([
      'active',
      'planning',
      'on_hold',
      'completed',
      'archived',
      'cancelled',
    ]);
  });

  it('should allow creating a RelatedProject', () => {
    const related: RelatedProject = {
      related_project_id: '550e8400-e29b-41d4-a716-446655440000',
      relationship: 'dependency' as RelationshipType,
    };
    expect(related.related_project_id).toBeDefined();
    expect(related.relationship).toBe('dependency');
  });

  it('should allow creating a ProjectPatch with all optional fields', () => {
    const patch: ProjectPatch = {
      name: 'Updated',
      status: 'active' as ProjectStatus,
      responsible_parties: [] as ResponsibleParty[],
      related_projects: [] as RelatedProject[],
      metadata: [{ key: 'k', value: 'v' }],
    };
    expect(patch.name).toBe('Updated');
  });
});
