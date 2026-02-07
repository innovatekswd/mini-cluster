import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { containerService } from "~/services/containerService";
import { useToast } from "~/components/Toast";
import { getApiErrorMessage } from "~/lib/apiClient";
import type { CreateContainerConfigDto } from "~/types/PostMvpTypes";

export const containerQueryKeys = {
  config: (serviceId: string) => ["containerConfig", serviceId] as const,
};

export function useContainerConfigQuery(serviceId: string) {
  return useQuery({
    queryKey: containerQueryKeys.config(serviceId),
    queryFn: () => containerService.get(serviceId),
    enabled: !!serviceId,
  });
}

export function useUpsertContainerConfigMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ serviceId, data }: { serviceId: string; data: CreateContainerConfigDto }) =>
      containerService.upsert(serviceId, data),
    onSuccess: (_, { serviceId }) => {
      qc.invalidateQueries({ queryKey: containerQueryKeys.config(serviceId) });
      toast.success("Container config saved");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to save container config")),
  });
}

export function useRemoveContainerConfigMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (serviceId: string) => containerService.remove(serviceId),
    onSuccess: (_, serviceId) => {
      qc.invalidateQueries({ queryKey: containerQueryKeys.config(serviceId) });
      toast.success("Container config removed");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to remove container config")),
  });
}
