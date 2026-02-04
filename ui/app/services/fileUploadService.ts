import apiClient from "~/lib/apiClient";

export interface FileDownloadParams {
  folder: string;
  fileName: string;
}

export interface FileUploadResponse {
  success: boolean;
  fileName: string;
  filePath: string;
  message?: string;
}

export interface FolderUploadResponse {
  success: boolean;
  filesUploaded: number;
  errorFiles: string[];
  message?: string;
}

export const fileUploadService = {
  // Upload a single file
  async uploadFile(file: File, folder: string): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const response = await apiClient.post("/api/files/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Download a file
  async downloadFile(params: FileDownloadParams): Promise<Blob> {
    const response = await apiClient.get(
      `/api/files/download?folder=${encodeURIComponent(params.folder)}&fileName=${encodeURIComponent(params.fileName)}`,
      { responseType: "blob" }
    );
    return response.data;
  },

  // Upload multiple files as a folder
  async uploadFolder(files: File[]): Promise<FolderUploadResponse> {
    const formData = new FormData();
    
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    const response = await apiClient.post("/api/files/upload-folder", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
  
  // Get file URL for direct download
  getFileDownloadUrl(folder: string, fileName: string): string {
    return `/api/files/download?folder=${encodeURIComponent(folder)}&fileName=${encodeURIComponent(fileName)}`;
  }
};