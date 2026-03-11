import apiClient from "~/lib/apiClient";
import axios from "axios";
import type { Environment, CreateEnvironmentDto, UpdateEnvironmentDto } from "~/types/Environment";

export const environmentService = {
  // GET /api/envs
  async getAll(): Promise<Environment[]> {
    const response = await apiClient.get('/api/envs');
    return response.data;
  },

  // GET /api/envs/{name}
  async getByName(name: string): Promise<Environment> {
    const res = await apiClient.get(`/api/envs/${encodeURIComponent(name)}`);
    return res.data;
  },

  // POST /api/envs
  async create(env: CreateEnvironmentDto): Promise<Environment> {
    const response = await apiClient.post('/api/envs', env);
    return response.data;
  },

  // PUT /api/envs/{name}
  async update(name: string, env: UpdateEnvironmentDto): Promise<Environment> {
    const response = await apiClient.put(`/api/envs/${encodeURIComponent(name)}`, env);
    return response.data;
  },

  // DELETE /api/envs/{name}
  async delete(name: string): Promise<void> {
    await apiClient.delete(`/api/envs/${encodeURIComponent(name)}`);
  },

  // POST /api/envs/{name}/activate
  async setActive(name: string): Promise<void> {
    await apiClient.post(`/api/envs/${encodeURIComponent(name)}/activate`);
  },

  // GET /api/envs/active
  async getActive(): Promise<Environment | null> {
    try {
      const res = await apiClient.get("/api/envs/active");
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // POST /api/envs/import
  async importEnvironments(file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    await apiClient.post("/api/envs/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 300_000, // 5 min for import
    });
  },

  // POST /api/envs/export
  async exportEnvironments(): Promise<Blob> {
    const response = await apiClient.post("/api/envs/export", {}, {
      responseType: 'blob'
    });
    return response.data;
  }
};