import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';

import { UsabilityFeedbackService } from './usability-feedback.service';
import type { ApiService } from './api.service';

describe('UsabilityFeedbackService', () => {
  let mockApi: { post: ReturnType<typeof vi.fn> };
  let service: UsabilityFeedbackService;

  beforeEach(() => {
    mockApi = { post: vi.fn().mockReturnValue(of({ id: 'fb-1' })) };
    service = new UsabilityFeedbackService(mockApi as unknown as ApiService);
  });

  it('posts to /usability_feedback with sentiment, surface, and client metadata', () => {
    service.submit({ sentiment: 'up', surface: 'navbar' }).subscribe();

    expect(mockApi.post).toHaveBeenCalledTimes(1);
    const [endpoint, body] = mockApi.post.mock.calls[0];
    expect(endpoint).toBe('/usability_feedback');
    expect(body).toMatchObject({
      sentiment: 'up',
      surface: 'navbar',
      client_id: 'tmi-ux',
    });
    expect(body.client_version).toBeTruthy();
    expect(body.client_build).toBeTruthy();
    expect(body.viewport).toMatch(/^\d+x\d+$/);
  });

  it('includes trimmed verbatim when provided', () => {
    service.submit({ sentiment: 'down', surface: 'navbar', verbatim: '  hello  ' }).subscribe();
    const [, body] = mockApi.post.mock.calls[0];
    expect(body.verbatim).toBe('hello');
  });

  it('omits verbatim when blank or whitespace-only', () => {
    service.submit({ sentiment: 'up', surface: 'navbar', verbatim: '   ' }).subscribe();
    const [, body] = mockApi.post.mock.calls[0];
    expect('verbatim' in body).toBe(false);
  });

  it('omits verbatim when not provided', () => {
    service.submit({ sentiment: 'up', surface: 'navbar' }).subscribe();
    const [, body] = mockApi.post.mock.calls[0];
    expect('verbatim' in body).toBe(false);
  });
});
