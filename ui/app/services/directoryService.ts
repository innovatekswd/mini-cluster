import { apiClient } from "../lib/apiClient";

export interface WatchedDirectory {
  id: string;
  path: string;
  label: string;
  recursive: boolean;
  interval_seconds: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DirectorySnapshot {
  id: string;
  watched_directory_id: string;
  scanned_at: string;
  total_size_bytes: number;
  file_count: number;
  dir_count: number;
  sub_path: string;
}

export interface CreateDirectoryRequest {
  path: string;
  label: string;
  recursive: boolean;
  intervalSeconds: number;
}

export interface UpdateDirectoryRequest {
  path?: string;
  label?: string;
  recursive?: boolean;
  intervalSeconds?: number;
  enabled?: boolean;
}

export const directoryService = {
  async list(): Promise<WatchedDirectory[]> {
    const res = await apiClient.get("/api/directories");
    return res.data;
  },

  async create(req: CreateDirectoryRequest): Promise<WatchedDirectory> {
    const res = await apiClient.post("/api/directories", req);
    return res.data;
  },

  async get(id: string): Promise<WatchedDirectory> {
    const res = await apiClient.get(`/api/directories/${id}`);
    return res.data;
  },

  async update(id: string, req: UpdateDirectoryRequest): Promise<WatchedDirectory> {
    const res = await apiClient.put(`/api/directories/${id}`, req);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/directories/${id}`);
  },

  async getSnapshots(id: string, from?: string, to?: string): Promise<DirectorySnapshot[]> {
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    const res = await apiClient.get(`/api/directories/${id}/snapshots?${params.toString()}`);
    return res.data;
  },
};
