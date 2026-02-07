import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appTreeService } from "~/services/appTreeService";
import { useToast } from "~/components/Toast";
import { getApiErrorMessage } from "~/lib/apiClient";
import type { MoveAppDto } from "~/types/PostMvpTypes";

export const treeQueryKeys = {
  tree: ["appTree"] as const,
  subtree: (appId: string) => ["appTree", "subtree", appId] as const,
};

export function useAppTreeQuery() {
  return useQuery({
    queryKey: treeQueryKeys.tree,
    queryFn: () => appTreeService.getTree(),
    staleTime: 30_000,
  });
}

export function useAppSubtreeQuery(appId: string) {
  return useQuery({
    queryKey: treeQueryKeys.subtree(appId),
    queryFn: () => appTreeService.getSubtree(appId),
    enabled: !!appId,
  });
}

export function useMoveAppMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ appId, data }: { appId: string; data: MoveAppDto }) =>
      appTreeService.moveApp(appId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treeQueryKeys.tree });
      qc.invalidateQueries({ queryKey: ["appsWithStats"] });
      toast.success("App moved");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to move app")),
  });
}

export function useStartTreeMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (appId: string) => appTreeService.startTree(appId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treeQueryKeys.tree });
      toast.success("Tree start initiated");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to start tree")),
  });
}

export function useStopTreeMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (appId: string) => appTreeService.stopTree(appId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treeQueryKeys.tree });
      toast.success("Tree stop initiated");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to stop tree")),
  });
}

export function useRestartTreeMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (appId: string) => appTreeService.restartTree(appId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: treeQueryKeys.tree });
      toast.success("Tree restart initiated");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to restart tree")),
  });
}
