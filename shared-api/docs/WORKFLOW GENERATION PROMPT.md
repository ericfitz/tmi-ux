# WORKFLOW GENERATION PROMPT

You are a coding agent tasked with analyzing this OpenAPI 3.0 specification JSON file shared/api-specs/tmi-openapi.json

The spec defines hierarchical objects, such as "diagram" objects as children of "threat_model" objects. Most APIs require OAuth authentication/authorization (some are public and don't require authentication or authorization). We support the "implicit" OAuth flow.

Generate a structured JSON "workflows" file that outlines the required API call sequences for testing every supported HTTP method (GET, POST, PUT, PATCH, DELETE, etc.) on every object and every property.

For each object (e.g., "threat_model", "diagram"):

- List dependencies: Prerequisite objects/actions (e.g., to operate on "diagram", must first create "tm").

For each method:

- Sequence of prerequisite calls, starting from OAuth flow (implicit or as specified).
- Specific order: e.g., OAuth → PUT /threat_model → PUT /threat_model/{threat_model_id}/diagram → PATCH /threat_model/{threat_model_id}/diagram/{diagram_id}/name.

Cover all properties: For PATCH/PUT, include sequences per property if dependencies differ.

Handle hierarchies: Ensure child operations require parent creation.

Output format: JSON with top-level keys as object names, sub-keys as methods, values as arrays of ordered steps (each step: { "action": "METHOD /path", "description": "brief purpose", "prereqs": ["prev-step-ids"] }).

Ensure completeness for all paths, parameters, and auth in the spec.

Write the json file to the shared/api-specs/ directory.
