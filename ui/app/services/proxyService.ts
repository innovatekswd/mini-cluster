import apiClient from "~/lib/apiClient";
import type { 
  ProxyRoute, 
  CreateProxyRouteDto, 
  ProxySettings, 
  UpdateProxySettingsDto,
  ProxyHealthCheck 
} from "~/types/ProxyRoute";

const API_BASE = "/api/proxy-routes";
const SETTINGS_BASE = "/api/proxy-settings";

export const proxyService = {
  // Proxy Routes
  async getAll(): Promise<ProxyRoute[]> {
    const res = await apiClient.get(API_BASE);
    return res.data;
  },

  async getById(id: number): Promise<ProxyRoute> {
    const res = await apiClient.get(`${API_BASE}/${id}`);
    return res.data;
  },

  async create(data: CreateProxyRouteDto): Promise<ProxyRoute> {
    const res = await apiClient.post(API_BASE, data);
    return res.data;
  },

  async update(id: number, data: Partial<CreateProxyRouteDto>): Promise<ProxyRoute> {
    const res = await apiClient.put(`${API_BASE}/${id}`, data);
    return res.data;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`${API_BASE}/${id}`);
  },

  async toggleEnabled(id: number): Promise<ProxyRoute> {
    const res = await apiClient.patch(`${API_BASE}/${id}/toggle`);
    return res.data;
  },

  async testHealth(id: number): Promise<ProxyHealthCheck> {
    const res = await apiClient.post(`${API_BASE}/${id}/test-health`);
    return res.data;
  },

  // Proxy Settings
  async getSettings(): Promise<ProxySettings> {
    const res = await apiClient.get(SETTINGS_BASE);
    return res.data;
  },

  async updateSettings(data: UpdateProxySettingsDto): Promise<ProxySettings> {
    const res = await apiClient.put(SETTINGS_BASE, data);
    return res.data;
  },

  async getServerIp(): Promise<{ ip: string }> {
    const res = await apiClient.get(`${SETTINGS_BASE}/server-ip`);
    return res.data;
  },
};
