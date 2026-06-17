import apiClient from "~/lib/apiClient";

export interface SystemInfo {
  os: string;
  arch: string;
  runtime: string;
  isService: boolean;
  serviceType: "windows" | "systemd" | "none";
  serviceName: string;
  version: string;
  gitCommit: string;
  buildTime: string;
}

export const systemService = {
  async getInfo(): Promise<SystemInfo> {
    const res = await apiClient.get("/api/system/info");
    return res.data;
  },

  async installService(): Promise<{ message: string; serviceName: string }> {
    const res = await apiClient.post("/api/system/service/install");
    return res.data;
  },

  async uninstallService(): Promise<{ message: string }> {
    const res = await apiClient.delete("/api/system/service/uninstall");
    return res.data;
  },
};
