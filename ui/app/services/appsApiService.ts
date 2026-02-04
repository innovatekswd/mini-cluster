import apiClient from "~/lib/apiClient";
import type { App, AppWithStats, CreateAppDto, UpdateAppDto } from "~/types/App";

export const appsApiService = {
  /**
   * Get all apps with service statistics
   */
  async getAll(): Promise<AppWithStats[]> {
    const res = await apiClient.get("/api/Apps");
    return res.data;
  },

  /**
   * Get a single app by ID
   */
  async getById(id: string): Promise<App> {
    const res = await apiClient.get(`/api/Apps/${id}`);
    return res.data;
  },

  /**
   * Create a new app
   */
  async create(data: CreateAppDto): Promise<App> {
    const res = await apiClient.post("/api/Apps", data);
    return res.data;
  },

  /**
   * Update an existing app
   */
  async update(id: string, data: UpdateAppDto): Promise<void> {
    await apiClient.put(`/api/Apps/${id}`, data);
  },

  /**
   * Delete an app (services become unassigned)
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/Apps/${id}`);
  },

  /**
   * Reorder apps by providing ordered array of IDs
   */
  async reorder(orderedIds: string[]): Promise<void> {
    await apiClient.post("/api/Apps/reorder", orderedIds);
  },

  /**
   * Clone an app (creates a copy with all its services)
   */
  async clone(id: string): Promise<App> {
    const res = await apiClient.post(`/api/Apps/${id}/clone`);
    return res.data;
  },

  /**
   * Seed sample apps and services for testing
   */
  async seed(): Promise<{ message: string }> {
    const res = await apiClient.post("/api/Apps/seed");
    return res.data;
  },
};
