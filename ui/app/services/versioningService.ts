import apiClient from "~/lib/apiClient";
import type {
  ServiceVersion,
  CreateVersionDto,
  DeploymentResult,
  DeploymentConfig,
  UpdateDeploymentConfigDto,
  AppSnapshot,
  CreateAppSnapshotDto,
} from "~/types/PostMvpTypes";

export const versioningService = {
  // ── Service Versions ─────────────────────────────────────────

  async getVersions(serviceId: string): Promise<ServiceVersion[]> {
    const res = await apiClient.get(`/api/services/${serviceId}/versions`);
    return res.data;
  },

  async createVersion(serviceId: string, data: CreateVersionDto): Promise<ServiceVersion> {
    const res = await apiClient.post(`/api/services/${serviceId}/versions`, data);
    return res.data;
  },

  async getVersion(versionId: number): Promise<ServiceVersion> {
    const res = await apiClient.get(`/api/service-versions/${versionId}`);
    return res.data;
  },

  async deployVersion(versionId: number): Promise<DeploymentResult> {
    const res = await apiClient.post(`/api/service-versions/${versionId}/deploy`);
    return res.data;
  },

  async rollback(serviceId: string): Promise<DeploymentResult> {
    const res = await apiClient.post(`/api/services/${serviceId}/rollback`);
    return res.data;
  },

  // ── Deployment Config ────────────────────────────────────────

  async getDeploymentConfig(serviceId: string): Promise<DeploymentConfig> {
    const res = await apiClient.get(`/api/services/${serviceId}/deployment-config`);
    return res.data;
  },

  async updateDeploymentConfig(
    serviceId: string,
    data: UpdateDeploymentConfigDto
  ): Promise<DeploymentConfig> {
    const res = await apiClient.put(`/api/services/${serviceId}/deployment-config`, data);
    return res.data;
  },

  // ── App Snapshots ────────────────────────────────────────────

  async getSnapshots(appId: string): Promise<AppSnapshot[]> {
    const res = await apiClient.get(`/api/apps/${appId}/snapshots`);
    return res.data;
  },

  async createSnapshot(appId: string, data: CreateAppSnapshotDto): Promise<AppSnapshot> {
    const res = await apiClient.post(`/api/apps/${appId}/snapshots`, data);
    return res.data;
  },

  async getSnapshot(snapshotId: number): Promise<AppSnapshot> {
    const res = await apiClient.get(`/api/app-snapshots/${snapshotId}`);
    return res.data;
  },

  async deploySnapshot(snapshotId: number): Promise<DeploymentResult> {
    const res = await apiClient.post(`/api/app-snapshots/${snapshotId}/deploy`);
    return res.data;
  },
};
