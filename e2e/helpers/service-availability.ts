import { testConfig } from '../config/test.config';

/**
 * Service availability check results
 */
export interface ServiceStatus {
  available: boolean;
  url: string;
  error?: string;
}

/**
 * Check if a service is available by making a GET request to its root endpoint
 */
async function checkServiceAvailability(url: string, timeout: number): Promise<ServiceStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      // Don't follow redirects - we just want to verify the service responds
      redirect: 'manual',
    });

    clearTimeout(timeoutId);

    // Any response (including redirects, 404s, etc.) means the service is available
    return {
      available: true,
      url,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      available: false,
      url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if the frontend application is available
 */
export async function checkAppAvailability(): Promise<ServiceStatus> {
  return checkServiceAvailability(testConfig.appUrl, testConfig.serviceAvailabilityTimeout);
}

/**
 * Check if the backend API is available
 */
export async function checkApiAvailability(): Promise<ServiceStatus> {
  return checkServiceAvailability(testConfig.apiUrl, testConfig.serviceAvailabilityTimeout);
}

/**
 * Check both frontend and backend services
 * Throws an error if either service is unavailable
 */
export async function verifyServicesAvailable(): Promise<void> {
  console.log('Checking service availability...');

  const [appStatus, apiStatus] = await Promise.all([
    checkAppAvailability(),
    checkApiAvailability(),
  ]);

  const errors: string[] = [];

  if (!appStatus.available) {
    errors.push(
      `Frontend application not available at ${appStatus.url}: ${appStatus.error || 'Unknown error'}`,
    );
  } else {
    console.log(`✓ Frontend application available at ${appStatus.url}`);
  }

  if (!apiStatus.available) {
    errors.push(
      `Backend API not available at ${apiStatus.url}: ${apiStatus.error || 'Unknown error'}`,
    );
  } else {
    console.log(`✓ Backend API available at ${apiStatus.url}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Service availability check failed:\n${errors.join('\n')}\n\n` +
        'Make sure both services are running before starting e2e tests.',
    );
  }
}
