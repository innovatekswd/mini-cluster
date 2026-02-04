import axios from "axios";
import apiClient from "~/lib/apiClient";
import { type Service, type ServiceFormData } from "~/types/Service";
import { ApiError, isAxiosApiError } from "~/types/ApiError";
import { type VariableGroup } from "~/types/VariableGroup";

export interface HealthStatus {
  status: string;
  timestamp?: string;
  version?: string;
}

// Response from service control actions (start/stop/restart)
export interface ServiceControlResponse {
  success: boolean;
  errorMessage?: string;
  errorDetails?: string;  // Detailed error with actionable guidance
}

// Export configuration response
export interface ConfigExport {
  version: string;
  exportedAt: string;
  exportedBy: string;
  variableGroups: VariableGroup[];
  services: Service[];
  metadata: {
    totalServices: number;
    totalVariableGroups: number;
  };
}

export const serviceService = {
  // Health check is anonymous - use raw axios
  async checkHealth(): Promise<HealthStatus> {
    const res = await axios.get("/api/health", { timeout: 5000 });
    return res.data;
  },
  async getAll(): Promise<Service[]> {
    const res = await apiClient.get("/api/services");
    return res.data;
  },
  
  async getById(id: string): Promise<Service> {
    const res = await apiClient.get(`/api/services/${id}`);
    return res.data;
  },
  
  async getStatus(serviceId: string): Promise<string> {
    const res = await apiClient.get(`/api/services/${serviceId}/exec/status`);
    // Ensure we always return a string, fallback to "Unknown" if status is missing
    return res.data?.status ?? res.data ?? "Unknown";
  },
  
  async getAllStatuses(appId?: string): Promise<Record<string, string>> {
    const url = appId ? `/api/services/statuses?appId=${appId}` : "/api/services/statuses";
    const res = await apiClient.get(url);
    return res.data;
  },
  async control(serviceId: string, action: "start" | "stop" | "restart"): Promise<ServiceControlResponse> {
    try {
      const res = await apiClient.post(`/api/services/${serviceId}/exec/${action}`);
      const response: ServiceControlResponse = res.data;
      
      // If the backend indicates failure, throw an error with details
      if (response.success === false) {
        throw new ApiError(response.errorMessage || `Failed to ${action} service`, 400, {
          details: response.errorDetails,
          serviceId,
        });
      }
      
      return response;
    } catch (err: unknown) {
      // Re-throw ApiError as-is
      if (err instanceof ApiError) {
        throw err;
      }
      
      // Handle axios error responses (400, 500, etc.)
      if (isAxiosApiError(err)) {
        throw ApiError.fromAxiosError(err);
      }
      
      throw ApiError.fromUnknown(err);
    }
  },
  
  async getArgs(serviceId: string): Promise<string> {
    const res = await apiClient.get(`/api/services/${serviceId}/args`);
    return res.data;
  },
  async updateArgs(serviceId: string, args: string): Promise<string> {
    const res = await apiClient.put(`/api/services/${serviceId}/args`, { args });
    return res.data;
  },
  async getEnv(serviceId: string): Promise<EnvVar[]> {
    const res = await apiClient.get(`/api/services/${serviceId}/env`);
    return res.data;
  },
  async updateEnv(serviceId: string, envVars: EnvVar[]): Promise<EnvVar[]> {
    const res = await apiClient.put(`/api/services/${serviceId}/env`, envVars);
    return res.data;
  },
  async updateService(
    serviceId: string,
    serviceData: Partial<Service>
  ): Promise<Service> {
    console.debug("Calling updateService with data:", serviceData);
    const res = await apiClient.put(`/api/services/${serviceId}`, serviceData);
    return res.data;
  },
  async deleteService(serviceId: string): Promise<void> {
    await apiClient.delete(`/api/services/${serviceId}`);
  },
  async importServices(file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await apiClient.post("/api/services/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    console.debug("Services imported successfully:", res.data);
  },

  async exportServices(): Promise<ConfigExport> {
    const res = await apiClient.get("/api/services/export");
    console.debug("Services exported successfully:", res.data);
    return res.data;
  },
  async createService(data: ServiceFormData): Promise<Service> {
    const res = await apiClient.post("/api/services", data);
    return res.data;
  },
  async cloneService(serviceId: string): Promise<Service> {
    const res = await apiClient.post(`/api/services/${serviceId}/clone`);
    return res.data;
  },
  
  // Direct control methods (use /api/services/{id}/start|stop|restart endpoints)
  async start(serviceId: string): Promise<Service> {
    const res = await apiClient.post(`/api/services/${serviceId}/start`);
    return res.data;
  },
  async stop(serviceId: string): Promise<Service> {
    const res = await apiClient.post(`/api/services/${serviceId}/stop`);
    return res.data;
  },
  async restart(serviceId: string): Promise<Service> {
    const res = await apiClient.post(`/api/services/${serviceId}/restart`);
    return res.data;
  },
  
  // Filtered queries
  async getByApp(appId: string): Promise<Service[]> {
    const res = await apiClient.get(`/api/services?appId=${appId}`);
    return res.data;
  },
  async getByMachine(machineId: string): Promise<Service[]> {
    const res = await apiClient.get(`/api/services?machineId=${machineId}`);
    return res.data;
  },
  
  // Move service between apps
  async move(serviceId: string, targetAppId: string): Promise<Service> {
    const res = await apiClient.post(`/api/services/${serviceId}/move?targetAppId=${targetAppId}`);
    return res.data;
  },
};

export type EnvVar = {
  key: string;
  value: string;
};
