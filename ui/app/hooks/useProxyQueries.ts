/**
 * React Query hooks for Proxy API
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proxyService } from "~/services/proxyService";
import type { 
  ProxyRoute, 
  CreateProxyRouteDto, 
  ProxySettings,
  UpdateProxySettingsDto 
} from "~/types/ProxyRoute";
import { useToast } from "~/components/Toast";
import { getBackendConnectionStatus } from "~/lib/queryClient";

// Query key factory
export const proxyQueryKeys = {
  all: ["proxy"] as const,
  routes: ["proxy", "routes"] as const,
  route: (id: number) => ["proxy", "routes", id] as const,
  settings: ["proxy", "settings"] as const,
} as const;

/**
 * Hook to fetch all proxy routes
 */
export function useProxyRoutesQuery() {
  return useQuery({
    queryKey: proxyQueryKeys.routes,
    queryFn: () => proxyService.getAll(),
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: () => getBackendConnectionStatus(),
  });
}

/**
 * Hook to fetch proxy settings
 */
export function useProxySettingsQuery() {
  return useQuery({
    queryKey: proxyQueryKeys.settings,
    queryFn: () => proxyService.getSettings(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Combined hook for proxy data
 */
export function useProxyDataQuery() {
  const routesQuery = useProxyRoutesQuery();
  const settingsQuery = useProxySettingsQuery();

  return {
    routes: routesQuery.data || [],
    settings: settingsQuery.data || null,
    isLoading: routesQuery.isLoading || settingsQuery.isLoading,
    isError: routesQuery.isError || settingsQuery.isError,
    error: routesQuery.error || settingsQuery.error,
    refetch: async () => {
      await Promise.all([routesQuery.refetch(), settingsQuery.refetch()]);
    },
  };
}

/**
 * Hook to create a proxy route
 */
export function useCreateProxyRouteMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: CreateProxyRouteDto) => proxyService.create(data),
    onSuccess: (newRoute) => {
      queryClient.setQueryData<ProxyRoute[]>(proxyQueryKeys.routes, (old = []) => 
        [...old, newRoute]
      );
      toast.success("Route created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create route");
    },
  });
}

/**
 * Hook to update a proxy route
 */
export function useUpdateProxyRouteMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateProxyRouteDto> }) =>
      proxyService.update(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData<ProxyRoute[]>(proxyQueryKeys.routes, (old = []) =>
        old.map((r) => (r.id === updated.id ? updated : r))
      );
      toast.success("Route updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update route");
    },
  });
}

/**
 * Hook to delete a proxy route
 */
export function useDeleteProxyRouteMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: number) => proxyService.delete(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<ProxyRoute[]>(proxyQueryKeys.routes, (old = []) =>
        old.filter((r) => r.id !== id)
      );
      toast.success("Route deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete route");
    },
  });
}

/**
 * Hook to toggle proxy route enabled state
 */
export function useToggleProxyRouteMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: number) => proxyService.toggleEnabled(id),
    onSuccess: (updated) => {
      queryClient.setQueryData<ProxyRoute[]>(proxyQueryKeys.routes, (old = []) =>
        old.map((r) => (r.id === updated.id ? updated : r))
      );
      toast.success(`Route ${updated.isEnabled ? "enabled" : "disabled"}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to toggle route");
    },
  });
}

/**
 * Hook to test proxy route health
 */
export function useTestProxyHealthMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: number) => proxyService.testHealth(id).then((health) => ({ id, health })),
    onSuccess: ({ id, health }) => {
      queryClient.setQueryData<ProxyRoute[]>(proxyQueryKeys.routes, (old = []) =>
        old.map((r) =>
          r.id === id
            ? { ...r, isHealthy: health.isHealthy, lastHealthCheck: new Date().toISOString() }
            : r
        )
      );
      
      if (health.isHealthy) {
        toast.success(`Target is healthy (${health.responseTimeMs}ms)`);
      } else {
        toast.warning(`Target unreachable: ${health.error || "Unknown error"}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to check health");
    },
  });
}

/**
 * Hook to update proxy settings
 */
export function useUpdateProxySettingsMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: UpdateProxySettingsDto) => proxyService.updateSettings(data),
    onSuccess: (updated) => {
      queryClient.setQueryData<ProxySettings>(proxyQueryKeys.settings, updated);
      toast.success("Settings saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save settings");
    },
  });
}
