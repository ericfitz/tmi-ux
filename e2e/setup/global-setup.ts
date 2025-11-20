import { verifyServicesAvailable } from '../helpers/service-availability';

/**
 * Global setup for Playwright e2e tests
 *
 * This runs once before all tests to verify that:
 * 1. The frontend application is running and accessible
 * 2. The backend API is running and accessible
 *
 * If either service is not available, tests will fail fast with a clear error message
 */
async function globalSetup(): Promise<void> {
  console.log('\n=== E2E Test Global Setup ===\n');

  try {
    await verifyServicesAvailable();
    console.log('\n✓ All services are available\n');
  } catch (error) {
    console.error('\n✗ Service availability check failed\n');
    if (error instanceof Error) {
      console.error(error.message);
    }
    throw error;
  }
}

export default globalSetup;
