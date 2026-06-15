/**
 * Save a Blob to a file via a programmatic anchor download. Used for audit-log
 * exports where the blob arrives asynchronously over HttpClient (so the File
 * System Access picker, which needs a live user gesture, is not viable).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
