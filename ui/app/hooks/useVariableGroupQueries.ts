import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { variableGroupService } from "../services/variableGroupService";
import type {
  VariableGroup,
  CreateVariableGroupDto,
  UpdateVariableGroupDto,
} from "~/types/VariableGroup";

// Query Keys
export const variableGroupQueryKeys = {
  all: ["variableGroups"] as const,
  detail: (id: string) =>
    [...variableGroupQueryKeys.all, "detail", id] as const,
  active: () => [...variableGroupQueryKeys.all, "active"] as const,
} as const;

// Get All Variable Groups Query
export function useVariableGroupsQuery() {
  return useQuery({
    queryKey: variableGroupQueryKeys.all,
    queryFn: () => variableGroupService.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get Variable Group by ID Query
export function useVariableGroupQuery(id: string) {
  return useQuery({
    queryKey: variableGroupQueryKeys.detail(id),
    queryFn: () => variableGroupService.getById(id),
    enabled: !!id,
  });
}

// Get Active Variable Group Query
export function useActiveVariableGroupQuery() {
  return useQuery({
    queryKey: variableGroupQueryKeys.active(),
    queryFn: () => variableGroupService.getActive(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Create Variable Group Mutation
export function useCreateVariableGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVariableGroupDto) =>
      variableGroupService.create(data),
    onSuccess: (newGroup) => {
      // Add new group to the list cache
      queryClient.setQueryData(
        variableGroupQueryKeys.all,
        (oldGroups: VariableGroup[] | undefined) => {
          if (!oldGroups) return [newGroup];
          return [...oldGroups, newGroup];
        }
      );
    },
  });
}

// Update Variable Group Mutation
export function useUpdateVariableGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVariableGroupDto }) =>
      variableGroupService.update(id, data),
    onSuccess: (updatedGroupFromServer, { id }) => {
      // Update group in the list cache, preserving client-side isActive status
      queryClient.setQueryData<VariableGroup[] | undefined>(
        variableGroupQueryKeys.all,
        (oldGroups) => {
          if (!oldGroups) return undefined;
          return oldGroups.map((cachedGroup) => {
            if (cachedGroup.id === id) {
              return {
                ...updatedGroupFromServer, // Data from server (name, vars, etc.)
                isActive: cachedGroup.isActive, // Preserve isActive from the current list cache
              };
            }
            return cachedGroup;
          });
        }
      );

      // Update individual group detail cache, also preserving/setting consistent isActive
      const updatedListCache = queryClient.getQueryData<VariableGroup[]>(
        variableGroupQueryKeys.all
      );
      const groupFromUpdatedList = updatedListCache?.find((g) => g.id === id);

      queryClient.setQueryData<VariableGroup | undefined>(
        variableGroupQueryKeys.detail(id),
        (currentDetail) => {
          // Ensure updatedGroupFromServer is defined before spreading
          if (!updatedGroupFromServer) return currentDetail;
          return {
            ...updatedGroupFromServer,
            isActive:
              groupFromUpdatedList?.isActive ??
              currentDetail?.isActive ??
              false,
          };
        }
      );

      // Invalidate the active query to refetch if this group was active
      queryClient.invalidateQueries({
        queryKey: variableGroupQueryKeys.active(),
      });
    },
  });
}

// Delete Variable Group Mutation
export function useDeleteVariableGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => variableGroupService.delete(id),
    onSuccess: (_, id) => {
      // Remove group from list cache
      queryClient.setQueryData(
        variableGroupQueryKeys.all,
        (oldGroups: VariableGroup[] | undefined) => {
          if (!oldGroups) return oldGroups;
          return oldGroups.filter((group) => group.id !== id);
        }
      );

      // Remove individual group cache
      queryClient.removeQueries({
        queryKey: variableGroupQueryKeys.detail(id),
      });

      // Invalidate active group if this was the active one
      queryClient.invalidateQueries({
        queryKey: variableGroupQueryKeys.active(),
      });
    },
  });
}

// Set Active Variable Group Mutation
export function useSetActiveVariableGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => variableGroupService.setActive(id),
    onSuccess: (_, id) => {
      // Update active group cache
      queryClient.invalidateQueries({
        queryKey: variableGroupQueryKeys.active(),
      });

      // Update all groups to reflect the new active state
      queryClient.setQueryData(
        variableGroupQueryKeys.all,
        (oldGroups: VariableGroup[] | undefined) => {
          if (!oldGroups) return oldGroups;
          return oldGroups.map((group) => ({
            ...group,
            isActive: group.id === id,
          }));
        }
      );
    },
  });
}

// Import Variable Groups Mutation
export function useImportVariableGroupsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => variableGroupService.importGroups(file),
    onSuccess: () => {
      // Refetch all groups after import
      queryClient.invalidateQueries({ queryKey: variableGroupQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: variableGroupQueryKeys.active(),
      });
    },
  });
}

// Export Variable Groups Mutation
export function useExportVariableGroupsMutation() {
  return useMutation({
    mutationFn: () => variableGroupService.exportGroups(),
  });
}
