# Heroku Deployment Guide

This guide explains how to deploy tmi-ux to Heroku.

## Prerequisites

- Heroku CLI installed and authenticated
- Access to the `tmi-ux` Heroku app

## How It Works

The deployment uses a simplified approach:

1. **Build-time Configuration**: Angular apps require environment variables to be baked into the build at compile time (they can't use runtime env vars)
2. **Environment File**: A hosted-container-specific environment file (`environment.hosted-container.ts`) contains all configuration
3. **Build Configuration**: Angular's `hosted-container` build configuration uses this environment file
4. **Server Start**: Express server serves the built Angular app

## Deployment Steps

### Deploy to Heroku

```bash
git push heroku main
```

This triggers:

1. Heroku installs dependencies using pnpm (via buildpack)
2. Runs `heroku-postbuild` which builds Angular with `--configuration=hosted-container`
3. Starts the Express server via `npm start`

**Note**: `PORT` is automatically set by Heroku and should not be configured manually.

### Verify Deployment

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

1. Edit `src/environments/environment.hosted-container.ts` directly, or
2. Edit values in `scripts/configure-heroku-env.sh` and run it to regenerate the file:
   ```bash
   bash scripts/configure-heroku-env.sh
   ```
3. Commit the changes:
   ```bash
   git add src/environments/environment.hosted-container.ts
   git commit -m "Update Heroku configuration"
   ```
4. Deploy:
   ```bash
   git push heroku main
   ```

## Troubleshooting

### Build Failures

Check build logs:

```bash
heroku logs --tail --app tmi-ux
```

Common issues:

- **Missing buildpack**: Ensure pnpm buildpack is added
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

- `scripts/configure-heroku-env.sh` - Script to generate environment.hosted-container.ts
- `src/environments/environment.hosted-container.ts` - Heroku environment config (committed to repo)
- `angular.json` - Contains `hosted-container` build configuration
- `Procfile` - Tells Heroku how to run the app
- `package.json` - Contains `heroku-postbuild` and `build:hosted-container` scripts
- `server.js` - Express server that serves the Angular app

## Architecture Note

Unlike typical server apps that read environment variables at runtime, Angular applications require environment configuration at build time. The configuration values are compiled directly into the JavaScript bundle.

The `environment.hosted-container.ts` file is committed to the repository and contains the configuration for Heroku deployments. Since it only contains public API URLs and operator information (no secrets), it's safe to commit.
