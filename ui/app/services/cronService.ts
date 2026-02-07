import apiClient from "~/lib/apiClient";
import type {
  CronJob,
  CronJobRun,
  CreateCronJobDto,
  UpdateCronJobDto,
} from "~/types/PostMvpTypes";

export const cronService = {
  async getAll(): Promise<CronJob[]> {
    const res = await apiClient.get("/api/cron");
    return res.data;
  },

  async getById(id: string): Promise<CronJob> {
    const res = await apiClient.get(`/api/cron/${id}`);
    return res.data;
  },

  async create(data: CreateCronJobDto): Promise<CronJob> {
    const res = await apiClient.post("/api/cron", data);
    return res.data;
  },

  async update(id: string, data: UpdateCronJobDto): Promise<CronJob> {
    const res = await apiClient.put(`/api/cron/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/cron/${id}`);
  },

  async enable(id: string): Promise<void> {
    await apiClient.post(`/api/cron/${id}/enable`);
  },

  async disable(id: string): Promise<void> {
    await apiClient.post(`/api/cron/${id}/disable`);
  },

  async trigger(id: string): Promise<CronJobRun> {
    const res = await apiClient.post(`/api/cron/${id}/trigger`);
    return res.data;
  },

  async getRuns(id: string, limit = 50): Promise<CronJobRun[]> {
    const res = await apiClient.get(`/api/cron/${id}/runs`, { params: { limit } });
    return res.data;
  },

  async getRun(runId: string): Promise<CronJobRun> {
    const res = await apiClient.get(`/api/cron/runs/${runId}`);
    return res.data;
  },
};
