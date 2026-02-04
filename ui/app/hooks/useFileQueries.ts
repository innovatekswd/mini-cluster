import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fileService } from "../services/fileService";
import { useError } from "~/context/ErrorProvider";
import { useErrorHandledMutation } from "./useErrorHandledMutation";
import type {
  AppFile,
  CreateAppFileDto,
  UpdateAppFileDto,
} from "~/types/ServiceFile";

// Query Keys
export const fileQueryKeys = {
  all: ["files"] as const,
  byApp: (appId: string) => [...fileQueryKeys.all, "app", appId] as const,
  detail: (appId: string, fileId: string) =>
    [...fileQueryKeys.byApp(appId), "detail", fileId] as const,
  content: (appId: string, fileId: string) =>
    [...fileQueryKeys.detail(appId, fileId), "content"] as const,
} as const;

// Get Files for App Query
export function useFilesQuery(appId: string) {
  return useQuery({
    queryKey: fileQueryKeys.byApp(appId),
    queryFn: () => fileService.getFiles(appId),
    enabled: !!appId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get File Detail Query
export function useFileDetailQuery(appId: string, fileId: string) {
  return useQuery({
    queryKey: fileQueryKeys.detail(appId, fileId),
    queryFn: () => fileService.getFileById(appId, fileId),
    enabled: !!appId && !!fileId,
  });
}

// Get File Content Query
export function useFileContentQuery(
  appId: string,
  fileId: string,
  enabled = true
) {
  return useQuery({
    queryKey: fileQueryKeys.content(appId, fileId),
    queryFn: () => fileService.getFileContent(appId, fileId),
    enabled: !!appId && !!fileId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - content doesn't change often
  });
}

// File Content Fetch Mutation (for on-demand fetching)
export function useFileContentMutation() {
  const { showError } = useError();

  return useMutation({
    mutationFn: ({ appId, fileId }: { appId: string; fileId: string }) =>
      fileService.getFileContent(appId, fileId),
    onError: (error, { fileId }) => {
      showError(`Failed to fetch content for file ID ${fileId}`, error);
    },
  });
}

// Create File Mutation
export function useCreateFileMutation() {
  const queryClient = useQueryClient();
  const { showSuccess } = useError();

  return useErrorHandledMutation(
    {
      mutationFn: ({
        appId,
        data,
      }: {
        appId: string;
        data: CreateAppFileDto;
      }) => fileService.createFile(appId, data),
      onSuccess: (newFile, { appId }) => {
        // Add new file to the files list cache
        queryClient.setQueryData(
          fileQueryKeys.byApp(appId),
          (oldFiles: AppFile[] | undefined) => {
            if (!oldFiles) return [newFile];
            return [...oldFiles, newFile];
          }
        );
        showSuccess(`File "${newFile.name}" created successfully`);
      },
    },
    {
      errorMessage: "Failed to create file",
    }
  );
}

// Update File Mutation with optimistic updates
export function useUpdateFileMutation() {
  const queryClient = useQueryClient();
  const { showSuccess } = useError();

  return useErrorHandledMutation(
    {
      mutationFn: ({
        appId,
        fileId,
        data,
      }: {
        appId: string;
        fileId: string;
        data: UpdateAppFileDto;
      }) => fileService.updateFile(appId, fileId, data),
      // Optimistic update: Update the cache before the request completes
      onMutate: async ({ appId, fileId, data }) => {
        // Cancel any outgoing refetches for the file
        await queryClient.cancelQueries({
          queryKey: fileQueryKeys.detail(appId, fileId),
        });

        // Get the current file from cache
        const previousFile = queryClient.getQueryData<AppFile>(
          fileQueryKeys.detail(appId, fileId)
        );

        // Optimistically update the file in the cache
        if (previousFile) {
          const optimisticFile = {
            ...previousFile,
            ...data,
            // Update timestamp for visual feedback
            lastModified: new Date().toISOString(),
          };

          // Update in the detail cache
          queryClient.setQueryData(
            fileQueryKeys.detail(appId, fileId),
            optimisticFile
          );

          // Update in the files list cache
          queryClient.setQueryData(
            fileQueryKeys.byApp(appId),
            (oldFiles: AppFile[] | undefined) => {
              if (!oldFiles) return oldFiles;
              return oldFiles.map((file) =>
                file.id === fileId ? optimisticFile : file
              );
            }
          );

          // If updating content, also update content cache
          if (data.content !== undefined) {
            queryClient.setQueryData(fileQueryKeys.content(appId, fileId), {
              content: data.content,
            });
          }
        }

        // Return the previous file for rollback if needed
        return { previousFile, appId, fileId };
      },
      onSuccess: (updatedFile, { appId, fileId }) => {
        // Update file in the files list cache with the actual response
        queryClient.setQueryData(
          fileQueryKeys.byApp(appId),
          (oldFiles: AppFile[] | undefined) => {
            if (!oldFiles) return oldFiles;
            return oldFiles.map((file) =>
              file.id === fileId ? updatedFile : file
            );
          }
        );

        // Update the detail cache
        queryClient.setQueryData(
          fileQueryKeys.detail(appId, fileId),
          updatedFile
        );

        showSuccess(`File "${updatedFile.name}" updated successfully`);
      },
      onError: (error, { appId, fileId }, context) => {
        // Rollback optimistic updates on error
        if (context?.previousFile) {
          queryClient.setQueryData(
            fileQueryKeys.detail(appId, fileId),
            context.previousFile
          );

          queryClient.setQueryData(
            fileQueryKeys.byApp(appId),
            (oldFiles: AppFile[] | undefined) => {
              if (!oldFiles) return oldFiles;
              return oldFiles.map((file) =>
                file.id === fileId ? context.previousFile : file
              );
            }
          );
        }
      },
    },
    {
      errorMessage: "Failed to update file",
    }
  );
}

// Delete File Mutation with optimistic updates
export function useDeleteFileMutation() {
  const queryClient = useQueryClient();
  const { showSuccess } = useError();

  return useErrorHandledMutation(
    {
      mutationFn: ({
        appId,
        fileId,
        fileName,
      }: {
        appId: string;
        fileId: string;
        fileName?: string;
      }) => fileService.deleteFile(appId, fileId),
      // Optimistic update: Remove the file from cache before the request completes
      onMutate: async ({ appId, fileId }) => {
        // Cancel any outgoing refetches for this file
        await queryClient.cancelQueries({
          queryKey: fileQueryKeys.byApp(appId),
        });

        // Get the current files list from cache
        const previousFiles = queryClient.getQueryData<AppFile[]>(
          fileQueryKeys.byApp(appId)
        );

        // Get the file being deleted (for the name in success message)
        const deletedFile = previousFiles?.find((file) => file.id === fileId);

        // Optimistically remove the file from the files list cache
        queryClient.setQueryData(
          fileQueryKeys.byApp(appId),
          (oldFiles: AppFile[] | undefined) => {
            if (!oldFiles) return oldFiles;
            return oldFiles.filter((file) => file.id !== fileId);
          }
        );

        // Return the previous files list and deleted file for rollback or success message
        return { previousFiles, deletedFile, appId, fileId };
      },
      onSuccess: (_, { appId, fileId, fileName }, context) => {
        // Remove all queries related to this file
        queryClient.removeQueries({
          queryKey: fileQueryKeys.detail(appId, fileId),
        });

        // Show success message with the file name
        const displayName = fileName || context?.deletedFile?.name || fileId;
        showSuccess(`File "${displayName}" deleted successfully`);
      },
      onError: (error, { appId }, context) => {
        // Rollback optimistic updates on error
        if (context?.previousFiles) {
          queryClient.setQueryData(
            fileQueryKeys.byApp(appId),
            context.previousFiles
          );
        }
      },
    },
    {
      errorMessage: "Failed to delete file",
    }
  );
}

// Download File Mutation
export function useDownloadFileMutation() {
  const { showError, showSuccess } = useError();

  return useMutation({
    mutationFn: ({
      appId,
      fileId,
      fileName,
    }: {
      appId: string;
      fileId: string;
      fileName?: string;
    }) => fileService.downloadFile(appId, fileId),
    onSuccess: (_, { fileName, fileId }) => {
      const displayName = fileName || fileId;
      showSuccess(`File "${displayName}" downloaded successfully`);
    },
    onError: (error, { fileName, fileId }) => {
      const displayName = fileName || fileId;
      showError(`Failed to download file "${displayName}"`, error);
    },
  });
}
