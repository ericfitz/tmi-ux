# Authentication and Authorization Implementation Plan for TMI Service

## Overview

This plan outlines the implementation of a secure authentication and authorization system for the TMI service, which will work with the tmi-ux Angular web application. The system will support multiple OAuth 2.0 providers, implement OIDC for enhanced security, and maintain the existing authorization model while ensuring proper separation between the frontend and backend services.

## Database Architecture

### PostgreSQL as Primary Persistent Store

PostgreSQL will serve as the primary persistent database for:

- User accounts and profiles
- OAuth provider configurations
- Authorization data (roles, permissions)
- Account linking information
- Threat models, threats, and diagrams (existing data)

### Redis for Caching and Ephemeral Data

Redis will be used for:

- **Authorization Cache**:
  - Map of threatModel IDs to users and their roles
  - Map of threat IDs to threat model IDs
  - Map of diagram IDs to threat model IDs
- **Token Management**:
  - Refresh tokens with automatic expiration
  - Token blacklisting/revocation
- **Rate Limiting**:
  - Counters for API rate limiting
- **Session Data**:
  - Temporary session information

### Redis Cache Structure

For the authorization cache, we'll use Redis hashes and sets:

```
# Map of threat model IDs to user roles
threatmodel:{id}:roles = { "user1@example.com": "owner", "user2@example.com": "writer" }

# Map of threat IDs to threat model IDs
threat:{id}:threatmodel = "threat-model-id"

# Map of diagram IDs to threat model IDs
diagram:{id}:threatmodel = "threat-model-id"
```

### Cache Synchronization

To keep the Redis cache in sync with PostgreSQL:

1. **Write-Through Caching**: When data is updated in PostgreSQL, also update the Redis cache
2. **Cache Invalidation**: When authorization data changes, invalidate the relevant cache entries
3. **Cache Loading**: On cache miss, load data from PostgreSQL and populate Redis
4. **TTL for Cache Entries**: Set reasonable TTLs to ensure stale data is eventually refreshed
5. **Periodic Full Rebuild**: Implement a background job that periodically rebuilds the entire Redis cache from PostgreSQL to handle any potential inconsistencies

### Authorization Flow

1. Check Redis for the required authorization data
2. If found, make authorization decision based on cached data
3. If not found (cache miss), query PostgreSQL
4. Update Redis cache with the fetched data
5. Make authorization decision

## Architecture

The authentication flow will work as follows:

1. User accesses tmi-ux application and is redirected to login
2. User selects an OAuth provider (Google, GitHub, or Microsoft)
3. User is redirected to the OAuth provider's login page
4. After successful authentication, the OAuth provider redirects back to tmi-ux with an authorization code
5. tmi-ux sends the authorization code to tmi server's token endpoint
6. tmi server verifies the code with the OAuth provider and exchanges it for ID and access tokens
7. tmi server extracts user information, stores/updates it in the database, and generates a JWT
8. tmi server returns the JWT to tmi-ux, which stores it for API requests
9. For subsequent API requests, tmi-ux includes the JWT in the Authorization header
10. tmi server validates the JWT and checks authorization for the requested resource
11. When the JWT expires (after 1 hour), tmi-ux requests a token refresh

## Components and Implementation Details

### 1. OAuth 2.0 Provider Integration

#### TMI-UX (Angular Frontend)

- Implement OAuth 2.0 client for Google, GitHub, and Microsoft
- Create provider selection UI
- Handle authorization code redirect
- Securely store and manage JWT tokens
- Implement automatic token refresh

#### TMI Server (Go Backend)

- Create configuration for multiple OAuth providers
- Implement token exchange endpoint
- Validate OAuth tokens and extract user information
- Generate and sign JWT tokens
- Implement refresh token functionality

#### Provider Configuration Management

We'll implement a flexible provider configuration system that makes it easy to add new providers:

1. **Configuration Structure**:

```go
type OAuthProviderConfig struct {
    ID                  string   `json:"id"`
    Name                string   `json:"name"`
    Enabled             bool     `json:"enabled"`
    Icon                string   `json:"icon"`
    ClientID            string   `json:"client_id"`
    ClientSecret        string   `json:"client_secret"`
    AuthorizationURL    string   `json:"authorization_url"`
    TokenURL            string   `json:"token_url"`
    UserInfoURL         string   `json:"userinfo_url"`
    Issuer              string   `json:"issuer"`
    JWKSURL             string   `json:"jwks_url"`
    Scopes              []string `json:"scopes"`
    AdditionalParams    map[string]string `json:"additional_params"`
    EmailClaim          string   `json:"email_claim"`
    NameClaim           string   `json:"name_claim"`
    SubjectClaim        string   `json:"subject_claim"`
}
```

2. **Dynamic Configuration Loading**:

   - Load provider configurations from a database or configuration files
   - Support hot-reloading of configurations without server restart
   - Include admin API endpoints for managing provider configurations

3. **Provider Factory**:

```go
func NewOAuthProvider(config OAuthProviderConfig) (Provider, error) {
    switch config.ID {
    case "google":
        return NewGoogleProvider(config)
    case "github":
        return NewGithubProvider(config)
    case "microsoft":
        return NewMicrosoftProvider(config)
    default:
        // Generic OIDC provider for any standard-compliant provider
        return NewGenericOIDCProvider(config)
    }
}
```

4. **Adding New Providers**:
   - To add a new provider, simply add its configuration to the database/config
   - For standard OIDC providers, no code changes are needed
   - For providers with special requirements, create a custom provider implementation

### 2. User Database Schema

Create a minimal user database to store essential information for authorization:

- User table with fields: id, email, name, created_at, updated_at, last_login
- RefreshToken table with fields: id, user_id, token, expires_at, created_at
- UserProvider table with fields:
  ```sql
  CREATE TABLE user_providers (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      provider VARCHAR(50) NOT NULL,
      provider_user_id VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      is_primary BOOLEAN DEFAULT false,
      created_at TIMESTAMP NOT NULL,
      last_login TIMESTAMP,
      UNIQUE(provider, provider_user_id),
      UNIQUE(user_id, provider)
  );
  ```

### 3. JWT Implementation

- **Claims**: Include sub (email), iat, exp, name, and email
- **Expiration**: Configurable via environment variables (default: 1 hour/3600 seconds)
- **Signing**: Use RS256 (asymmetric) for production, HS256 for development
- **Refresh Tokens**: Implement with configurable expiration (default: 30 days), one-time use with automatic rotation

The configuration will look like:

```go
type TokenConfig struct {
    JWTExpirationSeconds    int    `env:"JWT_EXPIRATION_SECONDS" default:"3600"`
    RefreshExpirationDays   int    `env:"REFRESH_EXPIRATION_DAYS" default:"30"`
    RefreshReuseWindow      int    `env:"REFRESH_REUSE_WINDOW_SECONDS" default:"60"`
    JWTSigningMethod        string `env:"JWT_SIGNING_METHOD" default:"RS256"`
    JWTSigningKey           string `env:"JWT_SIGNING_KEY" required:"true"`
}
```

### 4. Debug Logging for OIDC

We'll implement comprehensive debug logging specifically for OIDC operations:

```go
type OIDCLogger struct {
    logger *logging.Logger
}

func (l *OIDCLogger) Debug(ctx context.Context, msg string, args ...interface{}) {
    l.logger.Debug("OIDC: "+msg, args...)
}

func (l *OIDCLogger) Info(ctx context.Context, msg string, args ...interface{}) {
    l.logger.Info("OIDC: "+msg, args...)
}

func (l *OIDCLogger) Error(ctx context.Context, msg string, args ...interface{}) {
    l.logger.Error("OIDC: "+msg, args...)
}
```

Key logging points will include:

- All OIDC request/response details (with sensitive data redacted)
- Token validation steps and results
- Provider discovery information
- Error details with context
- Session state changes
- Token refresh operations

We'll implement log levels that can be dynamically adjusted in production to enable detailed debugging when needed without requiring a restart.

### 5. API Endpoints

Add the following endpoints to the TMI server:

1. **OAuth Provider Configuration**

   - `GET /auth/providers` - List available OAuth providers

2. **Token Management**

   - `POST /auth/token` - Exchange authorization code for JWT
   - `POST /auth/refresh` - Refresh an expired JWT
   - `POST /auth/logout` - Invalidate refresh tokens

3. **User Information**
   - `GET /auth/me` - Get current user information

### 6. CORS Configuration

Implement proper CORS handling for cross-domain requests between tmi-ux and tmi server.

### 7. Security Measures (OWASP Compliance)

1. **JWT Security**: Strong signing keys, proper validation, necessary claims only, short expiration
2. **CSRF Protection**: SameSite cookie attributes, CSRF tokens for sensitive operations
3. **Input Validation**: Validate all inputs, especially OAuth tokens and codes
4. **Rate Limiting**: For authentication endpoints with exponential backoff for failed attempts
5. **Secure Headers**: Implement security headers (Content-Security-Policy, X-XSS-Protection, etc.)
6. **Logging and Monitoring**: Log authentication events, monitor for suspicious activities

### 8. Authorization Integration

Integrate the new authentication system with the existing authorization model:

1. Use email from JWT as the principal identifier
2. Maintain existing role-based access control
3. **Permission Checking**: Implement server-side permission check on every request
   - JWT contains only user identity (email/sub), not permissions
   - On each API request, the server looks up the user's current permissions from the database
   - This ensures permissions are always up-to-date
   - Update middleware to validate JWT and apply authorization rules based on current permissions

### 9. Error Handling and Edge Cases

#### OAuth Flow Error Handling

1. **User Denies Permission**

   - When a user denies permissions during the OAuth process, the OAuth provider will redirect back to the application with an error code
   - The frontend (tmi-ux) should detect this error parameter in the redirect URL
   - Display a user-friendly message explaining that permissions are required to use the application
   - Provide a "Try Again" option that restarts the authentication flow
   - Log the denial for analytics purposes (without personally identifiable information)

2. **Network Errors**

   - Implement retry mechanisms with exponential backoff for API calls to OAuth providers
   - For frontend-to-backend communication, implement proper error handling with clear error messages
   - Cache the authentication state to prevent losing progress if possible
   - Provide clear recovery paths for users when network errors occur

3. **Invalid or Expired Authorization Codes**

   - Handle cases where the authorization code expires before it can be exchanged for tokens
   - Implement proper error messages and automatic retry/restart of the authentication flow
   - Add monitoring for unusual patterns of expired codes that might indicate performance issues

4. **Account Linking Errors**

   - Handle the case where a user authenticates with a different provider but using the same email
   - Implement a secure account linking flow that verifies ownership of both accounts
   - Provide clear UI for users to understand the account linking process

#### Account Linking with Multiple Providers

For handling users who authenticate with multiple providers using the same email address:

1. **Primary Account Identification**:

   - The first provider a user authenticates with becomes their primary account
   - The email address serves as the unique identifier across providers
   - We store the provider-specific user ID for each linked provider

2. **Automatic Linking Process**:

   - When a user authenticates with a new provider using an email that exists in our system:
     1. We detect the existing account with the same email
     2. We verify email ownership through the ID token's email_verified claim
     3. If verified, we automatically link the accounts
     4. If not verified, we require additional verification

3. **User Experience**:

   - When automatic linking occurs, we inform the user: "We've linked your Google account to your existing GitHub account"
   - We provide an account management UI where users can view and manage linked providers
   - Users can unlink providers as long as at least one remains linked

4. **Token Exchange Failures**
   - Implement proper error handling for failures during the token exchange process
   - Log detailed error information for debugging (sanitized of sensitive data)
   - Return appropriate HTTP status codes and error messages to the frontend
   - Implement circuit breakers for repeated failures with a specific OAuth provider

#### Error Response Standardization

Standardize error responses across all authentication endpoints:

```json
{
  "error": "error_code",
  "error_description": "Human-readable error description",
  "error_uri": "https://docs.example.com/auth/errors/error_code"
}
```

Common error codes would include:

- `invalid_request`: The request is missing a required parameter or is otherwise malformed
- `unauthorized_client`: The client is not authorized to request an authorization code
- `access_denied`: The resource owner denied the request
- `unsupported_response_type`: The authorization server does not support obtaining an authorization code using this method
- `server_error`: The authorization server encountered an unexpected condition
- `temporarily_unavailable`: The authorization server is currently unable to handle the request due to temporary overloading or maintenance

#### Graceful Degradation

Implement graceful degradation strategies:

- If one OAuth provider is unavailable, other providers should still work
- Provide clear status indicators for each OAuth provider's availability
- Implement a fallback authentication method for emergency access if all OAuth providers are unavailable

#### User Communication

Ensure clear communication with users during error scenarios:

- Use plain language to explain what went wrong
- Provide clear next steps for users to resolve issues
- Avoid technical jargon in user-facing error messages
- Include support contact information for unresolvable errors

## Implementation Phases

### Phase 1: Database Setup and Core Authentication Infrastructure

- Set up PostgreSQL database schema for users, providers, and tokens
- Configure Redis for caching and token storage
- Implement cache synchronization mechanisms
- Implement background job for periodic cache rebuilding
- Implement JWT generation and validation
- Add refresh token functionality
- Create basic authentication middleware

### Phase 2: OAuth Provider Integration

- Implement configuration for multiple providers
- Create token exchange endpoint
- Add user profile extraction and storage
- Implement OIDC validation

### Phase 3: Frontend Integration

- Create provider selection UI in tmi-ux
- Implement authorization code handling
- Add JWT storage and refresh logic
- Update API calls to include JWT

### Phase 4: Security Hardening

- Implement OWASP security best practices
- Add rate limiting and monitoring
- Conduct security testing
- Document security measures

### Phase 5: Testing Strategy

#### Unit Testing

1. **JWT Token Testing**:

   - Test token generation with various claims
   - Test token validation including expiration and signature verification
   - Test refresh token rotation

2. **Authorization Logic Testing**:
   - Test permission checking for different roles
   - Test authorization middleware with various JWT payloads
   - Test edge cases like missing or malformed tokens

#### Integration Testing

1. **Mock OAuth Providers**:

   - Create mock implementations of OAuth providers for testing
   - Example mock implementation:

   ```go
   type MockOAuthProvider struct {
       AuthorizeURLFunc  func(state string, opts ...string) string
       ExchangeCodeFunc  func(code string) (*TokenResponse, error)
       GetUserInfoFunc   func(token string) (*UserInfo, error)
   }

   func (m *MockOAuthProvider) AuthorizeURL(state string, opts ...string) string {
       return m.AuthorizeURLFunc(state, opts...)
   }

   func (m *MockOAuthProvider) ExchangeCode(code string) (*TokenResponse, error) {
       return m.ExchangeCodeFunc(code)
   }

   func (m *MockOAuthProvider) GetUserInfo(token string) (*UserInfo, error) {
       return m.GetUserInfoFunc(token)
   }
   ```

2. **Test OAuth Flow**:

   - Test the complete OAuth flow with mock providers
   - Test error handling for various OAuth error scenarios
   - Test account linking with multiple providers

3. **API Testing**:
   - Test authentication endpoints with various inputs
   - Test error responses match the standardized format
   - Test rate limiting and security measures

#### End-to-End Testing

1. **Real Provider Testing**:

   - Create test accounts with real OAuth providers for E2E testing
   - Test the complete authentication flow in a staging environment
   - Test cross-browser compatibility

2. **Security Testing**:
   - Perform penetration testing on authentication endpoints
   - Test for common OWASP vulnerabilities
   - Test token security and potential leakage

#### Test Fixtures and Helpers

1. **Test Token Generator**:

   - Create helpers to generate test tokens with various claims and expiration times

2. **Mock User Database**:

   - Create an in-memory user database for testing
   - Populate with test users with various permissions

3. **Request Simulators**:
   - Create helpers to simulate OAuth callbacks and token requests

## Deployment Considerations

### Secrets Management

Proper management of sensitive credentials is critical for the security of the authentication system:

1. **OAuth Client Secrets**:

   - Store OAuth client IDs and secrets in a secure secrets management system, not in code or config files
   - Options include:
     - HashiCorp Vault
     - AWS Secrets Manager
     - Azure Key Vault
     - Google Secret Manager
   - Rotate client secrets periodically according to a defined schedule
   - Use different client IDs and secrets for development, staging, and production environments

2. **JWT Signing Keys**:

   - For RS256 (asymmetric) signing:
     - Generate and securely store private keys
     - Distribute public keys for verification
     - Implement key rotation without service disruption
   - For HS256 (symmetric) signing:
     - Use strong, randomly generated secrets
     - Rotate keys periodically
   - Consider using a Hardware Security Module (HSM) for key storage in production

3. **Database Credentials**:

   - Use separate database users with appropriate permissions for different services
   - Store database credentials in the secrets management system
   - Implement credential rotation procedures

4. **Environment-Specific Configuration**:
   - Use different OAuth callback URLs for each environment
   - Configure appropriate CORS settings for each environment
   - Adjust security parameters (token lifetime, rate limits) based on environment

### Infrastructure Considerations

1. **Redis Deployment**:

   - Consider Redis Sentinel or Redis Cluster for high availability
   - Implement proper Redis authentication
   - Enable persistence for critical data
   - Configure appropriate eviction policies
   - Set up monitoring for Redis memory usage and performance

2. **PostgreSQL Deployment**:

   - Set up replication for high availability
   - Implement regular backups
   - Configure connection pooling
   - Set up monitoring for database performance

3. **Scaling Considerations**:

   - Design the authentication system to be horizontally scalable
   - Ensure Redis and PostgreSQL can handle the expected load
   - Consider read replicas for PostgreSQL in high-read scenarios
   - Implement proper caching strategies to reduce database load

4. **Monitoring and Alerting**:
   - Set up monitoring for authentication failures and suspicious patterns
   - Create alerts for unusual authentication activity
   - Monitor token usage and expiration patterns
   - Track OAuth provider availability and response times
