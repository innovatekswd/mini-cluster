import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fileUploadService,
  type FileDownloadParams,
} from "../services/fileUploadService";

// File Upload Mutation
export function useFileUploadMutation() {
  return useMutation({
    mutationFn: ({ file, folder }: { file: File; folder: string }) =>
      fileUploadService.uploadFile(file, folder),
  });
}

// Folder Upload Mutation
export function useFolderUploadMutation() {
  return useMutation({
    mutationFn: (files: File[]) => fileUploadService.uploadFolder(files),
  });
}

// File Download Mutation
export function useFileDownloadMutation() {
  return useMutation({
    mutationFn: (params: FileDownloadParams) =>
      fileUploadService.downloadFile(params),
  });
}
