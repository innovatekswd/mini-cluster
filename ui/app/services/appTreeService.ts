import apiClient from "~/lib/apiClient";
import type {
  AppTreeNode,
  MoveAppDto,
  ReorderChildrenDto,
} from "~/types/PostMvpTypes";

export const appTreeService = {
  async getTree(): Promise<AppTreeNode[]> {
    const res = await apiClient.get("/api/apps/tree");
    return res.data;
  },

  async getSubtree(appId: string): Promise<AppTreeNode> {
    const res = await apiClient.get(`/api/apps/${appId}/subtree`);
    return res.data;
  },

  async moveApp(appId: string, data: MoveAppDto): Promise<void> {
    await apiClient.post(`/api/apps/${appId}/move`, data);
  },

  async reorderChildren(parentAppId: string, data: ReorderChildrenDto): Promise<void> {
    await apiClient.post(`/api/apps/${parentAppId}/reorder-children`, data);
  },

  async startTree(appId: string): Promise<void> {
    await apiClient.post(`/api/apps/${appId}/tree/start`);
  },

  async stopTree(appId: string): Promise<void> {
    await apiClient.post(`/api/apps/${appId}/tree/stop`);
  },

  async restartTree(appId: string): Promise<void> {
    await apiClient.post(`/api/apps/${appId}/tree/restart`);
  },
};
