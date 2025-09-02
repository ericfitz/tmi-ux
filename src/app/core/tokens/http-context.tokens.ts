import { HttpContextToken } from '@angular/common/http';

/**
 * HTTP context token to skip automatic error handling (like redirects) for specific requests
 * This is useful for endpoints where we want to handle errors differently than the default behavior
 */
export const SKIP_ERROR_HANDLING = new HttpContextToken<boolean>(() => false);
