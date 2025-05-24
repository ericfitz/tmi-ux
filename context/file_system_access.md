# File System Access API Implementation

## Overview

The diagram editor now uses the browser's native [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) for file operations instead of the third-party `file-saver` library. This modern approach provides a more integrated user experience and reduces external dependencies.

## Features

- **Native File System Integration**: Uses the browser's built-in file system dialogs
- **Multiple Export Formats**: Supports JSON, PNG, and SVG exports
- **Graceful Degradation**: Includes fallback mechanisms for browsers without File System Access API support
- **Type Safety**: Custom TypeScript declarations for the File System Access API

## Implementation Details

### File System Access API

The File System Access API allows web applications to interact with the user's local file system in a secure, permission-based way. Key features include:

- User-initiated file operations through native file pickers
- Read and write access to files and directories
- Persistent permissions for frequently accessed files

### Export/Import Service

The `ExportImportService` has been updated to use the File System Access API:

```typescript
private async saveFileWithNativeAPI(blob: Blob, suggestedName: string, mimeType: string): Promise<void> {
  try {
    // Define file type options based on mime type
    const fileTypeOptions = { ... };

    // Show the file save dialog
    const fileHandle = await window.showSaveFilePicker({
      suggestedName,
      types: [fileTypeOptions],
    });

    // Create a writable stream and write the blob
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    this.logger.info(`File saved: ${suggestedName}`);
  } catch (error) {
    // Handle errors and fallback if needed
    // ...
  }
}
```

### TypeScript Declarations

Custom TypeScript declarations have been added in `src/app/types/file-system-access.d.ts` to provide type safety for the File System Access API:

```typescript
interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface FileSystemFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

// Additional interfaces...
```

### Fallback Mechanism

For browsers that don't support the File System Access API, a fallback mechanism is provided:

```typescript
private fallbackSaveFile(blob: Blob, fileName: string): void {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = URL.createObjectURL(blob);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  this.logger.info(`File saved using fallback method: ${fileName}`);
}
```

## Browser Compatibility

The File System Access API is supported in:

- Chrome 86+
- Edge 86+
- Opera 72+

For other browsers, the fallback mechanism ensures that file operations still work using the traditional download approach.

## Benefits

1. **Improved User Experience**: Users can select where to save files using their native file system dialog
2. **Reduced Dependencies**: Removed the need for the third-party `file-saver` library
3. **Modern Web Standards**: Aligns with the latest web platform capabilities
4. **Enhanced Security**: Uses the browser's permission model for file access
5. **Better Integration**: Files are saved directly to the file system rather than to the downloads folder

## Future Enhancements

- Implement file open dialogs for importing diagrams
- Add directory access for managing multiple diagram files
- Support for auto-save and file synchronization
- Integration with cloud storage providers
