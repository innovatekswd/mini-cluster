import apiClient from '~/lib/apiClient';

const API_BASE = '/api/explorer';

// Types
export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  created: string;
  extension: string;
  mimeType: string;
  permissions: string;
  isHidden: boolean;
  isReadable: boolean;
  isWritable: boolean;
  itemCount?: number;
  category: 'text' | 'image' | 'video' | 'audio' | 'binary' | 'directory';
}

export interface DirectoryListing {
  path: string;
  parent: string | null;
  items: FileItem[];
  totalItems: number;
  hasMore: boolean;
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  modified: string;
  created: string;
  permissions: string;
  owner: string;
  group: string;
  mimeType: string;
  encoding: string;
  isReadable: boolean;
  isWritable: boolean;
  isExecutable: boolean;
  isSymlink: boolean;
  symlinkTarget?: string;
  category: string;
}

export interface SearchResult {
  path: string;
  name: string;
  type: string;
  match: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  truncated: boolean;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export interface UploadResult {
  fileName: string;
  path?: string;
  size?: number;
  success: boolean;
  error?: string;
}

// API Functions
export const explorerService = {
  /**
   * Get allowed root paths
   */
  async getRoots(): Promise<FileItem[]> {
    const { data } = await apiClient.get<FileItem[]>(`${API_BASE}/roots`);
    return data;
  },

  /**
   * List directory contents
   */
  async listDirectory(
    path: string,
    sort: string = 'name',
    order: 'asc' | 'desc' = 'asc',
    skip: number = 0,
    take: number = 500
  ): Promise<DirectoryListing> {
    const { data } = await apiClient.get<DirectoryListing>(`${API_BASE}/list`, {
      params: { path, sort, order, skip, take },
    });
    return data;
  },

  /**
   * Get file/directory info
   */
  async getInfo(path: string): Promise<FileInfo> {
    const { data } = await apiClient.get<FileInfo>(`${API_BASE}/info`, {
      params: { path },
    });
    return data;
  },

  /**
   * Get file content (text)
   */
  async getFileContent(path: string): Promise<string> {
    const { data } = await apiClient.get<{ content: string; path: string }>(`${API_BASE}/file`, {
      params: { path },
    });
    return data.content;
  },

  /**
   * Get file as blob (for preview)
   */
  async getFileBlob(path: string): Promise<Blob> {
    const { data } = await apiClient.get(`${API_BASE}/file`, {
      params: { path, raw: true },
      responseType: 'blob',
    });
    return data;
  },

  /**
   * Save file content
   */
  async saveFile(path: string, content: string, encoding: string = 'utf-8'): Promise<void> {
    await apiClient.put(`${API_BASE}/file`, { path, content, encoding });
  },

  /**
   * Create a new file
   */
  async createFile(path: string, content: string = ''): Promise<void> {
    await apiClient.post(`${API_BASE}/file`, { path, content });
  },

  /**
   * Create a new directory
   */
  async createDirectory(path: string): Promise<void> {
    await apiClient.post(`${API_BASE}/mkdir`, { path });
  },

  /**
   * Delete a file or directory
   */
  async delete(path: string, recursive: boolean = false): Promise<void> {
    await apiClient.delete(`${API_BASE}/delete`, {
      params: { path, recursive },
    });
  },

  /**
   * Delete multiple files/directories
   */
  async deleteMultiple(paths: string[], recursive: boolean = false): Promise<{ results: Array<{ path: string; success: boolean; error?: string }> }> {
    const { data } = await apiClient.post(`${API_BASE}/delete`, { paths, recursive });
    return data;
  },

  /**
   * Move or rename
   */
  async move(source: string, destination: string): Promise<void> {
    await apiClient.post(`${API_BASE}/move`, { source, destination });
  },

  /**
   * Copy file/directory
   */
  async copy(source: string, destination: string, overwrite: boolean = false): Promise<void> {
    await apiClient.post(`${API_BASE}/copy`, { source, destination, overwrite });
  },

  /**
   * Upload files
   */
  async upload(
    targetPath: string,
    files: File[],
    onProgress?: (progress: number) => void
  ): Promise<{ results: UploadResult[] }> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const { data } = await apiClient.post(`${API_BASE}/upload`, formData, {
      params: { path: targetPath },
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });

    return data;
  },

  /**
   * Upload files - alias for upload
   */
  uploadFiles(
    targetPath: string,
    files: File[],
    onProgress?: (progress: number) => void
  ): Promise<{ results: UploadResult[] }> {
    return this.upload(targetPath, files, onProgress);
  },

  /**
   * Upload a single file with progress
   */
  async uploadFile(
    targetPath: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    const result = await this.upload(targetPath, [file], onProgress);
    return result.results[0];
  },

  /**
   * Get download URL for a file
   */
  getDownloadUrl(path: string): string {
    return `${API_BASE}/download?path=${encodeURIComponent(path)}`;
  },

  /**
   * Download a file
   */
  async downloadFile(path: string): Promise<void> {
    const url = this.getDownloadUrl(path);
    const link = document.createElement('a');
    link.href = url;
    link.download = path.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Search files
   */
  async search(
    basePath: string,
    query: string,
    recursive: boolean = true,
    type: 'all' | 'file' | 'directory' = 'all',
    maxResults: number = 100
  ): Promise<SearchResponse> {
    const { data } = await apiClient.get<SearchResponse>(`${API_BASE}/search`, {
      params: { path: basePath, query, recursive, type, maxResults },
    });
    return data;
  },

  /**
   * Execute command in directory
   */
  async executeCommand(path: string, command: string, timeoutSeconds: number = 30): Promise<CommandResult> {
    const { data } = await apiClient.post<CommandResult>(`${API_BASE}/exec`, {
      path,
      command,
      timeoutSeconds,
    });
    return data;
  },
};

// Helper functions
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getFileIcon(item: FileItem): string {
  if (item.type === 'directory') return '📁';
  
  switch (item.category) {
    case 'text':
      if (item.extension === '.json') return '📋';
      if (item.extension === '.xml') return '📰';
      if (item.extension === '.md') return '📝';
      if (['.js', '.ts', '.jsx', '.tsx'].includes(item.extension)) return '⚡';
      if (['.css', '.scss'].includes(item.extension)) return '🎨';
      if (['.html', '.htm'].includes(item.extension)) return '🌐';
      if (['.py'].includes(item.extension)) return '🐍';
      if (['.cs'].includes(item.extension)) return '💜';
      return '📄';
    case 'image':
      return '🖼️';
    case 'video':
      return '🎬';
    case 'audio':
      return '🎵';
    default:
      return '📦';
  }
}

export function isEditable(item: FileItem): boolean {
  return item.type === 'file' && item.category === 'text' && item.isReadable;
}

export function isPreviewable(item: FileItem): boolean {
  return item.type === 'file' && ['text', 'image', 'video', 'audio'].includes(item.category);
}
