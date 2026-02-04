import apiClient from "~/lib/apiClient";
import type { 
  AppFile, 
  AppFileContent, 
  CreateAppFileDto, 
  UpdateAppFileDto, 
  EditorSession
} from "~/types/ServiceFile";

export const fileService = {
  // Get all files for an app
  async getFiles(appId: string): Promise<AppFile[]> {
    const response = await apiClient.get(`/api/apps/${appId}/files`);
    return response.data;
  },

  // Get file by id
  async getFileById(appId: string, fileId: string): Promise<AppFile> {
    const response = await apiClient.get(`/api/apps/${appId}/files/${fileId}`);
    return response.data;
  },

  // Get file content
  async getFileContent(appId: string, fileId: string): Promise<AppFileContent> {
    const response = await apiClient.get(`/api/apps/${appId}/files/${fileId}/content`);
    return response.data;
  },

  // Save file content
  async updateFile(appId: string, fileId: string, data: UpdateAppFileDto): Promise<AppFile> {
    const response = await apiClient.put(`/api/apps/${appId}/files/${fileId}`, data);
    return response.data;
  },

  // Create a new file
  async createFile(appId: string, data: CreateAppFileDto): Promise<AppFile> {
    const response = await apiClient.post(`/api/apps/${appId}/files`, data);
    return response.data;
  },

  // Delete a file
  async deleteFile(appId: string, fileId: string): Promise<void> {
    await apiClient.delete(`/api/apps/${appId}/files/${fileId}`);
  },

  // Download a file (returns a blob for browser download)
  async downloadFile(appId: string, fileId: string): Promise<Blob> {
    const response = await apiClient.get(`/api/apps/${appId}/files/${fileId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Load editor session from localStorage
  loadEditorSession(appId: string): EditorSession | null {
    try {
      const sessionJson = localStorage.getItem(`editor-session-${appId}`);
      if (sessionJson) {
        const session = JSON.parse(sessionJson) as EditorSession;
        
        // Check if session is still valid (e.g., less than 24 hours old)
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in ms
        if (Date.now() - session.timestamp < maxAge) {
          return session;
        }
      }
      return null;
    } catch (error) {
      console.error("Failed to load editor session:", error);
      return null;
    }
  },

  // Save editor session to localStorage
  saveEditorSession(session: EditorSession): void {
    try {
      // Always update timestamp when saving
      const updatedSession = {
        ...session,
        timestamp: Date.now()
      };
      localStorage.setItem(`editor-session-${session.appId}`, JSON.stringify(updatedSession));
    } catch (error) {
      console.error("Failed to save editor session:", error);
    }
  },

  // Clear editor session
  clearEditorSession(appId: string): void {
    localStorage.removeItem(`editor-session-${appId}`);
  }
};