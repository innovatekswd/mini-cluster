import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appsApiService } from "~/services/appsApiService";
import type { AppWithStats, CreateAppDto, UpdateAppDto } from "~/types/App";
import { useToast } from "~/components/Toast";
import { getBackendConnectionStatus } from "~/lib/queryClient";
import { getApiErrorMessage } from "~/lib/apiClient";

// Query Keys for Apps (distinct from services)
export const appsQueryKeys = {
  all: ["appsWithStats"] as const,
  list: ["apps"] as const,
  details: () => [...appsQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...appsQueryKeys.details(), id] as const,
} as const;

/**
 * Fetch all apps with service statistics
 */
export function useAppsWithStatsQuery() {
  return useQuery({
    queryKey: appsQueryKeys.all,
    queryFn: () => appsApiService.getAll(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: () => getBackendConnectionStatus(),
  });
}

/**
 * Fetch all apps (basic list without stats)
 */
export function useAppsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: appsQueryKeys.list,
    queryFn: () => appsApiService.getAll(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: () => getBackendConnectionStatus(),
    ...options,
  });
}

/**
 * Fetch a single app by ID
 */
export function useAppDetailQuery(appId: string) {
  return useQuery({
    queryKey: appsQueryKeys.detail(appId),
    queryFn: () => appsApiService.getById(appId),
    enabled: !!appId,
  });
}

/**
 * Create a new app
 */
export function useCreateAppMutationV2() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: CreateAppDto) => appsApiService.create(data),
    onSuccess: (data) => {
      toast.success(`App "${data.name}" created successfully`);
      queryClient.invalidateQueries({ queryKey: appsQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(getApiErrorMessage(error, "Failed to create app"));
    },
  });
}

/**
 * Update an existing app
 */
export function useUpdateAppMutationV2() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAppDto }) =>
      appsApiService.update(id, data),
    onSuccess: (_, { id }) => {
      toast.success("App updated successfully");
      queryClient.invalidateQueries({ queryKey: appsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: appsQueryKeys.detail(id) });
    },
    onError: (error: Error) => {
      toast.error(getApiErrorMessage(error, "Failed to update app"));
    },
  });
}

/**
 * Delete an app
 */
export function useDeleteAppMutationV2() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      appsApiService.delete(id).then(() => ({ id, name })),
    onSuccess: ({ name }) => {
      toast.success(name ? `"${name}" deleted` : "App deleted");
      queryClient.invalidateQueries({ queryKey: appsQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(getApiErrorMessage(error, "Failed to delete app"));
    },
  });
}

/**
 * Clone an app
 */
export function useCloneAppMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (appId: string) => appsApiService.clone(appId),
    onSuccess: (data) => {
      toast.success(`Cloned as "${data.name}"`);
      queryClient.invalidateQueries({ queryKey: appsQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(getApiErrorMessage(error, "Failed to clone app"));
    },
  });
}

/**
 * Reorder apps
 */
export function useReorderAppsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderedIds: string[]) => appsApiService.reorder(orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appsQueryKeys.all });
    },
  });
}

/**
 * Seed sample apps for testing
 */
export function useSeedAppsMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: () => appsApiService.seed(),
    onSuccess: ({ message }) => {
      toast.success(message || "Sample apps seeded");
      queryClient.invalidateQueries({ queryKey: appsQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(getApiErrorMessage(error, "Failed to seed apps"));
    },
  });
}
