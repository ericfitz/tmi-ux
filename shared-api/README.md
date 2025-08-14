# TMI Shared API Resources

This directory contains shared resources for the Threat Modeling Improved (TMI) project, intended for consumption by client applications including the TMI-UX frontend.

## Directory Structure

```
shared/
├── README.md                   # This file
├── api-specs/                  # API Specifications
│   ├── tmi-openapi.json       # OpenAPI 3.0 REST API specification
│   └── tmi-asyncapi.yaml      # AsyncAPI WebSocket specification
├── docs/                       # Client-focused documentation
│   ├── CLIENT_INTEGRATION_GUIDE.md  # Complete client integration guide
│   ├── TMI-API-v1_0.md            # REST API documentation
│   ├── CLIENT_OAUTH_INTEGRATION.md # OAuth setup for clients
│   ├── AUTHORIZATION.md           # Authorization patterns and examples
│   ├── COLLABORATIVE_EDITING_PLAN.md # Real-time collaboration details
│   ├── oauth-oidc-provider-integration.png # OAuth flow diagram
│   └── tmi-oauth-flow.png         # TMI-specific OAuth flow
└── sdk-examples/               # Reference SDK implementations
    └── python-sdk/            # Python client SDK example
        ├── README.md          # SDK usage instructions
        ├── examples/          # Working code examples
        ├── tmi_client/       # Client library implementation
        └── requirements.txt   # Python dependencies
```

## What's Included

### API Specifications
- **OpenAPI 3.0** (`api-specs/tmi-openapi.json`): Complete REST API specification with schemas, endpoints, and authentication
- **AsyncAPI** (`api-specs/tmi-asyncapi.yaml`): WebSocket collaboration API specification

### Documentation
- **Client Integration Guide**: Step-by-step integration instructions
- **API Documentation**: Human-readable API documentation
- **OAuth Integration**: Authentication setup and flows
- **Authorization Patterns**: Role-based access control examples
- **Collaboration Details**: Real-time editing implementation guide

### SDK Examples
- **Python SDK**: Reference implementation showing best practices for:
  - Authentication flows
  - API client patterns
  - WebSocket collaboration
  - Error handling
  - Type definitions

## Usage for Client Applications

### Git Subtree Integration

Add this shared content to your client repository:

```bash
# Add shared content as subtree
git subtree add --prefix=shared-api https://github.com/yourusername/tmi.git shared --squash

# Pull updates
git subtree pull --prefix=shared-api https://github.com/yourusername/tmi.git shared --squash
```

### Direct File Usage

1. **OpenAPI Code Generation**:
   ```bash
   # Generate TypeScript client
   openapi-generator-cli generate -i shared-api/api-specs/tmi-openapi.json -g typescript-fetch -o src/api-client

   # Generate other language clients
   openapi-generator-cli generate -i shared-api/api-specs/tmi-openapi.json -g [language] -o generated/
   ```

2. **WebSocket Integration**:
   - Reference `api-specs/tmi-asyncapi.yaml` for message schemas
   - Follow patterns in `docs/CLIENT_INTEGRATION_GUIDE.md`
   - Use `sdk-examples/python-sdk/` as implementation reference

3. **Authentication Setup**:
   - Follow `docs/CLIENT_OAUTH_INTEGRATION.md` for OAuth setup
   - Reference `docs/AUTHORIZATION.md` for role-based patterns

## Key Integration Points

### 1. REST API Client
```javascript
// Example TypeScript integration
import { Configuration, DefaultApi } from './generated-api-client';

const config = new Configuration({
  basePath: 'https://api.tmi.example.com',
  accessToken: 'your-jwt-token'
});

const api = new DefaultApi(config);
```

### 2. WebSocket Collaboration
```javascript
// Follow the patterns in CLIENT_INTEGRATION_GUIDE.md
const wsUrl = collaborationSession.websocket_url;
const ws = new WebSocket(wsUrl);
```

### 3. Authentication Flow
```javascript
// Reference CLIENT_OAUTH_INTEGRATION.md for complete setup
const authUrl = 'https://api.tmi.example.com/auth/oauth/authorize';
// ... implement OAuth flow
```

## Staying Updated

### For Consumers
When the TMI service updates its APIs or documentation:

```bash
# Pull latest shared content
git subtree pull --prefix=shared-api https://github.com/yourusername/tmi.git shared --squash

# Regenerate clients if needed
npm run generate-api-client
```

### Version Compatibility
- **OpenAPI Version**: Check `info.version` in `api-specs/tmi-openapi.json`
- **Breaking Changes**: Monitor API version changes and update accordingly
- **AsyncAPI Changes**: WebSocket message formats in `api-specs/tmi-asyncapi.yaml`

## Support

For issues related to shared content:
1. Check the main TMI repository documentation
2. Review `CLIENT_INTEGRATION_GUIDE.md` for common patterns
3. Reference `sdk-examples/python-sdk/` for working implementations

## Contributing

This shared content is maintained as part of the TMI service repository. Updates are distributed via Git subtree to consuming repositories.