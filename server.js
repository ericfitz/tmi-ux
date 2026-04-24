import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Optional reverse proxy for the TMI backend API.
// When TMI_ENABLE_API_PROXY=true and TMI_PROXY_TARGET is set, tmi-ux proxies
// all /api/* requests (including WebSocket upgrades) to the backend, allowing
// a single HTTPS endpoint to serve both the SPA and the API.
const apiProxyEnabled = process.env.TMI_ENABLE_API_PROXY === 'true';
const apiProxyTarget = process.env.TMI_PROXY_TARGET;
const API_PROXY_PATH = '/api';

let apiProxy = null;
if (apiProxyEnabled) {
  if (!apiProxyTarget) {
    console.error(
      'TMI_ENABLE_API_PROXY=true but TMI_PROXY_TARGET is not set; refusing to start with misconfigured proxy.'
    );
    process.exit(1);
  }
  apiProxy = createProxyMiddleware({
    target: apiProxyTarget,
    changeOrigin: true,
    ws: true,
    pathRewrite: { [`^${API_PROXY_PATH}`]: '' },
    logger: console,
  });
  app.use(API_PROXY_PATH, apiProxy);
}

// Set up a basic rate limiter for static file server
// More permissive limits since this serves an SPA with many static assets
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs (static files + API health checks)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply the rate limiter to all requests
app.use(limiter);

// Serve runtime configuration from environment variables.
// The Angular app fetches this before bootstrap to override compiled-in defaults.
// Only properties with corresponding TMI_* env vars set are included.
// When no TMI_* vars are set, returns {} (no-op for the client).
app.get('/config.json', (req, res) => {
  const config = {};

  if (process.env.TMI_API_URL) {
    config.apiUrl = process.env.TMI_API_URL;
  } else if (apiProxyEnabled) {
    // When proxying the API, point the client at the same-origin proxy path.
    config.apiUrl = API_PROXY_PATH;
  }
  if (process.env.TMI_LOG_LEVEL) config.logLevel = process.env.TMI_LOG_LEVEL;
  if (process.env.TMI_OPERATOR_NAME) config.operatorName = process.env.TMI_OPERATOR_NAME;
  if (process.env.TMI_OPERATOR_CONTACT) config.operatorContact = process.env.TMI_OPERATOR_CONTACT;
  if (process.env.TMI_OPERATOR_JURISDICTION) {
    config.operatorJurisdiction = process.env.TMI_OPERATOR_JURISDICTION;
  }
  if (process.env.TMI_AUTH_TOKEN_EXPIRY_MINUTES) {
    config.authTokenExpiryMinutes = parseInt(process.env.TMI_AUTH_TOKEN_EXPIRY_MINUTES, 10);
  }
  if (process.env.TMI_DEFAULT_AUTH_PROVIDER) {
    config.defaultAuthProvider = process.env.TMI_DEFAULT_AUTH_PROVIDER;
  }
  if (process.env.TMI_DEFAULT_THREAT_MODEL_FRAMEWORK) {
    config.defaultThreatModelFramework = process.env.TMI_DEFAULT_THREAT_MODEL_FRAMEWORK;
  }
  if (process.env.TMI_ENABLE_CONFIDENTIAL_THREAT_MODELS !== undefined) {
    config.enableConfidentialThreatModels =
      process.env.TMI_ENABLE_CONFIDENTIAL_THREAT_MODELS === 'true';
  }
  if (process.env.TMI_SUPPRESS_ABOUT_LINK !== undefined) {
    config.suppressAboutLink = process.env.TMI_SUPPRESS_ABOUT_LINK === 'true';
  }
  if (process.env.TMI_SUPPRESS_PRIVACY_TOS_LINKS !== undefined) {
    config.suppressPrivacyTosLinks = process.env.TMI_SUPPRESS_PRIVACY_TOS_LINKS === 'true';
  }

  const securityConfig = {};
  let hasSecurityConfig = false;
  if (process.env.TMI_SECURITY_ENABLE_HSTS !== undefined) {
    securityConfig.enableHSTS = process.env.TMI_SECURITY_ENABLE_HSTS === 'true';
    hasSecurityConfig = true;
  }
  if (process.env.TMI_SECURITY_HSTS_MAX_AGE) {
    securityConfig.hstsMaxAge = parseInt(process.env.TMI_SECURITY_HSTS_MAX_AGE, 10);
    hasSecurityConfig = true;
  }
  if (process.env.TMI_SECURITY_FRAME_OPTIONS) {
    securityConfig.frameOptions = process.env.TMI_SECURITY_FRAME_OPTIONS;
    hasSecurityConfig = true;
  }
  if (process.env.TMI_SECURITY_REFERRER_POLICY) {
    securityConfig.referrerPolicy = process.env.TMI_SECURITY_REFERRER_POLICY;
    hasSecurityConfig = true;
  }
  if (process.env.TMI_SECURITY_PERMISSIONS_POLICY) {
    securityConfig.permissionsPolicy = process.env.TMI_SECURITY_PERMISSIONS_POLICY;
    hasSecurityConfig = true;
  }
  if (hasSecurityConfig) {
    config.securityConfig = securityConfig;
  }

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json(config);
});

// Long-lived cache for self-hosted font files (used by PDF report generation).
// Font filenames contain version identifiers; cache is busted by redeployment.
app.use(
  '/assets/fonts',
  express.static(path.join(__dirname, 'dist/tmi-ux/browser/assets/fonts'), {
    maxAge: '1y',
    immutable: true,
  })
);

// Serve static files from the Angular app build output
app.use(express.static(path.join(__dirname, 'dist/tmi-ux/browser')));

// For all GET requests not matching static files, serve the Angular index.html (SPA fallback)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist/tmi-ux/browser/index.html'));
});

// Use the port provided by Heroku or default to 8080
const port = process.env.PORT || 8080;
const httpServer = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  if (apiProxyEnabled) {
    console.log(`API proxy enabled: ${API_PROXY_PATH} -> ${apiProxyTarget}`);
  }
});

// http-proxy-middleware handles HTTP via app.use(), but WebSocket upgrades
// must be routed via the server's 'upgrade' event.
if (apiProxy) {
  httpServer.on('upgrade', apiProxy.upgrade);
}