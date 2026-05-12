import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';

import { AiArtifactFeedbackService } from './ai-artifact-feedback.service';
import type { ApiService } from './api.service';

describe('AiArtifactFeedbackService', () => {
  let mockApi: { post: ReturnType<typeof vi.fn> };
  let service: AiArtifactFeedbackService;

  beforeEach(() => {
    mockApi = { post: vi.fn().mockReturnValue(of({ id: 'fb-1' })) };
    service = new AiArtifactFeedbackService(mockApi as unknown as ApiService);
  });

  it('POSTs to /threat_models/{tmId}/feedback with basic threat sentiment', () => {
    service
      .submit('tm-1', {
        sentiment: 'up',
        targetType: 'threat',
        targetId: 'threat-1',
      })
      .subscribe();

    expect(mockApi.post).toHaveBeenCalledTimes(1);
    const [endpoint, body] = mockApi.post.mock.calls[0];
    expect(endpoint).toBe('/threat_models/tm-1/feedback');
    expect(body).toMatchObject({
      sentiment: 'up',
      target_type: 'threat',
      target_id: 'threat-1',
      client_id: 'tmi-ux',
    });
  });

  it('includes false_positive_reason and subreason only when sentiment=down on a threat', () => {
    service
      .submit('tm-1', {
        sentiment: 'down',
        targetType: 'threat',
        targetId: 'threat-1',
        falsePositiveReason: 'detection_misfired',
        falsePositiveSubreason: 'code_does_not_exist',
        verbatim: '  context  ',
      })
      .subscribe();

    const [, body] = mockApi.post.mock.calls[0];
    expect(body).toMatchObject({
      sentiment: 'down',
      false_positive_reason: 'detection_misfired',
      false_positive_subreason: 'code_does_not_exist',
      verbatim: 'context',
    });
  });

  it('omits false-positive fields when sentiment is up', () => {
    service
      .submit('tm-1', {
        sentiment: 'up',
        targetType: 'threat',
        targetId: 'threat-1',
        falsePositiveReason: 'detection_misfired',
      })
      .subscribe();
    const [, body] = mockApi.post.mock.calls[0];
    expect('false_positive_reason' in body).toBe(false);
    expect('false_positive_subreason' in body).toBe(false);
  });

  it('omits false-positive fields for non-threat targets', () => {
    service
      .submit('tm-1', {
        sentiment: 'down',
        targetType: 'note',
        targetId: 'note-1',
        falsePositiveReason: 'detection_misfired',
      })
      .subscribe();
    const [, body] = mockApi.post.mock.calls[0];
    expect('false_positive_reason' in body).toBe(false);
  });

  it('passes target_field when provided (threat_classification feedback)', () => {
    service
      .submit('tm-1', {
        sentiment: 'down',
        targetType: 'threat_classification',
        targetId: 'threat-1',
        targetField: 'cwe',
        verbatim: 'wrong cwe',
      })
      .subscribe();
    const [, body] = mockApi.post.mock.calls[0];
    expect(body.target_field).toBe('cwe');
    expect(body.verbatim).toBe('wrong cwe');
  });

  it('omits empty verbatim', () => {
    service
      .submit('tm-1', {
        sentiment: 'up',
        targetType: 'note',
        targetId: 'note-1',
        verbatim: '   ',
      })
      .subscribe();
    const [, body] = mockApi.post.mock.calls[0];
    expect('verbatim' in body).toBe(false);
  });
});
