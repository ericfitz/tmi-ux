/**
 * Pure formatters for the `share_with_application` remediation snippets.
 * Kept separate from the component so they can be unit-tested without TestBed.
 */

export interface ShareWithApplicationParams {
  drive_id: string;
  item_id: string;
  app_object_id: string;
  graph_call: string;
  graph_body: string;
}

/**
 * Returns a typed params object if all required fields are present and
 * non-empty strings, otherwise null. The server should always populate these
 * for the `share_with_application` action; null indicates a server contract
 * violation.
 */
// SEM@414984dadc9232b9a98bc7dcc3c927eb0d907dfe: parse and validate share-with-application remediation params from raw record (pure)
export function extractShareWithApplicationParams(
  params: Record<string, unknown> | undefined,
): ShareWithApplicationParams | null {
  if (!params) return null;
  const drive_id = params['drive_id'];
  const item_id = params['item_id'];
  const app_object_id = params['app_object_id'];
  const graph_call = params['graph_call'];
  const graph_body = params['graph_body'];
  if (
    typeof drive_id !== 'string' ||
    typeof item_id !== 'string' ||
    typeof app_object_id !== 'string' ||
    typeof graph_call !== 'string' ||
    typeof graph_body !== 'string' ||
    !drive_id ||
    !item_id ||
    !app_object_id ||
    !graph_call ||
    !graph_body
  ) {
    return null;
  }
  return { drive_id, item_id, app_object_id, graph_call, graph_body };
}

/**
 * Pretty-prints valid JSON with 2-space indent. Returns input verbatim
 * (and never throws) if the input is not valid JSON.
 */
// SEM@414984dadc9232b9a98bc7dcc3c927eb0d907dfe: format a string as pretty-printed JSON, returning it verbatim if invalid (pure)
export function prettyJsonOrVerbatim(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

/**
 * Splits the graph_call string ("METHOD https://...") into method and uri.
 * Falls back to POST + the whole string if no space is found.
 */
// SEM@414984dadc9232b9a98bc7dcc3c927eb0d907dfe: parse a Graph API call string into HTTP method and URI parts (pure)
function splitGraphCall(graphCall: string): { method: string; uri: string } {
  const idx = graphCall.indexOf(' ');
  if (idx === -1) return { method: 'POST', uri: graphCall };
  return { method: graphCall.slice(0, idx).trim() || 'POST', uri: graphCall.slice(idx + 1).trim() };
}

/**
 * Escapes a string for use inside a single-quoted PowerShell literal.
 * Single quotes inside are doubled (PowerShell convention).
 */
// SEM@414984dadc9232b9a98bc7dcc3c927eb0d907dfe: escape a string for safe embedding in a PowerShell single-quoted literal (pure)
function escapeForPowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Escapes a string for use inside a single-quoted shell literal.
 * Single quotes inside are closed-then-escaped-then-reopened: ' -> '\''
 */
// SEM@414984dadc9232b9a98bc7dcc3c927eb0d907dfe: escape a string for safe embedding in a POSIX shell single-quoted literal (pure)
function escapeForShellSingleQuoted(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

/**
 * Builds a multi-line PowerShell snippet using `Invoke-MgGraphRequest` with
 * backtick line continuations.
 */
// SEM@414984dadc9232b9a98bc7dcc3c927eb0d907dfe: build an Invoke-MgGraphRequest PowerShell snippet from share-with-application params (pure)
export function buildPowerShellSnippet(params: ShareWithApplicationParams): string {
  const { method, uri } = splitGraphCall(params.graph_call);
  const escapedBody = escapeForPowerShellSingleQuoted(params.graph_body);
  return [
    `Invoke-MgGraphRequest \``,
    `  -Method ${method} \``,
    `  -Uri "${uri}" \``,
    `  -Body '${escapedBody}'`,
  ].join('\n');
}

/**
 * Builds a multi-line curl snippet using backslash line continuations.
 */
// SEM@414984dadc9232b9a98bc7dcc3c927eb0d907dfe: build a curl shell snippet from share-with-application Graph API params (pure)
export function buildCurlSnippet(params: ShareWithApplicationParams): string {
  const { method, uri } = splitGraphCall(params.graph_call);
  const escapedBody = escapeForShellSingleQuoted(params.graph_body);
  return [
    `curl -X ${method} "${uri}" \\`,
    `  -H "Authorization: Bearer <YOUR-TOKEN>" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${escapedBody}'`,
  ].join('\n');
}

/**
 * Builds the raw two-line snippet: graph_call on one line, body
 * (pretty-printed when valid JSON) on subsequent lines.
 */
// SEM@414984dadc9232b9a98bc7dcc3c927eb0d907dfe: build a raw Graph API call snippet with pretty-printed body (pure)
export function buildRawSnippet(params: ShareWithApplicationParams): string {
  return `${params.graph_call}\n${prettyJsonOrVerbatim(params.graph_body)}`;
}
