import apiClient from "~/lib/apiClient";
import type {
  AppGroup,
  GroupVariable,
  CreateAppGroupDto,
  CreateGroupVariableDto,
  AppWithHierarchy,
} from "~/types/Phase5Types";

export const groupService = {
  // Groups CRUD
  async getAll(): Promise<AppGroup[]> {
    const res = await apiClient.get("/api/groups");
    return res.data;
  },

  async getTree(): Promise<AppGroup[]> {
    const res = await apiClient.get("/api/groups/tree");
    return res.data;
  },

  async getById(id: string): Promise<AppGroup> {
    const res = await apiClient.get(`/api/groups/${id}`);
    return res.data;
  },

  async create(data: CreateAppGroupDto): Promise<AppGroup> {
    const res = await apiClient.post("/api/groups", data);
    return res.data;
  },

  async update(id: string, data: Partial<CreateAppGroupDto>): Promise<AppGroup> {
    const res = await apiClient.put(`/api/groups/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/groups/${id}`);
  },

  // App assignments
  async getApps(groupId: string): Promise<AppWithHierarchy[]> {
    const res = await apiClient.get(`/api/groups/${groupId}/apps`);
    return res.data;
  },

  async addApp(groupId: string, appId: string): Promise<void> {
    await apiClient.post(`/api/groups/${groupId}/apps/${appId}`);
  },

  async removeApp(groupId: string, appId: string): Promise<void> {
    await apiClient.delete(`/api/groups/${groupId}/apps/${appId}`);
  },

  // Variables
  async getVariables(groupId: string): Promise<GroupVariable[]> {
    const res = await apiClient.get(`/api/groups/${groupId}/variables`);
    return res.data;
  },

  async setVariables(groupId: string, variables: CreateGroupVariableDto[]): Promise<void> {
    await apiClient.put(`/api/groups/${groupId}/variables`, variables);
  },

  async addVariable(groupId: string, variable: CreateGroupVariableDto): Promise<GroupVariable> {
    const res = await apiClient.post(`/api/groups/${groupId}/variables`, variable);
    return res.data;
  },

  async deleteVariable(groupId: string, variableId: string): Promise<void> {
    await apiClient.delete(`/api/groups/${groupId}/variables/${variableId}`);
  },
};
