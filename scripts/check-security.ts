#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface SecurityCheckResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
}

function checkCSPImplementation(): SecurityCheckResult {
  const result: SecurityCheckResult = { passed: true, warnings: [], errors: [] };
  const indexPath = join(process.cwd(), 'src', 'index.html');

  if (!existsSync(indexPath)) {
    result.errors.push('index.html not found');
    result.passed = false;
    return result;
  }

  const indexContent = readFileSync(indexPath, 'utf-8');
  const cspRegex = /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i;
  const cspMatch = indexContent.match(cspRegex);

  // Check for CSP comment indicating dynamic injection
  const dynamicCSPComment = indexContent.includes('CSP will be dynamically injected');

  if (!cspMatch && !dynamicCSPComment) {
    result.errors.push(
      'No CSP implementation found (neither static meta tag nor dynamic injection comment)',
    );
    result.passed = false;
  } else if (dynamicCSPComment) {
    console.log('✅ Dynamic CSP injection configured');

    // Verify security service exists and implements CSP injection
    const servicePath = join(
      process.cwd(),
      'src',
      'app',
      'core',
      'services',
      'security-config.service.ts',
    );

    if (existsSync(servicePath)) {
      const serviceContent = readFileSync(servicePath, 'utf-8');
      if (serviceContent.includes('injectDynamicCSP')) {
        console.log('✅ Dynamic CSP injection method found');
      } else {
        result.errors.push('Dynamic CSP injection method not found in security service');
        result.passed = false;
      }
    }

    // Warnings for dynamic CSP
    result.warnings.push("CSP uses 'unsafe-inline' - consider implementing nonce-based CSP");
    result.warnings.push("CSP uses 'unsafe-eval' - review if necessary for your framework");
  } else if (cspMatch) {
    console.log('⚠️ Static CSP meta tag found - consider using dynamic CSP for API flexibility');
    result.warnings.push('Static CSP may not accommodate dynamic API URLs');

    // Check static CSP content
    const cspContent = cspMatch[0];
    if (cspContent.includes('unsafe-inline')) {
      result.warnings.push("CSP contains 'unsafe-inline' - consider using nonces or hashes");
    }
    if (cspContent.includes('unsafe-eval')) {
      result.warnings.push("CSP contains 'unsafe-eval' - review if necessary");
    }
  }

  return result;
}

function checkSecurityService(): SecurityCheckResult {
  const result: SecurityCheckResult = { passed: true, warnings: [], errors: [] };
  const servicePath = join(
    process.cwd(),
    'src',
    'app',
    'core',
    'services',
    'security-config.service.ts',
  );

  if (!existsSync(servicePath)) {
    result.errors.push('security-config.service.ts not found');
    result.passed = false;
  } else {
    console.log('✅ Security config service found');
  }

  return result;
}

function checkEnvironmentConfig(): SecurityCheckResult {
  const result: SecurityCheckResult = { passed: true, warnings: [], errors: [] };
  const environments = ['dev', 'prod', 'staging'];

  environments.forEach(env => {
    const envPath = join(process.cwd(), 'src', 'environments', `environment.${env}.ts`);
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8');
      if (!content.includes('securityConfig')) {
        result.warnings.push(`environment.${env}.ts missing securityConfig`);
      }
    }
  });

  return result;
}

function checkDocumentation(): SecurityCheckResult {
  const result: SecurityCheckResult = { passed: true, warnings: [], errors: [] };
  const docPath = join(process.cwd(), 'docs', 'SECURITY_HEADERS.md');

  if (!existsSync(docPath)) {
    result.errors.push('SECURITY_HEADERS.md documentation not found');
    result.passed = false;
  } else {
    console.log('✅ Security headers documentation found');
  }

  return result;
}

function printResults(results: SecurityCheckResult[]): boolean {
  let hasErrors = false;
  let hasWarnings = false;

  results.forEach(result => {
    if (result.errors.length > 0) {
      hasErrors = true;
      result.errors.forEach(error => console.error(`❌ ERROR: ${error}`));
    }
    if (result.warnings.length > 0) {
      hasWarnings = true;
      result.warnings.forEach(warning => console.warn(`⚠️  WARN: ${warning}`));
    }
  });

  console.log('\n=== Security Check Summary ===');
  if (!hasErrors && !hasWarnings) {
    console.log('✅ All security checks passed!');
  } else {
    if (hasErrors) {
      console.error(`❌ Found ${results.reduce((sum, r) => sum + r.errors.length, 0)} errors`);
    }
    if (hasWarnings) {
      console.warn(`⚠️  Found ${results.reduce((sum, r) => sum + r.warnings.length, 0)} warnings`);
    }
  }

  return !hasErrors;
}

function main(): void {
  console.log('🔒 TMI-UX Security Configuration Check\n');

  const results: SecurityCheckResult[] = [
    checkCSPImplementation(),
    checkSecurityService(),
    checkEnvironmentConfig(),
    checkDocumentation(),
  ];

  const success = printResults(results);

  console.log('\n📚 For more information, see docs/SECURITY_HEADERS.md');

  process.exit(success ? 0 : 1);
}

// Run the script
main();
