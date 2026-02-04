import apiClient from "~/lib/apiClient";
import axios from "axios";
import type { VariableGroup, CreateVariableGroupDto, UpdateVariableGroupDto } from "~/types/VariableGroup";

export const variableGroupService = {
  // GET /api/variables/groups
  async getAll(): Promise<VariableGroup[]> {
    const response = await apiClient.get('/api/variables/groups');
    return response.data;
  },

  // GET /api/variables/groups/{id}
  async getById(id: string): Promise<VariableGroup> {
    const res = await apiClient.get(`/api/variables/groups/${id}`);
    return res.data;
  },

  // POST /api/variables/groups
  async create(group: CreateVariableGroupDto): Promise<VariableGroup> {
    const response = await apiClient.post('/api/variables/groups', group);
    return response.data;
  },

  // PUT /api/variables/groups/{id}
  async update(id: string, group: UpdateVariableGroupDto): Promise<VariableGroup> {
    const response = await apiClient.put(`/api/variables/groups/${id}`, group);
    return response.data;
  },

  // DELETE /api/variables/groups/{id}
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/variables/groups/${id}`);
  },

  // POST /api/variables/groups/{id}/activate
  async setActive(id: string): Promise<void> {
    await apiClient.post(`/api/variables/groups/${id}/activate`);
  },

  // GET /api/variables/groups/active
  async getActive(): Promise<VariableGroup | null> {
    try {
      const res = await apiClient.get("/api/variables/groups/active");
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // POST /api/variables/groups/import
  async importGroups(file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    await apiClient.post("/api/variables/groups/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // POST /api/variables/groups/export
  async exportGroups(): Promise<Blob> {
    const response = await apiClient.post("/api/variables/groups/export", {}, {
      responseType: 'blob'
    });
    return response.data;
  }
};