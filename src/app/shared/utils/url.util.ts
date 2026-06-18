/**
 * Check if a string is a valid URL
 */
// SEM@842e13b899452ede91f10594c85586d003e70d31: validate a string as a well-formed URL (pure)
export function isValidUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
