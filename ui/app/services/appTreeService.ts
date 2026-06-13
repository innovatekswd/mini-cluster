import apiClient from "~/lib/apiClient";
import { appsApiService } from "~/services/appsApiService";
import type {
  AppTreeNode,
  MoveAppDto,
  ReorderChildrenDto,
} from "~/types/PostMvpTypes";
import type { AppWithStats } from "~/types/App";

function toTreeNode(app: AppWithStats): AppTreeNode {
  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    icon: app.icon,
    color: app.color,
    parentAppId: app.parentAppId,
    sortOrder: app.sortOrder,
    totalServices: app.serviceCount ?? 0,
    runningServices: app.runningCount ?? 0,
    stoppedServices: app.stoppedCount ?? Math.max((app.serviceCount ?? 0) - (app.runningCount ?? 0), 0),
    errorServices: app.failedCount ?? 0,
    services: [],
    children: [],
  };
}

function buildTree(apps: AppWithStats[]): AppTreeNode[] {
  const nodesById = new Map<string, AppTreeNode>();
  const roots: AppTreeNode[] = [];

  for (const app of apps) {
    nodesById.set(app.id, toTreeNode(app));
  }

  for (const app of apps) {
    const node = nodesById.get(app.id);
    if (!node) continue;

    const parentId = app.parentAppId ?? null;
    const parent = parentId ? nodesById.get(parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: AppTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };

  sortNodes(roots);
  return roots;
}

export const appTreeService = {
  async getTree(): Promise<AppTreeNode[]> {
    const apps = await appsApiService.getAll();
    return buildTree(apps);
  },

  async getSubtree(appId: string): Promise<AppTreeNode> {
    const tree = await this.getTree();
    const stack = [...tree];
    while (stack.length > 0) {
      const node = stack.shift();
      if (!node) continue;
      if (node.id === appId) return node;
      stack.unshift(...node.children);
    }
    throw new Error(`App subtree not found: ${appId}`);
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
