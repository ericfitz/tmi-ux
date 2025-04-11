# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## API and Backend
- Backend API specification is available in `tmi-openapi.json`
- Local development server runs at http://localhost:8080
- API URL is configured in environment files (e.g., environment.dev.ts)
- Authentication and authorization details are documented in `AUTHORIZATION.md`
- The server uses a role-based access control model with Owner, Writer, and Reader roles
- Authorization middleware enforces permissions for object access and modification

## Build/Test Commands
- Development server: `ng serve` or `npm run dev`
- Production build: `ng build --configuration=production` or `npm run build:prod`
- Run all tests: `ng test` or `npm run test`
- Run single test: `ng test --include=**/path/to/file.spec.ts`
- Run tests for specific component: `ng test --include=**/component-name/*.spec.ts`
- Focus tests in code: Use `fdescribe()` and `fit()` in spec files
- Lint TypeScript/HTML: `npm run lint`
- Lint SCSS: `npm run lint:scss`
- Lint all files: `npm run lint:all` 
- Format code: `npm run format`
- Check formatting: `npm run format:check`
- Check all (lint+format): `npm run check`
- Pre-commit hooks: Uses husky and lint-staged to verify code quality before commits

## Code Style
- Indentation: 2 spaces
- Quotes: single quotes for TypeScript
- Max line length: 100 characters
- TypeScript: strict mode enabled with ES modules
- Components: app-prefix selectors, SCSS for styles, OnPush change detection
- Import order: Angular core → Angular modules → Third-party → Project modules
- Observables: Use $ suffix
- Private members: Use _ prefix
- Error handling: Use catchError with LoggerService
- Type annotations: Use throughout (explicit function return types)
- No explicit any: Avoid using 'any' type
- Documentation: JSDoc style comments
- Services: Provided in root, constructor-based DI
- Subscription management: Initialize as null, unsubscribe in ngOnDestroy
- No console.log: Use LoggerService instead