import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { environmentService } from "../services/environmentService";
import type {
  Environment,
  CreateEnvironmentDto,
  UpdateEnvironmentDto,
} from "~/types/Environment";

// Query Keys
export const environmentQueryKeys = {
  all: ["environments"] as const,
  detail: (name: string) =>
    [...environmentQueryKeys.all, "detail", name] as const,
  active: () => [...environmentQueryKeys.all, "active"] as const,
} as const;

// Get All Environments Query
export function useEnvironmentsQuery() {
  return useQuery({
    queryKey: environmentQueryKeys.all,
    queryFn: () => environmentService.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get Environment by Name Query
export function useEnvironmentQuery(name: string) {
  return useQuery({
    queryKey: environmentQueryKeys.detail(name),
    queryFn: () => environmentService.getByName(name),
    enabled: !!name,
  });
}

// Get Active Environment Query
export function useActiveEnvironmentQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: environmentQueryKeys.active(),
    queryFn: () => environmentService.getActive(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled ?? true,
  });
}

// Create Environment Mutation
export function useCreateEnvironmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEnvironmentDto) =>
      environmentService.create(data),
    onSuccess: (newEnv) => {
      // Add new environment to the list cache
      queryClient.setQueryData(
        environmentQueryKeys.all,
        (oldEnvs: Environment[] | undefined) => {
          if (!oldEnvs) return [newEnv];
          return [...oldEnvs, newEnv];
        }
      );
    },
  });
}

// Update Environment Mutation
export function useUpdateEnvironmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateEnvironmentDto }) =>
      environmentService.update(name, data),
    onSuccess: (updatedEnvFromServer, { name }) => {
      // Update environment in the list cache, preserving client-side isActive status
      queryClient.setQueryData<Environment[] | undefined>(
        environmentQueryKeys.all,
        (oldEnvs) => {
          if (!oldEnvs) return undefined;
          return oldEnvs.map((cachedEnv) => {
            if (cachedEnv.name === name) {
              return {
                ...updatedEnvFromServer, // Data from server (name, vars, etc.)
                isActive: cachedEnv.isActive, // Preserve isActive from the current list cache
              };
            }
            return cachedEnv;
          });
        }
      );

      // Update individual environment detail cache
      const updatedListCache = queryClient.getQueryData<Environment[]>(
        environmentQueryKeys.all
      );
      const envFromUpdatedList = updatedListCache?.find((e) => e.name === name);

      queryClient.setQueryData<Environment | undefined>(
        environmentQueryKeys.detail(name),
        (currentDetail) => {
          if (!updatedEnvFromServer) return currentDetail;
          return {
            ...updatedEnvFromServer,
            isActive:
              envFromUpdatedList?.isActive ??
              currentDetail?.isActive ??
              false,
          };
        }
      );

      // Invalidate the active query to refetch if this environment was active
      queryClient.invalidateQueries({
        queryKey: environmentQueryKeys.active(),
      });
    },
  });
}

// Delete Environment Mutation
export function useDeleteEnvironmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => environmentService.delete(name),
    onSuccess: (_, name) => {
      // Remove environment from list cache
      queryClient.setQueryData(
        environmentQueryKeys.all,
        (oldEnvs: Environment[] | undefined) => {
          if (!oldEnvs) return oldEnvs;
          return oldEnvs.filter((env) => env.name !== name);
        }
      );

      // Remove individual environment cache
      queryClient.removeQueries({
        queryKey: environmentQueryKeys.detail(name),
      });

      // Invalidate active environment if this was the active one
      queryClient.invalidateQueries({
        queryKey: environmentQueryKeys.active(),
      });
    },
  });
}

// Set Active Environment Mutation
export function useSetActiveEnvironmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => environmentService.setActive(name),
    onSuccess: (_, name) => {
      // Update active environment cache
      queryClient.invalidateQueries({
        queryKey: environmentQueryKeys.active(),
      });

      // Update all environments to reflect the new active state
      queryClient.setQueryData(
        environmentQueryKeys.all,
        (oldEnvs: Environment[] | undefined) => {
          if (!oldEnvs) return oldEnvs;
          return oldEnvs.map((env) => ({
            ...env,
            isActive: env.name === name,
          }));
        }
      );
    },
  });
}

// Import Environments Mutation
export function useImportEnvironmentsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => environmentService.importEnvironments(file),
    onSuccess: () => {
      // Refetch all environments after import
      queryClient.invalidateQueries({ queryKey: environmentQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: environmentQueryKeys.active(),
      });
    },
  });
}

// Export Environments Mutation
export function useExportEnvironmentsMutation() {
  return useMutation({
    mutationFn: () => environmentService.exportEnvironments(),
  });
}
