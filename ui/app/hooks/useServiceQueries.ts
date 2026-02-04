import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceService, type ConfigExport } from "../services/appService";
import type { Service } from "~/types/Service";
import type { ServiceFormData } from "~/types/Service";
import { useError } from "~/context/ErrorProvider";
import { getBackendConnectionStatus } from "~/lib/queryClient";

// Query Keys - centralized to avoid typos and enable easy refactoring
export const appQueryKeys = {
  all: ["apps"] as const,
  details: () => [...appQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...appQueryKeys.details(), id] as const,
  status: (id: string) => [...appQueryKeys.detail(id), "status"] as const,
  statuses: ["services", "statuses"] as const,
  statusesByApp: (appId: string) => ["services", "statuses", { appId }] as const,
  args: (id: string) => [...appQueryKeys.detail(id), "args"] as const,
  env: (id: string) => [...appQueryKeys.detail(id), "env"] as const,
} as const;

// Apps List Query
export function useAppsQuery() {
  return useQuery({
    queryKey: appQueryKeys.all,
    queryFn: () => serviceService.getAll(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    // Only refetch on window focus when connected
    refetchOnWindowFocus: () => getBackendConnectionStatus(),
  });
}

// App Status Query - uses batch status from central cache
// This hook provides compatibility for existing code that expects useQuery-like interface
export function useAppStatusQuery(appId: string) {
  // Get batch statuses - fetched centrally by AppStatusContext
  const { data: statuses, isLoading, isFetching, isSuccess } = useQuery({
    queryKey: appQueryKeys.statuses,
    queryFn: () => serviceService.getAllStatuses(),
    staleTime: 5 * 1000,
    refetchInterval: () => getBackendConnectionStatus() ? 10 * 1000 : false,
  });
  
  // Return just the status for this specific appId
  const status = statuses?.[appId] ?? "Unknown";
  
  return {
    data: status,
    isLoading,
    isFetching,
    isSuccess,
  };
}

// App-specific status query - fetches statuses for services within a specific app
export function useAppStatusesByAppQuery(appId: string) {
  return useQuery({
    queryKey: appQueryKeys.statusesByApp(appId),
    queryFn: () => serviceService.getAllStatuses(appId),
    staleTime: 5 * 1000,
    refetchInterval: () => getBackendConnectionStatus() ? 10 * 1000 : false,
    enabled: !!appId,
  });
}

// App Arguments Query
export function useAppArgsQuery(appId: string) {
  return useQuery({
    queryKey: appQueryKeys.args(appId),
    queryFn: () => serviceService.getArgs(appId),
    enabled: !!appId,
  });
}

// App Environment Variables Query
export function useAppEnvQuery(appId: string) {
  return useQuery({
    queryKey: appQueryKeys.env(appId),
    queryFn: () => serviceService.getEnv(appId),
    enabled: !!appId,
  });
}

// App Control Mutations
export function useAppControlMutation(options?: {
  onMutate?: (variables: {
    appId: string;
    appName?: string;
    action: "start" | "stop" | "restart";
  }) => void | Promise<void>;
  onError?: (
    error: Error,
    variables: { appId: string; appName?: string; action: "start" | "stop" | "restart" }
  ) => void;
  onSuccess?: (
    data: unknown,
    variables: { appId: string; appName?: string; action: "start" | "stop" | "restart" }
  ) => void;
}) {
  const queryClient = useQueryClient();
  const { showError, showSuccess, showInfo } = useError();

  return useMutation({
    // Disable retry for control actions - user can manually retry if needed
    retry: false,
    mutationFn: async ({
      appId,
      appName,
      action,
    }: {
      appId: string;
      appName?: string;
      action: "start" | "stop" | "restart";
    }) => {
      const actionName = action.charAt(0).toUpperCase() + action.slice(1);
      const displayName = appName ? `"${appName}"` : "app";
      
      showInfo(`${actionName}ing ${displayName}...`);
      
      try {
        const result = await serviceService.control(appId, action);
        showSuccess(`${displayName} ${actionName.toLowerCase()}ed successfully`);
        return result;
      } catch (error: unknown) {
        // Extract error details from the enhanced error response
        const err = error as { message?: string; details?: string };
        const errorMessage = err.message || `Failed to ${action} ${displayName}`;
        const errorDetails = err.details;
        
        // Show error with details if available
        if (errorDetails) {
          showError(`${errorMessage}\n\n${errorDetails}`, "Action Failed");
        } else {
          showError(errorMessage, "Action Failed");
        }
        
        throw error;
      }
    },
    onMutate: async (variables) => {
      if (options?.onMutate) {
        return options.onMutate(variables);
      }
    },
    onError: (error, variables) => {
      if (options?.onError) {
        options.onError(error, variables);
      }
    },
    onSuccess: (data, variables) => {
      // Optimistically update the status cache immediately
      const optimisticStatus = variables.action === "stop" ? "Stopped" : "Running";
      queryClient.setQueryData<Record<string, string>>(
        appQueryKeys.statuses,
        (prev) => prev ? { ...prev, [variables.appId]: optimisticStatus } : { [variables.appId]: optimisticStatus }
      );
      
      // Delay the refetch to allow components to react to optimistic update first
      setTimeout(() => {
        // Invalidate batch status to refetch and confirm actual status
        queryClient.invalidateQueries({
          queryKey: appQueryKeys.statuses,
        });
        // Also invalidate the apps list to get updated status
        queryClient.invalidateQueries({
          queryKey: appQueryKeys.all,
        });
      }, 500);
      
      if (options?.onSuccess) {
        options.onSuccess(data, variables);
      }
    },
  });
}

// Update App Mutation
export function useUpdateAppMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      appId,
      data,
    }: {
      appId: string;
      data: Partial<Service>;
    }) => serviceService.updateService(appId, data),
    onSuccess: (updatedApp, { appId }) => {
      // Update the app in the apps list cache
      queryClient.setQueryData(
        appQueryKeys.all,
        (oldApps: Service[] | undefined) => {
          if (!oldApps) return oldApps;
          return oldApps.map((app) => (app.id === appId ? updatedApp : app));
        }
      );

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: appQueryKeys.detail(appId) });
    },
  });
}

// Delete App Mutation
export function useDeleteAppMutation() {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useError();

  return useMutation({
    mutationFn: ({ appId, appName }: { appId: string; appName?: string }) => 
      serviceService.deleteService(appId).then(() => ({ appId, appName })),
    onSuccess: (data) => {
      const displayName = data.appName ? `"${data.appName}"` : "App";
      // Show success toast
      showSuccess(`${displayName} was deleted successfully`);
      
      // Remove app from cache
      queryClient.setQueryData(
        appQueryKeys.all,
        (oldApps: Service[] | undefined) => {
          if (!oldApps) return oldApps;
          return oldApps.filter((app) => app.id !== data.appId);
        }
      );

      // Remove all related queries
      queryClient.removeQueries({ queryKey: appQueryKeys.detail(data.appId) });
    },
    onError: (error) => {
      // Show error toast
      showError("Failed to delete app", error);
    }
  });
}

// Update App Arguments Mutation
export function useUpdateAppArgsMutation(options?: {
  onSuccess?: (data: unknown, variables: { appId: string; args: string }) => void;
  onError?: (error: Error, variables: { appId: string; args: string }) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appId, args }: { appId: string; args: string }) =>
      serviceService.updateArgs(appId, args),
    onSuccess: (data, variables) => {
      // Invalidate args cache to refetch
      queryClient.invalidateQueries({
        queryKey: appQueryKeys.args(variables.appId),
      });
      options?.onSuccess?.(data, variables);
    },
    onError: options?.onError,
  });
}

// Env variable type
export type EnvVariables = Array<{ key: string; value: string }>;

// Update App Environment Variables Mutation
export function useUpdateAppEnvMutation(options?: {
  onSuccess?: (data: unknown, variables: { appId: string; env: EnvVariables }) => void;
  onError?: (error: Error, variables: { appId: string; env: EnvVariables }) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appId, env }: { appId: string; env: EnvVariables }) =>
      serviceService.updateEnv(appId, env),
    onSuccess: (data, variables) => {
      // Invalidate env cache to refetch
      queryClient.invalidateQueries({
        queryKey: appQueryKeys.env(variables.appId),
      });
      options?.onSuccess?.(data, variables);
    },
    onError: options?.onError,
  });
}

// Create App Mutation
export function useCreateAppMutation(options?: {
  onSuccess?: (data: Service) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useError();

  return useMutation({
    mutationFn: (data: ServiceFormData) => serviceService.createService(data),
    onSuccess: (data) => {
      // Show success toast
      showSuccess(`App "${data.name}" was created successfully`);
      
      // Invalidate the apps list query to force a refetch
      queryClient.invalidateQueries({ queryKey: appQueryKeys.all });
      
      // Also update the cache directly to ensure immediate UI update
      queryClient.setQueryData(
        appQueryKeys.all,
        (oldApps: Service[] | undefined) => {
          if (!oldApps) return [data];
          return [...oldApps, data];
        }
      );
      
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // Show error toast
      showError("Failed to create app", error);
      options?.onError?.(error);
    }
  });
}

// Import Apps Mutation
export function useImportAppsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => serviceService.importServices(file),
    onSuccess: () => {
      // Refetch apps list after import
      queryClient.invalidateQueries({ queryKey: appQueryKeys.all });
    },
  });
}

// Export Apps Mutation
export function useExportAppsMutation() {
  return useMutation<ConfigExport, Error, void>({
    mutationFn: () => serviceService.exportServices(),
  });
}
