import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files from the Angular app build output
app.use(express.static(path.join(__dirname, 'dist/tmi-ux')));

// For all GET requests, serve the Angular index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/tmi-ux/index.html'));
});

// Use the port provided by Heroku or default to 8080
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});