import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

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

// Serve static files from the Angular app build output
app.use(express.static(path.join(__dirname, 'dist/tmi-ux/browser')));

// For all GET requests not matching static files, serve the Angular index.html (SPA fallback)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist/tmi-ux/browser/index.html'));
});

// Use the port provided by Heroku or default to 8080
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});