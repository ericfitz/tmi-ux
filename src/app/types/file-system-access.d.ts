interface FileSystemWritableFileStream extends WritableStream {
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: write data chunk to a writable file stream (File System Access API)
  write(data: FileSystemWriteChunkType): Promise<void>;
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: move the write cursor to a byte position in a file stream
  seek(position: number): Promise<void>;
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: resize a writable file stream to a given byte size
  truncate(size: number): Promise<void>;
}

// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: enumerate accepted data chunk types for file stream writes (pure)
type FileSystemWriteChunkType = BufferSource | Blob | string;

interface FileSystemFileHandle {
  kind: 'file';
  name: string;
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch a File object from a file system handle
  getFile(): Promise<File>;
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: open a writable stream for a file system handle
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  excludeAcceptAllOption?: boolean;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  excludeAcceptAllOption?: boolean;
}

interface Window {
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: prompt the user to pick a save destination and return a file handle
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  // SEM@a5651fe61b6acd195c1f485c52b0304107ceb2c6: prompt the user to select files to open and return their handles
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
}
