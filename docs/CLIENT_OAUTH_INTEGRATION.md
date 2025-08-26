# TMI OAuth Integration Guide for Client Developers

This guide shows how to integrate your client application with TMI's OAuth authentication system. TMI provides a server-side OAuth proxy that handles the complexity of OAuth flows while providing your client with simple JWT tokens.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Provider Discovery](#provider-discovery)
- [OAuth Flow Implementation](#oauth-flow-implementation)
- [Token Management](#token-management)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

### Architecture

TMI uses a **server-side OAuth proxy pattern** where:

1. **Client** discovers available OAuth providers
2. **Client** redirects users to TMI OAuth endpoints
3. **TMI server** handles OAuth complexity with providers
4. **TMI server** returns JWT tokens to your client
5. **Client** uses JWT tokens for authenticated API calls

### Benefits

- **No OAuth complexity** in your client code
- **No client secrets** exposed in browser
- **Consistent token format** across all OAuth providers
- **Automatic provider configuration** via API discovery

## Quick Start

### 1. Discover Available Providers

```javascript
// Fetch available OAuth providers
const response = await fetch('http://localhost:8080/auth/providers');
const { providers } = await response.json();

console.log(providers);
// [
//   {
//     "id": "google",
//     "name": "Google", 
//     "icon": "fa-brands fa-google",
//     "auth_url": "http://localhost:8080/auth/login/google",
//     "redirect_uri": "http://localhost:8080/auth/callback",
//     "client_id": "675196260523-..."
//   }
// ]
```

### 2. Implement Login Button

```javascript
function loginWithProvider(provider) {
  // Simply redirect to TMI's OAuth endpoint
  window.location.href = provider.auth_url;
}
```

### 3. Handle OAuth Callback

TMI will redirect back to your application with tokens in the URL hash or query parameters. **Note**: The exact callback mechanism depends on your client application's setup.

```javascript
// Example: Handle tokens from URL hash or query params
function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('access_token');
  
  if (accessToken) {
    localStorage.setItem('tmi_token', accessToken);
    // Redirect to main application
    window.location.href = '/dashboard';
  }
}
```

## Provider Discovery

### GET /auth/providers

Use this endpoint to dynamically discover available OAuth providers instead of hardcoding them.

**Request:**
```javascript
const response = await fetch(`${API_BASE_URL}/auth/providers`);
const { providers } = await response.json();
```

**Response:**
```json
{
  "providers": [
    {
      "id": "google",
      "name": "Google",
      "icon": "fa-brands fa-google",
      "auth_url": "http://localhost:8080/auth/login/google",
      "redirect_uri": "http://localhost:8080/auth/callback",
      "client_id": "675196260523-e8ppeu62pv222jhnpebe929b2tgl2jm0.apps.googleusercontent.com"
    }
  ]
}
```

**Building Login UI:**
```html
<!-- Example login buttons -->
<div class="oauth-providers">
  {{#each providers}}
  <button onclick="loginWithProvider('{{auth_url}}')" class="oauth-btn">
    <i class="{{icon}}"></i>
    Sign in with {{name}}
  </button>
  {{/each}}
</div>
```

## OAuth Flow Implementation

### Flow Overview

```
┌─────────┐    1. Redirect to    ┌─────────────┐    2. OAuth Flow    ┌─────────────┐
│ Client  │ ───auth_url──────────▶│ TMI Server  │ ──────────────────▶│ OAuth       │
│         │                      │             │                    │ Provider    │
│         │                      │             │ ◀──────────────────│ (Google)    │
│         │    4. Tokens/Error   │             │    3. Callback     │             │
│         │ ◀────────────────────│             │                    │             │
└─────────┘                      └─────────────┘                    └─────────────┘
```

### Step 1: Initiate OAuth Flow

**Recommended: With Client Callback (New in v1.1+):**
```javascript
function loginWithGoogle() {
  // Get provider info from discovery
  const provider = providers.find(p => p.id === 'google');
  
  // Generate state for CSRF protection
  const state = generateRandomState();
  localStorage.setItem('oauth_state', state);
  
  // Define where TMI should redirect after OAuth completion
  const clientCallbackUrl = `${window.location.origin}/auth/callback`;
  
  // Build OAuth URL with client callback
  const separator = provider.auth_url.includes('?') ? '&' : '?';
  const authUrl = `${provider.auth_url}${separator}state=${state}&client_callback=${encodeURIComponent(clientCallbackUrl)}`;
  
  // Redirect to TMI OAuth endpoint
  window.location.href = authUrl;
}
```

**Legacy: Simple Redirect (Still Supported):**
```javascript
function loginWithGoogle() {
  // Get provider info from discovery
  const provider = providers.find(p => p.id === 'google');
  
  // Simply redirect - TMI handles everything
  window.location.href = provider.auth_url;
}
```

### Step 2: TMI Handles OAuth

TMI server automatically:
- Generates secure state parameters
- Redirects to OAuth provider
- Handles authorization code exchange
- Creates or updates user accounts
- Generates JWT tokens

### Step 3: Handle Callback

**With Client Callback Parameter (Recommended):**

When you include the `client_callback` parameter, TMI will redirect to your specified URL with tokens:

```javascript
// Handle OAuth callback on your client callback page
// URL will be: http://localhost:4200/auth/callback?access_token=...&refresh_token=...&expires_in=3600&state=...
function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  
  const accessToken = urlParams.get('access_token');
  const refreshToken = urlParams.get('refresh_token');
  const expiresIn = urlParams.get('expires_in');
  const tokenType = urlParams.get('token_type');
  const state = urlParams.get('state');
  const error = urlParams.get('error');
  
  if (error) {
    handleOAuthError(error);
    return;
  }
  
  // Verify state parameter (CSRF protection)
  const storedState = localStorage.getItem('oauth_state');
  if (state !== storedState) {
    console.error('State mismatch - possible CSRF attack');
    handleOAuthError('invalid_state');
    return;
  }
  
  // Clear stored state
  localStorage.removeItem('oauth_state');
  
  if (accessToken) {
    // Store tokens securely
    const expirationTime = Date.now() + (parseInt(expiresIn) * 1000);
    localStorage.setItem('tmi_access_token', accessToken);
    localStorage.setItem('tmi_refresh_token', refreshToken);
    localStorage.setItem('tmi_token_expires', expirationTime);
    
    // Clean URL (remove tokens from address bar)
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Redirect to main application
    window.location.href = '/dashboard';
  }
}

// Call on your OAuth callback page
if (window.location.pathname === '/auth/callback') {
  handleOAuthCallback();
}
```

**Legacy: Direct JSON Response (Still Supported):**

If you don't provide a `client_callback` parameter, TMI returns tokens as JSON:

```javascript
// This is the legacy behavior - TMI returns JSON directly
// Not recommended for browser applications due to URL limitations
```

## Token Management

### Token Storage

```javascript
class TokenManager {
  setTokens(accessToken, refreshToken, expiresIn) {
    const expirationTime = Date.now() + (expiresIn * 1000);
    
    localStorage.setItem('tmi_access_token', accessToken);
    localStorage.setItem('tmi_refresh_token', refreshToken);
    localStorage.setItem('tmi_token_expires', expirationTime);
  }
  
  getAccessToken() {
    const token = localStorage.getItem('tmi_access_token');
    const expires = localStorage.getItem('tmi_token_expires');
    
    if (!token || Date.now() > parseInt(expires)) {
      return null; // Token expired
    }
    
    return token;
  }
  
  isTokenExpired() {
    const expires = localStorage.getItem('tmi_token_expires');
    return Date.now() > parseInt(expires);
  }
}
```

### Automatic Token Refresh

```javascript
class APIClient {
  constructor() {
    this.tokenManager = new TokenManager();
    this.baseURL = 'http://localhost:8080';
  }
  
  async makeRequest(endpoint, options = {}) {
    let token = this.tokenManager.getAccessToken();
    
    // Refresh token if expired
    if (!token || this.tokenManager.isTokenExpired()) {
      token = await this.refreshToken();
    }
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (response.status === 401) {
      // Token invalid, try refresh
      token = await this.refreshToken();
      
      if (token) {
        // Retry original request
        return fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        });
      } else {
        // Refresh failed, redirect to login
        this.redirectToLogin();
      }
    }
    
    return response;
  }
  
  async refreshToken() {
    const refreshToken = localStorage.getItem('tmi_refresh_token');
    if (!refreshToken) {
      this.redirectToLogin();
      return null;
    }
    
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      
      if (response.ok) {
        const tokens = await response.json();
        this.tokenManager.setTokens(
          tokens.access_token,
          tokens.refresh_token,
          tokens.expires_in
        );
        return tokens.access_token;
      } else {
        // Refresh failed
        this.redirectToLogin();
        return null;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.redirectToLogin();
      return null;
    }
  }
  
  redirectToLogin() {
    localStorage.clear();
    window.location.href = '/login';
  }
}
```

### API Requests with Auto-Auth

```javascript
const api = new APIClient();

// All requests automatically handle authentication
async function loadDiagrams() {
  const response = await api.makeRequest('/diagrams');
  const diagrams = await response.json();
  return diagrams;
}
```

## Error Handling

### OAuth Errors

```javascript
function handleOAuthError(error, errorDescription) {
  const errorMap = {
    'access_denied': 'User cancelled authorization',
    'invalid_request': 'Invalid OAuth request',
    'unauthorized_client': 'Client not authorized',
    'unsupported_response_type': 'OAuth configuration error',
    'invalid_scope': 'Invalid permissions requested',
    'server_error': 'OAuth provider error',
    'temporarily_unavailable': 'OAuth provider temporarily unavailable'
  };
  
  const userMessage = errorMap[error] || 'Authentication failed';
  
  // Show user-friendly error
  showNotification(userMessage, 'error');
  
  // Log technical details
  console.error('OAuth Error:', error, errorDescription);
  
  // Redirect back to login
  setTimeout(() => {
    window.location.href = '/login';
  }, 3000);
}
```

### API Errors

```javascript
async function handleAPIError(response) {
  if (response.status === 401) {
    // Token expired or invalid
    await api.refreshToken();
    return;
  }
  
  if (response.status === 403) {
    showNotification('Access denied. Check your permissions.', 'error');
    return;
  }
  
  if (response.status >= 500) {
    showNotification('Server error. Please try again later.', 'error');
    return;
  }
  
  // Parse error details
  try {
    const errorData = await response.json();
    showNotification(errorData.error || 'Request failed', 'error');
  } catch {
    showNotification('Request failed', 'error');
  }
}
```

### Network Errors

```javascript
async function makeRobustRequest(endpoint, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await api.makeRequest(endpoint, options);
      
      if (response.ok) {
        return response;
      } else {
        await handleAPIError(response);
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      if (i === retries - 1) {
        // Last retry failed
        showNotification('Network error. Please check your connection.', 'error');
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

## Best Practices

### Security

1. **Use HTTPS in production**
2. **Store tokens securely** (consider httpOnly cookies for sensitive apps)
3. **Implement token refresh** before expiration
4. **Clear tokens on logout**
5. **Validate tokens** on critical operations

```javascript
// Secure token storage for sensitive applications
class SecureTokenManager {
  async setTokens(accessToken, refreshToken) {
    // Store refresh token in httpOnly cookie (server-side)
    await fetch('/api/store-refresh-token', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ refreshToken })
    });
    
    // Store access token in memory only
    this.accessToken = accessToken;
    this.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour
  }
}
```

### User Experience

1. **Show loading states** during OAuth flows
2. **Handle popup blockers** if using popups
3. **Provide clear error messages**
4. **Remember user's preferred provider**

```javascript
// Remember user's preferred OAuth provider
function rememberProvider(providerId) {
  localStorage.setItem('preferred_oauth_provider', providerId);
}

function getPreferredProvider() {
  return localStorage.getItem('preferred_oauth_provider');
}

// Auto-select last used provider
function initializeLoginUI() {
  const preferred = getPreferredProvider();
  if (preferred) {
    const button = document.querySelector(`[data-provider="${preferred}"]`);
    if (button) {
      button.classList.add('preferred');
    }
  }
}
```

### Performance

1. **Cache provider discovery** results
2. **Implement request debouncing**
3. **Use connection pooling**

```javascript
// Cache providers to avoid repeated API calls
class ProviderCache {
  constructor() {
    this.providers = null;
    this.lastFetch = 0;
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }
  
  async getProviders() {
    const now = Date.now();
    
    if (!this.providers || (now - this.lastFetch) > this.cacheDuration) {
      const response = await fetch('/auth/providers');
      this.providers = await response.json();
      this.lastFetch = now;
    }
    
    return this.providers;
  }
}
```

## Troubleshooting

### Common Issues

**Issue: "Invalid state parameter" error**
```
Solution: Ensure your client is redirecting to TMI's auth endpoints, 
not directly to OAuth providers.

✗ Wrong: https://accounts.google.com/o/oauth2/auth
✓ Correct: http://localhost:8080/auth/login/google
```

**Issue: "Failed to exchange authorization code"**
```
Solution: Check that:
1. OAuth provider redirect URI matches TMI's callback URL
2. Client ID/secret are correctly configured in TMI
3. OAuth app is enabled and published
```

**Issue: Tokens not being received**
```
Solution: Check:
1. TMI callback configuration
2. Client callback URL handling
3. Browser network logs for actual response
```

**Issue: 401 errors on API calls**
```
Solution: Verify:
1. Access token is being sent in Authorization header
2. Token hasn't expired
3. Token refresh mechanism is working
```

### Debug Tools

**Check OAuth Configuration:**
```bash
curl http://localhost:8080/auth/providers | jq
```

**Test Token Validation:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/auth/me
```

**Monitor Network Traffic:**
- Use browser DevTools Network tab
- Check for CORS issues
- Verify request/response formats

### Getting Help

1. **Check TMI server logs** for detailed error messages
2. **Use browser DevTools** to inspect network requests
3. **Test OAuth flow** step by step
4. **Verify environment configuration** in TMI server

---

## Complete Example

Here's a complete working example of OAuth integration:

```html
<!DOCTYPE html>
<html>
<head>
    <title>TMI OAuth Example</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div id="login-container">
        <h1>Sign in to TMI</h1>
        <div id="providers-container"></div>
    </div>

    <div id="app-container" style="display: none;">
        <h1>Welcome!</h1>
        <button onclick="logout()">Logout</button>
        <div id="user-info"></div>
    </div>

    <script>
        class TMIAuth {
            constructor() {
                this.baseURL = 'http://localhost:8080';
                this.init();
            }

            async init() {
                // Check if user is already authenticated
                if (this.isAuthenticated()) {
                    this.showApp();
                } else {
                    await this.loadProviders();
                    this.checkOAuthCallback();
                }
            }

            isAuthenticated() {
                const token = localStorage.getItem('tmi_access_token');
                const expires = localStorage.getItem('tmi_token_expires');
                return token && Date.now() < parseInt(expires);
            }

            async loadProviders() {
                try {
                    const response = await fetch(`${this.baseURL}/auth/providers`);
                    const { providers } = await response.json();
                    this.renderProviders(providers);
                } catch (error) {
                    console.error('Failed to load providers:', error);
                }
            }

            renderProviders(providers) {
                const container = document.getElementById('providers-container');
                container.innerHTML = providers.map(provider => `
                    <button onclick="auth.login('${provider.auth_url}')" class="oauth-btn">
                        <i class="${provider.icon}"></i>
                        Sign in with ${provider.name}
                    </button>
                `).join('');
            }

            login(authUrl) {
                // Generate state for CSRF protection
                const state = this.generateRandomState();
                localStorage.setItem('oauth_state', state);
                
                // Define client callback URL
                const clientCallbackUrl = `${window.location.origin}/auth/callback`;
                
                // Build OAuth URL with state and client callback
                const separator = authUrl.includes('?') ? '&' : '?';
                const fullAuthUrl = `${authUrl}${separator}state=${state}&client_callback=${encodeURIComponent(clientCallbackUrl)}`;
                
                // Redirect to TMI OAuth endpoint
                window.location.href = fullAuthUrl;
            }

            generateRandomState() {
                return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            }

            checkOAuthCallback() {
                // Only handle callback if we're on the callback path
                if (window.location.pathname !== '/auth/callback') {
                    return;
                }

                const urlParams = new URLSearchParams(window.location.search);
                const accessToken = urlParams.get('access_token');
                const refreshToken = urlParams.get('refresh_token');
                const expiresIn = urlParams.get('expires_in');
                const state = urlParams.get('state');
                const error = urlParams.get('error');

                if (error) {
                    alert('Authentication failed: ' + error);
                    return;
                }

                // Verify state parameter
                const storedState = localStorage.getItem('oauth_state');
                if (state !== storedState) {
                    console.error('State mismatch - possible CSRF attack');
                    alert('Authentication failed: Invalid state parameter');
                    return;
                }

                // Clear stored state
                localStorage.removeItem('oauth_state');

                if (accessToken) {
                    this.setTokens(accessToken, refreshToken, expiresIn);
                    // Clean URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                    // Redirect to main app
                    window.location.href = '/';
                }
            }

            setTokens(accessToken, refreshToken, expiresIn) {
                const expirationTime = Date.now() + (parseInt(expiresIn) * 1000);
                
                localStorage.setItem('tmi_access_token', accessToken);
                localStorage.setItem('tmi_refresh_token', refreshToken);
                localStorage.setItem('tmi_token_expires', expirationTime);
            }

            async showApp() {
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('app-container').style.display = 'block';
                
                // Load user info
                try {
                    const response = await this.makeAuthenticatedRequest('/auth/me');
                    const user = await response.json();
                    document.getElementById('user-info').innerHTML = `
                        <p>Email: ${user.email}</p>
                        <p>Name: ${user.name}</p>
                    `;
                } catch (error) {
                    console.error('Failed to load user info:', error);
                }
            }

            async makeAuthenticatedRequest(endpoint) {
                const token = localStorage.getItem('tmi_access_token');
                return fetch(`${this.baseURL}${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }

            logout() {
                localStorage.clear();
                window.location.reload();
            }
        }

        // Initialize
        const auth = new TMIAuth();
    </script>

    <style>
        .oauth-btn {
            display: block;
            width: 200px;
            margin: 10px auto;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            background: white;
            cursor: pointer;
            font-size: 16px;
        }
        .oauth-btn:hover {
            background: #f5f5f5;
        }
        .oauth-btn i {
            margin-right: 10px;
        }
    </style>
</body>
</html>
```

This example provides a complete OAuth integration that discovers providers, handles the OAuth flow, and manages tokens automatically.