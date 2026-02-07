import apiClient from "~/lib/apiClient";
import type {
  ContainerConfig,
  CreateContainerConfigDto,
} from "~/types/PostMvpTypes";

export const containerService = {
  async get(serviceId: string): Promise<ContainerConfig | null> {
    try {
      const res = await apiClient.get(`/api/services/${serviceId}/container`);
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },

  async upsert(serviceId: string, data: CreateContainerConfigDto): Promise<ContainerConfig> {
    const res = await apiClient.put(`/api/services/${serviceId}/container`, data);
    return res.data;
  },

  async remove(serviceId: string): Promise<void> {
    await apiClient.delete(`/api/services/${serviceId}/container`);
  },
};
