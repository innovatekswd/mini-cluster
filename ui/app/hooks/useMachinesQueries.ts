/**
 * React Query hooks for Machines API
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { machineService } from "~/services/machineService";
import { serviceService } from "~/services/appService";
import type { Machine, CreateMachineDto } from "~/types/Phase5Types";
import type { Service } from "~/types/Service";
import { useToast } from "~/components/Toast";
import { getBackendConnectionStatus } from "~/lib/queryClient";

// Query key factory
export const machinesQueryKeys = {
  all: ["machines"] as const,
  detail: (id: string) => ["machines", id] as const,
  services: (machineId: string) => ["machines", machineId, "services"] as const,
  allWithServices: ["machines", "withServices"] as const,
} as const;

/**
 * Hook to fetch all machines
 */
export function useMachinesQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: machinesQueryKeys.all,
    queryFn: () => machineService.getAll(),
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: () => getBackendConnectionStatus(),
    ...options,
  });
}

/**
 * Hook to fetch a single machine by ID
 */
export function useMachineDetailQuery(id: string | null) {
  return useQuery({
    queryKey: id ? machinesQueryKeys.detail(id) : ["machines", "null"],
    queryFn: () => (id ? machineService.getById(id) : null),
    enabled: !!id,
  });
}

/**
 * Hook to fetch services for a specific machine
 */
export function useMachineServicesQuery(machineId: string | null) {
  return useQuery({
    queryKey: machineId ? machinesQueryKeys.services(machineId) : ["machines", "null", "services"],
    queryFn: () => (machineId ? serviceService.getByMachine(machineId) : []),
    enabled: !!machineId,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to fetch all machines with their services
 */
export function useMachinesWithServicesQuery() {
  const machinesQuery = useMachinesQuery();
  const queryClient = useQueryClient();

  // Fetch services for all machines
  const servicesMap = useQuery({
    queryKey: machinesQueryKeys.allWithServices,
    queryFn: async () => {
      const machines = machinesQuery.data || [];
      const servicesMap: Record<string, Service[]> = {};
      
      await Promise.all(
        machines.map(async (m) => {
          try {
            const services = await serviceService.getByMachine(m.id);
            servicesMap[m.id] = services;
          } catch {
            servicesMap[m.id] = [];
          }
        })
      );
      
      return servicesMap;
    },
    enabled: !!machinesQuery.data && machinesQuery.data.length > 0,
    staleTime: 30 * 1000,
  });

  return {
    machines: machinesQuery.data || [],
    services: servicesMap.data || {},
    isLoading: machinesQuery.isLoading || servicesMap.isLoading,
    isError: machinesQuery.isError || servicesMap.isError,
    error: machinesQuery.error || servicesMap.error,
    refetch: async () => {
      await machinesQuery.refetch();
      await servicesMap.refetch();
    },
  };
}

/**
 * Hook to create a new machine
 */
export function useCreateMachineMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: CreateMachineDto) => machineService.create(data),
    onSuccess: (newMachine) => {
      toast.success(`Machine "${newMachine.name}" created`);
      queryClient.invalidateQueries({ queryKey: machinesQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create machine");
    },
  });
}

/**
 * Hook to update a machine
 */
export function useUpdateMachineMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateMachineDto> }) =>
      machineService.update(id, data),
    onSuccess: (_, { id }) => {
      toast.success("Machine updated");
      queryClient.invalidateQueries({ queryKey: machinesQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: machinesQueryKeys.detail(id) });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update machine");
    },
  });
}

/**
 * Hook to delete a machine
 */
export function useDeleteMachineMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => machineService.delete(id),
    onSuccess: () => {
      toast.success("Machine deleted");
      queryClient.invalidateQueries({ queryKey: machinesQueryKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete machine");
    },
  });
}

/**
 * Hook to test machine connection
 */
export function useTestConnectionMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      machineService.testConnection(id).then((result) => ({ ...result, name })),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`${result.name}: Connected (${result.latencyMs}ms)`);
      } else {
        toast.error(`${result.name}: ${result.message}`);
      }
      // Refresh machines to update status
      queryClient.invalidateQueries({ queryKey: machinesQueryKeys.all });
    },
    onError: (error: Error, { name }) => {
      toast.error(`Failed to test connection to ${name}`);
    },
  });
}
