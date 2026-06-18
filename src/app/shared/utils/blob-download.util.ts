/**
 * Save a Blob to a file via a programmatic anchor download. Used for audit-log
 * exports where the blob arrives asynchronously over HttpClient (so the File
 * System Access picker, which needs a live user gesture, is not viable).
 */
// SEM@ba5d0e1d381b7e38396c9091df6b2e69266a7a1d: trigger a browser file download for a Blob via a programmatic anchor click (mutates shared state)
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
