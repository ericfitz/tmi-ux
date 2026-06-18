/**
 * Client credential type definitions
 * Re-exports generated types from the OpenAPI spec
 */
import { components, operations } from '@app/generated/api-types';

/** Client credential info returned from list endpoint (no secret) */
// SEM@5081e618139a8f00af65190c90a19136eebd7a1b: type alias for client credential summary without secret (pure)
export type ClientCredentialInfo = components['schemas']['ClientCredentialInfo'];

/** Client credential response from creation (includes secret, shown only once) */
// SEM@5081e618139a8f00af65190c90a19136eebd7a1b: type alias for client credential creation response including one-time secret (pure)
export type ClientCredentialResponse = components['schemas']['ClientCredentialResponse'];

/** Input for creating a new client credential */
// SEM@5081e618139a8f00af65190c90a19136eebd7a1b: type alias for the request body to create a client credential (pure)
export type CreateClientCredentialRequest =
  operations['createCurrentUserClientCredential']['requestBody']['content']['application/json'];

/** Response from list client credentials endpoint (paginated) */
// SEM@5081e618139a8f00af65190c90a19136eebd7a1b: type alias for paginated list of client credentials (pure)
export type ListClientCredentialsResponse = components['schemas']['ListClientCredentialsResponse'];
