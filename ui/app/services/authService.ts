import axios from "axios";

export interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
  isActive?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  error?: string;
  user?: User;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: string;
  email?: string;
}

// Auth API calls - these don't need interceptors since they handle their own auth
export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const res = await axios.post("/api/auth/login", credentials);
    return res.data;
  },

  async refresh(refreshToken?: string): Promise<AuthResult> {
    const res = await axios.post("/api/auth/refresh", { RefreshToken: refreshToken });
    return res.data;
  },

  async logout(): Promise<void> {
    await axios.post("/api/auth/logout");
  },

  async getCurrentUser(accessToken: string): Promise<User> {
    const res = await axios.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  },

  async changePassword(
    request: ChangePasswordRequest,
    accessToken: string
  ): Promise<{ message: string }> {
    const res = await axios.post("/api/auth/change-password", request, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  },

  async getAllUsers(accessToken: string): Promise<User[]> {
    const res = await axios.get("/api/auth/users", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  },

  async createUser(
    request: CreateUserRequest,
    accessToken: string
  ): Promise<User> {
    const res = await axios.post("/api/auth/users", request, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  },

  async deleteUser(userId: string, accessToken: string): Promise<void> {
    await axios.delete(`/api/auth/users/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  async updateUserRole(
    userId: string,
    role: string,
    accessToken: string
  ): Promise<{ message: string }> {
    const res = await axios.patch(
      `/api/auth/users/${userId}/role`,
      { role },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return res.data;
  },

  async updateUserStatus(
    userId: string,
    isActive: boolean,
    accessToken: string
  ): Promise<{ message: string }> {
    const res = await axios.patch(
      `/api/auth/users/${userId}/status`,
      { isActive },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return res.data;
  },
};
