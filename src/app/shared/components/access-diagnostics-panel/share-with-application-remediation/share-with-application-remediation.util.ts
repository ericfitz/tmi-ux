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
function splitGraphCall(graphCall: string): { method: string; uri: string } {
  const idx = graphCall.indexOf(' ');
  if (idx === -1) return { method: 'POST', uri: graphCall };
  return { method: graphCall.slice(0, idx).trim() || 'POST', uri: graphCall.slice(idx + 1).trim() };
}

/**
 * Escapes a string for use inside a single-quoted PowerShell literal.
 * Single quotes inside are doubled (PowerShell convention).
 */
function escapeForPowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Escapes a string for use inside a single-quoted shell literal.
 * Single quotes inside are closed-then-escaped-then-reopened: ' -> '\''
 */
function escapeForShellSingleQuoted(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

/**
 * Builds a multi-line PowerShell snippet using `Invoke-MgGraphRequest` with
 * backtick line continuations.
 */
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
export function buildRawSnippet(params: ShareWithApplicationParams): string {
  return `${params.graph_call}\n${prettyJsonOrVerbatim(params.graph_body)}`;
}
