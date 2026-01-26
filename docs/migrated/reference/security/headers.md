# Security Headers Configuration Guide

This guide provides comprehensive instructions for configuring HTTP security headers for the TMI-UX application across different deployment scenarios.

## Table of Contents

1. [Overview](#overview)
2. [Security Headers Explained](#security-headers-explained)
3. [Deployment Scenarios](#deployment-scenarios)
4. [Configuration Examples](#configuration-examples)
5. [Testing and Validation](#testing-and-validation)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Overview

TMI-UX implements a multi-layered security approach:

1. **Dynamic CSP**: Content Security Policy is dynamically generated based on environment configuration
2. **Additional Headers**: Configured at the deployment level (proxy/load balancer)
3. **Adaptive HSTS**: Enabled only when TLS is available

### Dynamic CSP Implementation

The application dynamically generates and injects a CSP meta tag that:

- **Automatically includes your API URL** from environment configuration
- Supports both HTTP and HTTPS API endpoints
- XSS protection by restricting script sources
- Clickjacking prevention via `frame-ancestors`
- Mixed content protection with `upgrade-insecure-requests` (HTTPS only)
- WebSocket support for real-time collaboration
- Google Fonts integration support
- OAuth callback support from any HTTPS provider

#### How Dynamic CSP Works

1. On application startup, the `SecurityConfigService` reads the API URL from environment configuration
2. It extracts the API origin (e.g., `http://localhost:8080` or `https://api.example.com`)
3. The API origin is automatically added to the `connect-src` directive
4. A CSP meta tag is dynamically created and injected into the document head
5. This ensures API calls and WebSocket connections work regardless of API location

## Security Headers Explained

### Content-Security-Policy (CSP)

**Purpose**: Prevents XSS attacks by controlling resource loading  
**Status**: ✅ Implemented via dynamic injection  
**Generated Value Example**:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:;
img-src 'self' data: https: blob:;
connect-src 'self' http://localhost:8080 wss: ws: https:;
base-uri 'self';
form-action 'self';
object-src 'none';
media-src 'self';
worker-src 'self' blob:;
manifest-src 'self'
```

**Important CSP Limitations with Meta Tags**:

- `frame-ancestors` directive is **ignored** in meta tags (use X-Frame-Options header instead)
- `report-uri` and `report-to` directives are **ignored** in meta tags
- `sandbox` directive is **ignored** in meta tags
- These directives **must be set via HTTP headers** at the server/proxy level

**Key Features**:

- `connect-src` automatically includes your API URL from environment
- Supports WebSocket protocols (`ws:` and `wss:`)
- Allows HTTPS for OAuth callbacks
- Upgrades insecure requests in production

### X-Frame-Options

**Purpose**: Prevents clickjacking attacks  
**Recommended**: `DENY` or `SAMEORIGIN`  
**Status**: ⚠️ Requires deployment configuration

**Why This Header is Critical**:
Since the CSP `frame-ancestors` directive doesn't work in meta tags, the `X-Frame-Options` header is your primary defense against clickjacking attacks. This header **must** be set at the server level.

### X-Content-Type-Options

**Purpose**: Prevents MIME type sniffing  
**Recommended**: `nosniff`  
**Status**: ⚠️ Requires deployment configuration

### Strict-Transport-Security (HSTS)

**Purpose**: Forces HTTPS connections  
**Recommended**: `max-age=31536000; includeSubDomains`  
**Status**: ⚠️ Requires TLS and deployment configuration

### Referrer-Policy

**Purpose**: Controls referrer information sent with requests  
**Recommended**: `strict-origin-when-cross-origin`  
**Status**: ⚠️ Requires deployment configuration

### Permissions-Policy

**Purpose**: Controls browser features and APIs  
**Recommended**: `camera=(), microphone=(), geolocation=()`  
**Status**: ⚠️ Requires deployment configuration

## Deployment Scenarios

### Scenario 1: Standalone Application

When running the application directly (e.g., `ng serve` or serving static files):

**Security Features**:

- ✅ Dynamic CSP with API URL auto-configuration
- ✅ Same-origin policy (browser-enforced)
- ✅ CORS (handled by Angular)
- ✅ API connections automatically allowed
- ❌ Additional security headers (not available)

**When to Use**:

- Development environments
- Internal networks with controlled access
- Testing and demos

**Limitations**:

- Cannot set HTTP response headers
- No HSTS support
- Limited defense-in-depth

### Scenario 2: Behind a Local Proxy (nginx/Apache)

When running behind a reverse proxy on the same server:

**Security Features**:

- ✅ All headers can be configured
- ✅ TLS termination at proxy
- ✅ Full control over security policies

**Configuration Required**:

- Proxy server configuration
- TLS certificates
- Header directives

### Scenario 3: Behind a Load Balancer

When running behind a cloud load balancer (AWS ALB, Azure Application Gateway, etc.):

**Security Features**:

- ✅ Headers configured at load balancer
- ✅ TLS termination at load balancer
- ✅ Geographic distribution

**Considerations**:

- WebSocket support configuration
- Health check endpoints
- Session affinity for real-time features

## Configuration Examples

### nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name tmi.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "0" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # HSTS - only with HTTPS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Remove server version
    server_tokens off;

    location / {
        root /var/www/tmi-ux;
        try_files $uri $uri/ /index.html;

        # Additional security for static files
        add_header X-Frame-Options "DENY" always;
        add_header Cache-Control "public, max-age=3600";
    }

    # WebSocket support
    location /ws {
        proxy_pass http://backend:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name tmi.example.com;
    return 301 https://$server_name$request_uri;
}
```

### Apache Configuration

```apache
<VirtualHost *:443>
    ServerName tmi.example.com
    DocumentRoot /var/www/tmi-ux

    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem

    # Security headers
    Header always set X-Frame-Options "DENY"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "0"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"

    # HSTS
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"

    # Remove server version
    ServerTokens Prod
    ServerSignature Off

    <Directory /var/www/tmi-ux>
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted

        # Enable Angular routing
        FallbackResource /index.html
    </Directory>

    # WebSocket proxy
    ProxyPass /ws ws://backend:8080/ws
    ProxyPassReverse /ws ws://backend:8080/ws
</VirtualHost>

# HTTP to HTTPS redirect
<VirtualHost *:80>
    ServerName tmi.example.com
    Redirect permanent / https://tmi.example.com/
</VirtualHost>
```

### AWS Application Load Balancer

Configure response headers in your ALB rules:

```json
{
  "Type": "fixed-response",
  "FixedResponseConfig": {
    "StatusCode": "200",
    "ResponseHeaders": [
      {
        "Key": "X-Frame-Options",
        "Value": "DENY"
      },
      {
        "Key": "X-Content-Type-Options",
        "Value": "nosniff"
      },
      {
        "Key": "Strict-Transport-Security",
        "Value": "max-age=31536000; includeSubDomains"
      },
      {
        "Key": "Referrer-Policy",
        "Value": "strict-origin-when-cross-origin"
      },
      {
        "Key": "Permissions-Policy",
        "Value": "camera=(), microphone=(), geolocation=()"
      }
    ]
  }
}
```

### Docker Compose with nginx

```yaml
version: '3.8'
services:
  tmi-ux:
    image: nginx:alpine
    ports:
      - '443:443'
      - '80:80'
    volumes:
      - ./dist/tmi-ux:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certs:/etc/nginx/certs:ro
    environment:
      - NGINX_HOST=tmi.example.com
      - NGINX_PORT=443
```

## Configuring API URLs

The dynamic CSP automatically adapts to your API configuration:

### Development

```typescript
// environment.dev.ts
export const environment = {
  apiUrl: 'http://localhost:8080',
  // CSP will allow: connect-src 'self' http://localhost:8080 ...
};
```

### Production

```typescript
// environment.prod.ts
export const environment = {
  apiUrl: 'https://api.example.com/v1',
  // CSP will allow: connect-src 'self' https://api.example.com ...
};
```

### Multiple API Endpoints

If you need to connect to multiple APIs, you'll need to configure your proxy or use CORS:

- For development: Configure Angular CLI proxy
- For production: Use reverse proxy to route API calls through same origin

## Testing and Validation

### 1. Manual Testing

Open browser developer tools and check:

- Network tab → Response headers
- Console → CSP violations
- Security tab (Chrome/Edge)

### 2. Online Tools

- [Security Headers Scanner](https://securityheaders.com)
- [Mozilla Observatory](https://observatory.mozilla.org)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com)

### 3. Command Line Testing

```bash
# Check headers
curl -I https://tmi.example.com

# Check specific header
curl -s -I https://tmi.example.com | grep -i "strict-transport-security"

# Test CSP
curl -s https://tmi.example.com | grep -i "content-security-policy"
```

### 4. Automated Testing

Use the provided security check script:

```bash
pnpm run check:security
```

## Troubleshooting

### Common Issues

#### 1. CSP Blocking Resources

**Symptom**: Console errors about blocked resources  
**Solution**: Check CSP directives in `index.html`

```
Refused to load the stylesheet 'https://example.com/style.css' because it violates the following Content Security Policy directive: "style-src 'self'"
```

#### 2. WebSocket Connection Failures

**Symptom**: Real-time features not working  
**Solution**: Ensure `connect-src` includes `wss:` and `ws:`

#### 3. HSTS Issues

**Symptom**: Certificate errors after enabling HSTS  
**Solution**:

- Ensure valid TLS certificate
- Clear browser HSTS cache if needed
- Start with shorter max-age during testing

#### 4. Mixed Content Warnings

**Symptom**: Browser blocking HTTP resources on HTTPS site  
**Solution**: CSP includes `upgrade-insecure-requests`

### Debug Mode

Enable security debugging in development:

```typescript
// main.ts
import { SecurityConfigService } from './app/core/services/security-config.service';

// In your app initialization
const securityConfig = inject(SecurityConfigService);
securityConfig.monitorSecurityViolations();
```

## Best Practices

### 1. Progressive Enhancement

Start with basic security and enhance gradually:

1. CSP meta tag (immediate protection)
2. Basic security headers
3. HSTS (after TLS is stable)
4. Advanced CSP (remove unsafe-inline)

### 2. Environment-Specific Configuration

```typescript
// environment.prod.ts
export const environment = {
  production: true,
  securityConfig: {
    enableHSTS: true,
    hstsMaxAge: 31536000,
    hstsIncludeSubDomains: true,
    cspReportUri: 'https://api.example.com/csp-report',
  },
};
```

### 3. Monitoring

- Set up CSP reporting endpoint
- Monitor security header compliance
- Track CSP violations
- Regular security audits

### 4. TLS Certificate Management

- Use trusted Certificate Authority
- Automate renewal (Let's Encrypt)
- Monitor expiration
- Test with SSL Labs

### 5. WebSocket Security

- Use WSS (WebSocket Secure) only
- Validate origin headers
- Implement authentication
- Rate limit connections

## Migration Checklist

When deploying TMI-UX with security headers:

- [ ] CSP meta tag is present in index.html
- [ ] Deployment method chosen (standalone/proxy/load balancer)
- [ ] Security headers configured at deployment level
- [ ] TLS certificate obtained and configured
- [ ] WebSocket proxy/forwarding configured
- [ ] Security headers tested with online tools
- [ ] CSP violations monitored
- [ ] HSTS enabled (production only)
- [ ] Documentation updated with actual values
- [ ] Monitoring and alerting configured

## Additional Resources

- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [Angular Security Guide](https://angular.dev/best-practices/security)

<!--
VERIFICATION SUMMARY
Verified on: 2026-01-25
Agent: verify-migrate-doc

Verified items:
- SecurityConfigService exists: Verified at src/app/core/services/security-config.service.ts
- injectDynamicCSP method: Verified in SecurityConfigService (line 218-299)
- monitorSecurityViolations method: Verified in SecurityConfigService (line 205-216)
- CSP dynamic injection on startup: Verified in app.config.ts via APP_INITIALIZER
- API URL extraction for CSP: Verified in injectDynamicCSP() using environment.apiUrl
- environment.dev.ts apiUrl: Verified as 'http://localhost:8080'
- environment.prod.ts apiUrl: Verified as 'https://api.example.com/v1'
- securityConfig in environment files: Verified in both dev and prod environment files
- pnpm run check:security script: Verified in package.json (line 49)
- check-security.ts script: Verified at scripts/check-security.ts
- Dynamic CSP comment in index.html: Verified at src/index.html (line 8)
- CSP frame-ancestors meta tag limitation: Verified via MDN documentation (2 sources)
- X-XSS-Protection "0" recommendation: Verified via OWASP and MDN documentation (2+ sources)
- nginx add_header always directive: Verified via official nginx documentation
- securityheaders.com tool: Verified via multiple independent sources
- Mozilla Observatory: Verified via Mozilla official documentation
- CSP Evaluator by Google: Verified via Google GitHub repository and Chrome Web Store
- MDN Web Security URL: Verified as https://developer.mozilla.org/en-US/docs/Web/Security
- OWASP Secure Headers Project URL: Verified as https://owasp.org/www-project-secure-headers/
- Content Security Policy Reference URL: Verified as https://content-security-policy.com/
- Angular Security Guide URL: Updated from angular.io/guide/security to angular.dev/best-practices/security
- CDN sources in CSP (cdnjs.cloudflare.com): Verified as used in index.html for FontAwesome

Corrections made:
- CSP example: Added cdnjs.cloudflare.com to style-src and font-src (matching actual implementation)
- npm run check:security: Changed to pnpm run check:security (project uses pnpm)
- Angular Security Guide URL: Updated to current URL (angular.dev/best-practices/security)

Items needing review:
- None identified
-->
