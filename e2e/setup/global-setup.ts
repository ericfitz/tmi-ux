import { testConfig } from '../config/test.config';

async function checkService(url: string, label: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    testConfig.serviceAvailabilityTimeout,
  );

  try {
    await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'manual' });
    clearTimeout(timeoutId);
    console.log(`  ✓ ${label} available at ${url}`);
  } catch (error) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} not available at ${url}: ${message}`);
  }
}

async function globalSetup(): Promise<void> {
  console.log('\n=== E2E Test Setup ===\n');

  const errors: string[] = [];

  try {
    await checkService(testConfig.appUrl, 'Frontend');
  } catch (e) {
    errors.push((e as Error).message);
  }

  try {
    await checkService(testConfig.apiUrl, 'Backend API');
  } catch (e) {
    errors.push((e as Error).message);
  }

  if (errors.length > 0) {
    console.error('\n✗ Service check failed:\n');
    errors.forEach(e => console.error(`  ${e}`));
    console.error('\nStart both services before running e2e tests.\n');
    throw new Error('Required services are not available');
  }

  console.log('\n✓ All services available\n');
}

export default globalSetup;
