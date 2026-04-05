/**
 * Client credential type definitions
 * Re-exports generated types from the OpenAPI spec
 */
import { components, operations } from '@app/generated/api-types';

/** Client credential info returned from list endpoint (no secret) */
export type ClientCredentialInfo = components['schemas']['ClientCredentialInfo'];

/** Client credential response from creation (includes secret, shown only once) */
export type ClientCredentialResponse = components['schemas']['ClientCredentialResponse'];

/** Input for creating a new client credential */
export type CreateClientCredentialRequest =
  operations['createCurrentUserClientCredential']['requestBody']['content']['application/json'];

/** Response from list client credentials endpoint (paginated) */
export type ListClientCredentialsResponse = components['schemas']['ListClientCredentialsResponse'];
