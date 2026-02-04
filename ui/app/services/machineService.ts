import apiClient from "~/lib/apiClient";
import type {
  Machine,
  MachineWithServices,
  CreateMachineDto,
} from "~/types/Phase5Types";

export const machineService = {
  async getAll(): Promise<Machine[]> {
    const res = await apiClient.get("/api/machines");
    return res.data;
  },

  async getById(id: string): Promise<Machine> {
    const res = await apiClient.get(`/api/machines/${id}`);
    return res.data;
  },

  async getWithServices(id: string): Promise<MachineWithServices> {
    const res = await apiClient.get(`/api/machines/${id}/services`);
    return res.data;
  },

  async getLocalMachine(): Promise<Machine> {
    const res = await apiClient.get("/api/machines/local");
    return res.data;
  },

  async create(data: CreateMachineDto): Promise<Machine> {
    const res = await apiClient.post("/api/machines", data);
    return res.data;
  },

  async update(id: string, data: Partial<CreateMachineDto>): Promise<Machine> {
    const res = await apiClient.put(`/api/machines/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/machines/${id}`);
  },

  async testConnection(id: string): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const res = await apiClient.post(`/api/machines/${id}/test`);
    return res.data;
  },
};
