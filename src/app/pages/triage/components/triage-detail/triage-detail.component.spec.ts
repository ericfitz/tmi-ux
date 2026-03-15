// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using: "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { TriageDetailComponent } from './triage-detail.component';
import { SurveyJsonSchema, SurveyResponse } from '@app/types/survey.types';

describe('TriageDetailComponent', () => {
  let component: TriageDetailComponent;

  // Minimal mocks for constructor injection
  const mockRoute = { paramMap: { pipe: vi.fn(() => ({ subscribe: vi.fn() })) } };
  const mockRouter = { navigate: vi.fn() };
  const mockDialog = { open: vi.fn() };
  const mockSnackBar = { open: vi.fn() };
  const mockTransloco = { translate: vi.fn((key: string) => key) };
  const mockResponseService = { getByIdTriage: vi.fn() };
  const mockSurveyService = { getSurveyJson: vi.fn() };
  const mockTriageNoteService = { list: vi.fn() };
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    component = new TriageDetailComponent(
      mockRoute as any,
      mockRouter as any,
      mockDialog as any,
      mockSnackBar as any,
      mockTransloco as any,
      mockResponseService as any,
      mockSurveyService as any,
      mockTriageNoteService as any,
      mockLogger as any,
    );
  });

  describe('formatResponses', () => {
    const makeResponse = (answers: Record<string, unknown>): void => {
      component.response = {
        id: 'resp-1',
        survey_id: 'survey-1',
        survey_version: '1',
        status: 'submitted',
        is_confidential: false,
        answers,
        owner: {
          principal_type: 'user',
          provider: 'test',
          provider_id: 'u1',
          email: 'test@example.com',
        },
        created_at: '2026-01-01T00:00:00Z',
        modified_at: '2026-01-01T00:00:00Z',
      } as SurveyResponse;
    };

    it('should flatten top-level questions into rows', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [
              { type: 'text', name: 'q1', title: 'Project Name' },
              { type: 'text', name: 'q2', title: 'Description' },
            ],
          },
        ],
      };
      makeResponse({ q1: 'Foo', q2: 'Bar' });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses).toEqual([
        { group: '', groupId: '', question: 'Project Name', questionId: 'q1', answer: 'Foo' },
        { group: '', groupId: '', question: 'Description', questionId: 'q2', answer: 'Bar' },
      ]);
    });

    it('should flatten panel child questions into rows with group', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [
              {
                type: 'panel',
                name: 'requester',
                title: 'Requester',
                elements: [
                  { type: 'text', name: 'firstName', title: 'First Name' },
                  { type: 'text', name: 'lastName', title: 'Last Name' },
                ],
              },
            ],
          },
        ],
      };
      // SurveyJS static panels store child answers as flat top-level keys,
      // NOT nested under the panel name.
      makeResponse({ firstName: 'John', lastName: 'Doe' });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses).toEqual([
        {
          group: 'Requester',
          groupId: 'requester',
          question: 'First Name',
          questionId: 'firstName',
          answer: 'John',
        },
        {
          group: 'Requester',
          groupId: 'requester',
          question: 'Last Name',
          questionId: 'lastName',
          answer: 'Doe',
        },
      ]);
    });

    it('should handle array answer values through formatAnswer', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [{ type: 'checkbox', name: 'q1', title: 'Tags' }],
          },
        ],
      };
      makeResponse({ q1: ['a', 'b', 'c'] });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses[0].answer).toBe('a, b, c');
    });

    it('should flatten dynamic panel entries with numbered groups', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [
              {
                type: 'paneldynamic',
                name: 'members',
                title: 'Members',
                templateElements: [
                  { type: 'text', name: 'name', title: 'Name' },
                  { type: 'text', name: 'email', title: 'Email' },
                ],
              },
            ],
          },
        ],
      };
      makeResponse({
        members: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ],
      });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses).toEqual([
        {
          group: 'Members #1',
          groupId: 'members',
          question: 'Name',
          questionId: 'name',
          answer: 'Alice',
        },
        {
          group: 'Members #1',
          groupId: 'members',
          question: 'Email',
          questionId: 'email',
          answer: 'alice@example.com',
        },
        {
          group: 'Members #2',
          groupId: 'members',
          question: 'Name',
          questionId: 'name',
          answer: 'Bob',
        },
        {
          group: 'Members #2',
          groupId: 'members',
          question: 'Email',
          questionId: 'email',
          answer: 'bob@example.com',
        },
      ]);
    });

    it('should handle mixed top-level, panel, and dynamic panel elements', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [
              { type: 'text', name: 'q1', title: 'Project Name' },
              {
                type: 'panel',
                name: 'requester',
                title: 'Requester',
                elements: [{ type: 'text', name: 'email', title: 'Email' }],
              },
              {
                type: 'paneldynamic',
                name: 'members',
                title: 'Members',
                templateElements: [{ type: 'text', name: 'name', title: 'Name' }],
              },
            ],
          },
        ],
      };
      // Panel child answers are flat; dynamic panel answers are nested arrays
      makeResponse({
        q1: 'Foo',
        email: 'jd@example.com',
        members: [{ name: 'Alice' }],
      });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses).toEqual([
        { group: '', groupId: '', question: 'Project Name', questionId: 'q1', answer: 'Foo' },
        {
          group: 'Requester',
          groupId: 'requester',
          question: 'Email',
          questionId: 'email',
          answer: 'jd@example.com',
        },
        {
          group: 'Members #1',
          groupId: 'members',
          question: 'Name',
          questionId: 'name',
          answer: 'Alice',
        },
      ]);
    });

    it('should handle empty answers', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [{ type: 'text', name: 'q1', title: 'Project Name' }],
          },
        ],
      };
      makeResponse({});

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses).toEqual([]);
    });

    it('should handle dynamic panel with empty array answer', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [
              {
                type: 'paneldynamic',
                name: 'members',
                title: 'Members',
                templateElements: [{ type: 'text', name: 'name', title: 'Name' }],
              },
            ],
          },
        ],
      };
      makeResponse({ members: [] });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses).toEqual([]);
    });

    it('should fall back to element.name when title is missing', () => {
      const surveyJson: SurveyJsonSchema = {
        pages: [
          {
            name: 'page1',
            elements: [{ type: 'text', name: 'q1' }],
          },
        ],
      };
      makeResponse({ q1: 'Foo' });

      component['formatResponses'](surveyJson);

      expect(component.formattedResponses[0].question).toBe('q1');
    });
  });

  describe('formatResponsesWithoutDefinition', () => {
    it('should produce 2-column rows with raw keys', () => {
      component.response = {
        id: 'resp-1',
        survey_id: 'survey-1',
        survey_version: '1',
        status: 'submitted',
        is_confidential: false,
        answers: { q1: 'Foo', q2: 'Bar' },
        owner: {
          principal_type: 'user',
          provider: 'test',
          provider_id: 'u1',
          email: 'test@example.com',
        },
        created_at: '2026-01-01T00:00:00Z',
        modified_at: '2026-01-01T00:00:00Z',
      } as SurveyResponse;

      component['formatResponsesWithoutDefinition']();

      expect(component.formattedResponses).toEqual([
        { group: '', groupId: '', question: 'q1', questionId: 'q1', answer: 'Foo' },
        { group: '', groupId: '', question: 'q2', questionId: 'q2', answer: 'Bar' },
      ]);
      expect(component.hasSchema).toBe(false);
    });
  });

  describe('responsesDisplayedColumns', () => {
    it('should include group column when hasSchema is true', () => {
      component.hasSchema = true;
      expect(component.responsesDisplayedColumns).toEqual(['group', 'question', 'answer']);
    });

    it('should exclude group column when hasSchema is false', () => {
      component.hasSchema = false;
      expect(component.responsesDisplayedColumns).toEqual(['question', 'answer']);
    });
  });
});
