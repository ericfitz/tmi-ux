import { describe, it, expect } from 'vitest';

import {
  buildCurlSnippet,
  buildPowerShellSnippet,
  buildRawSnippet,
  extractShareWithApplicationParams,
  prettyJsonOrVerbatim,
  type ShareWithApplicationParams,
} from './share-with-application-remediation.util';

const VALID_PARAMS: ShareWithApplicationParams = {
  drive_id: 'b!abc',
  item_id: '01XYZ',
  app_object_id: 'app-guid',
  graph_call: 'POST https://graph.microsoft.com/v1.0/drives/b!abc/items/01XYZ/permissions',
  graph_body:
    '{"roles":["read"],"grantedToIdentities":[{"application":{"id":"app-guid","displayName":"TMI"}}]}',
};

describe('extractShareWithApplicationParams', () => {
  it('returns the typed object when all fields are present', () => {
    expect(extractShareWithApplicationParams({ ...VALID_PARAMS })).toEqual(VALID_PARAMS);
  });

  it.each([['drive_id'], ['item_id'], ['app_object_id'], ['graph_call'], ['graph_body']])(
    'returns null when %s is missing',
    field => {
      const params: Record<string, unknown> = { ...VALID_PARAMS };
      delete params[field];
      expect(extractShareWithApplicationParams(params)).toBeNull();
    },
  );

  it.each([['drive_id'], ['item_id'], ['app_object_id'], ['graph_call'], ['graph_body']])(
    'returns null when %s is empty string',
    field => {
      const params: Record<string, unknown> = { ...VALID_PARAMS, [field]: '' };
      expect(extractShareWithApplicationParams(params)).toBeNull();
    },
  );

  it('returns null when a field is non-string', () => {
    expect(extractShareWithApplicationParams({ ...VALID_PARAMS, drive_id: 42 })).toBeNull();
  });

  it('returns null when params is undefined', () => {
    expect(extractShareWithApplicationParams(undefined)).toBeNull();
  });
});

describe('prettyJsonOrVerbatim', () => {
  it('pretty-prints valid JSON with 2-space indent', () => {
    expect(prettyJsonOrVerbatim('{"a":1,"b":[2,3]}')).toBe(
      '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}',
    );
  });

  it('returns input verbatim when JSON is invalid', () => {
    expect(prettyJsonOrVerbatim('not json {')).toBe('not json {');
  });

  it('returns input verbatim for empty string without throwing', () => {
    expect(prettyJsonOrVerbatim('')).toBe('');
  });
});

describe('buildPowerShellSnippet', () => {
  it('uses the parsed method and uri with backtick line continuations', () => {
    const out = buildPowerShellSnippet(VALID_PARAMS);
    expect(out).toContain('Invoke-MgGraphRequest `');
    expect(out).toContain('-Method POST `');
    expect(out).toContain(
      '-Uri "https://graph.microsoft.com/v1.0/drives/b!abc/items/01XYZ/permissions" `',
    );
    expect(out).toContain(`-Body '${VALID_PARAMS.graph_body}'`);
  });

  it('escapes single quotes in the body by doubling them', () => {
    const params = { ...VALID_PARAMS, graph_body: `{"name":"O'Neil"}` };
    const out = buildPowerShellSnippet(params);
    expect(out).toContain(`-Body '{"name":"O''Neil"}'`);
  });

  it('falls back to POST when graph_call has no space', () => {
    const params = { ...VALID_PARAMS, graph_call: 'https://example.com/foo' };
    const out = buildPowerShellSnippet(params);
    expect(out).toContain('-Method POST `');
    expect(out).toContain('-Uri "https://example.com/foo" `');
  });

  it('passes through non-POST methods (GET, PATCH)', () => {
    const get = buildPowerShellSnippet({ ...VALID_PARAMS, graph_call: 'GET https://x/y' });
    expect(get).toContain('-Method GET `');
    const patch = buildCurlSnippet({ ...VALID_PARAMS, graph_call: 'PATCH https://x/y' });
    expect(patch).toContain('curl -X PATCH "https://x/y"');
  });
});

describe('buildCurlSnippet', () => {
  it('uses the parsed method and uri with backslash line continuations', () => {
    const out = buildCurlSnippet(VALID_PARAMS);
    expect(out).toContain(
      'curl -X POST "https://graph.microsoft.com/v1.0/drives/b!abc/items/01XYZ/permissions" \\',
    );
    expect(out).toContain('-H "Authorization: Bearer <YOUR-TOKEN>" \\');
    expect(out).toContain('-H "Content-Type: application/json" \\');
    expect(out).toContain(`-d '${VALID_PARAMS.graph_body}'`);
  });

  it("escapes single quotes in the body using '\\'' sequence", () => {
    const params = { ...VALID_PARAMS, graph_body: `{"name":"O'Neil"}` };
    const out = buildCurlSnippet(params);
    expect(out).toContain(`-d '{"name":"O'\\''Neil"}'`);
  });
});

describe('buildRawSnippet', () => {
  it('puts graph_call on first line and pretty-prints the body below', () => {
    const out = buildRawSnippet(VALID_PARAMS);
    const [firstLine, ...rest] = out.split('\n');
    expect(firstLine).toBe(VALID_PARAMS.graph_call);
    expect(rest.join('\n')).toBe(prettyJsonOrVerbatim(VALID_PARAMS.graph_body));
  });

  it('keeps body verbatim when not valid JSON', () => {
    const params = { ...VALID_PARAMS, graph_body: 'not-json' };
    expect(buildRawSnippet(params)).toBe(`${VALID_PARAMS.graph_call}\nnot-json`);
  });
});
