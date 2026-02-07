import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { versioningService } from "~/services/versioningService";
import { useToast } from "~/components/Toast";
import { getApiErrorMessage } from "~/lib/apiClient";
import type {
  CreateVersionDto,
  UpdateDeploymentConfigDto,
  CreateAppSnapshotDto,
} from "~/types/PostMvpTypes";

export const versionQueryKeys = {
  versions: (serviceId: string) => ["serviceVersions", serviceId] as const,
  deploymentConfig: (serviceId: string) => ["deploymentConfig", serviceId] as const,
  snapshots: (appId: string) => ["appSnapshots", appId] as const,
};

// ── Service Versions ─────────────────────────────────────────

export function useServiceVersionsQuery(serviceId: string) {
  return useQuery({
    queryKey: versionQueryKeys.versions(serviceId),
    queryFn: () => versioningService.getVersions(serviceId),
    enabled: !!serviceId,
  });
}

export function useCreateVersionMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ serviceId, data }: { serviceId: string; data: CreateVersionDto }) =>
      versioningService.createVersion(serviceId, data),
    onSuccess: (version, { serviceId }) => {
      qc.invalidateQueries({ queryKey: versionQueryKeys.versions(serviceId) });
      toast.success(`Version ${version.version} created`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to create version")),
  });
}

export function useDeployVersionMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (versionId: number) => versioningService.deployVersion(versionId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["serviceVersions"] });
      toast.success(result.message || "Version deployed");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to deploy version")),
  });
}

export function useRollbackMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (serviceId: string) => versioningService.rollback(serviceId),
    onSuccess: (result, serviceId) => {
      qc.invalidateQueries({ queryKey: versionQueryKeys.versions(serviceId) });
      toast.success(result.message || "Rolled back");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Rollback failed")),
  });
}

// ── Deployment Config ────────────────────────────────────────

export function useDeploymentConfigQuery(serviceId: string) {
  return useQuery({
    queryKey: versionQueryKeys.deploymentConfig(serviceId),
    queryFn: () => versioningService.getDeploymentConfig(serviceId),
    enabled: !!serviceId,
  });
}

export function useUpdateDeploymentConfigMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ serviceId, data }: { serviceId: string; data: UpdateDeploymentConfigDto }) =>
      versioningService.updateDeploymentConfig(serviceId, data),
    onSuccess: (_, { serviceId }) => {
      qc.invalidateQueries({ queryKey: versionQueryKeys.deploymentConfig(serviceId) });
      toast.success("Deployment config updated");
    },
    onError: (err) =>
      toast.error(getApiErrorMessage(err, "Failed to update deployment config")),
  });
}

// ── App Snapshots ────────────────────────────────────────────

export function useAppSnapshotsQuery(appId: string) {
  return useQuery({
    queryKey: versionQueryKeys.snapshots(appId),
    queryFn: () => versioningService.getSnapshots(appId),
    enabled: !!appId,
  });
}

export function useCreateSnapshotMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ appId, data }: { appId: string; data: CreateAppSnapshotDto }) =>
      versioningService.createSnapshot(appId, data),
    onSuccess: (snapshot, { appId }) => {
      qc.invalidateQueries({ queryKey: versionQueryKeys.snapshots(appId) });
      toast.success(`Snapshot ${snapshot.version} created`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to create snapshot")),
  });
}

export function useDeploySnapshotMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (snapshotId: number) => versioningService.deploySnapshot(snapshotId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["appSnapshots"] });
      qc.invalidateQueries({ queryKey: ["serviceVersions"] });
      toast.success(result.message || "Snapshot deployed");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to deploy snapshot")),
  });
}
