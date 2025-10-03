# Heroku Deployment Guide

This guide explains how to deploy tmi-ux to Heroku.

## Prerequisites

- Heroku CLI installed and authenticated
- Access to the `tmi-ux` Heroku app

## How It Works

The deployment uses a simplified approach:

1. **Build-time Configuration**: Angular apps require environment variables to be baked into the build at compile time (they can't use runtime env vars)
2. **Environment File**: A Heroku-specific environment file (`environment.heroku.ts`) contains all configuration
3. **Build Configuration**: Angular's `heroku` build configuration uses this environment file
4. **Server Start**: Express server serves the built Angular app

## Deployment Steps

### 1. Create Environment File

Before first deployment, run the configuration script to create `environment.heroku.ts`:

```bash
bash scripts/configure-heroku-env.sh
```

This creates `src/environments/environment.heroku.ts` with:
- `apiUrl`: https://api.tmi.dev
- `operatorName`: TMI Project (Development Demo)
- `operatorContact`: github@efitz.net
- `operatorJurisdiction`: Florida, United States of America
- `logLevel`: INFO
- `authTokenExpiryMinutes`: 60
- Security headers configured for production

**Note**: This file is gitignored and only exists locally/on Heroku build servers.

### 2. Deploy to Heroku

```bash
git push heroku main
```

This triggers:
1. Heroku installs dependencies using pnpm (via buildpack)
2. Runs `heroku-postbuild` which builds Angular with `--configuration=heroku`
3. Starts the Express server via `npm start`

**Note**: `PORT` is automatically set by Heroku and should not be configured manually.

### 3. Verify Deployment

Check the app status:
```bash
heroku logs --tail --app tmi-ux
```

Visit the app:
```bash
heroku open --app tmi-ux
```

## Buildpacks

The app uses two buildpacks (in order):
1. `heroku/nodejs` - Node.js support
2. `https://github.com/unfold/heroku-buildpack-pnpm` - pnpm package manager

View configured buildpacks:
```bash
heroku buildpacks --app tmi-ux
```

## Modifying Configuration

To change the Heroku environment configuration:

1. Edit the values in `scripts/configure-heroku-env.sh`
2. Run the script to regenerate `environment.heroku.ts`:
   ```bash
   bash scripts/configure-heroku-env.sh
   ```
3. Commit the script changes (but NOT environment.heroku.ts - it's gitignored)
4. Deploy:
   ```bash
   git push heroku main
   ```

Alternatively, manually edit `src/environments/environment.heroku.ts` locally before deploying.

## Troubleshooting

### Build Failures

Check build logs:
```bash
heroku logs --tail --app tmi-ux
```

Common issues:
- **Missing buildpack**: Ensure pnpm buildpack is added
- **Missing environment.heroku.ts**: Run `scripts/configure-heroku-env.sh` before deploying
- **Build timeout**: Check for large dependencies

### Runtime Errors

Check application logs:
```bash
heroku logs --tail --app tmi-ux
```

### Server Won't Start

The server uses `process.env.PORT` which Heroku sets automatically. If the server fails to start, check that:
- `Procfile` contains: `web: npm start`
- `server.js` uses: `const port = process.env.PORT || 8080`

## Files Involved

- `scripts/configure-heroku-env.sh` - Generates environment.heroku.ts
- `src/environments/environment.heroku.ts` - Heroku environment config (gitignored)
- `angular.json` - Contains `heroku` build configuration
- `Procfile` - Tells Heroku how to run the app
- `package.json` - Contains `heroku-postbuild` and `build:heroku` scripts
- `server.js` - Express server that serves the Angular app

## Architecture Note

Unlike typical server apps that read environment variables at runtime, Angular applications require environment configuration at build time. The configuration values are compiled directly into the JavaScript bundle.

We use a gitignored `environment.heroku.ts` file that must exist before building. This keeps deployment simple while preventing sensitive configuration from being committed to the repository.
