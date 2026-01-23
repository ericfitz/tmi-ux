import { HttpContextToken } from '@angular/common/http';

/**
 * HTTP context token to skip automatic error handling (like redirects) for specific requests
 * This is useful for endpoints where we want to handle errors differently than the default behavior
 */
export const SKIP_ERROR_HANDLING = new HttpContextToken<boolean>(() => false);

/**
 * HTTP context token to mark a request as an auth retry attempt
 * Prevents infinite retry loops when handling 401 errors - if a request with this
 * flag set receives a 401, we don't attempt another refresh/retry
 */
export const IS_AUTH_RETRY = new HttpContextToken<boolean>(() => false);
