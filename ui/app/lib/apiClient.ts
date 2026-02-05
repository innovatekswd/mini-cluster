import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getStoredAccessToken, getStoredRefreshToken } from "~/context/AuthContext";
import { authService } from "~/services/authService";

// Custom event for auth state changes (localStorage events only fire in other tabs)
export const AUTH_CLEARED_EVENT = "mc_auth_cleared";
export function dispatchAuthCleared() {
  window.dispatchEvent(new CustomEvent(AUTH_CLEARED_EVENT));
}

/**
 * Type-safe error message extraction from API errors
 */
export function getApiErrorMessage(error: unknown, fallback = "An error occurred"): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    return axiosError.response?.data?.message || axiosError.message || fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

// Create axios instance for authenticated API calls
export const apiClient = axios.create({
  baseURL: "",
  timeout: 30000,
});

// Track if we're currently refreshing to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token!);
    }
  });
  failedQueue = [];
};

// Request interceptor - add Authorization header
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 and refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only handle 401 errors with a valid response
    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // Don't retry if already retried or for auth endpoints
    if (originalRequest._retry || originalRequest.url?.includes("/api/auth/")) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Wait for the refresh to complete
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = getStoredRefreshToken();
    
    if (!refreshToken) {
      // No refresh token available - clear all and let React handle redirect
      isRefreshing = false;
      localStorage.removeItem("mc_access_token");
      localStorage.removeItem("mc_refresh_token");
      localStorage.removeItem("mc_user");
      dispatchAuthCleared();
      processQueue(new Error("No refresh token"), null);
      // Don't use window.location.href - let React AuthContext handle redirect
      return Promise.reject(error);
    }

    try {
      const result = await authService.refresh(refreshToken);

      if (result.success && result.accessToken && result.refreshToken) {
        // Save new tokens
        localStorage.setItem("mc_access_token", result.accessToken);
        localStorage.setItem("mc_refresh_token", result.refreshToken);
        if (result.user) {
          localStorage.setItem("mc_user", JSON.stringify(result.user));
        }

        // Update the authorization header
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${result.accessToken}`;
        }

        processQueue(null, result.accessToken);
        isRefreshing = false;

        return apiClient(originalRequest);
      } else {
        // Refresh returned success=false - clear auth and redirect
        throw new Error(result.error || "Token refresh failed");
      }
    } catch (refreshError) {
      // Refresh failed - clear auth, let React handle redirect
      localStorage.removeItem("mc_access_token");
      localStorage.removeItem("mc_refresh_token");
      localStorage.removeItem("mc_user");
      dispatchAuthCleared();
      processQueue(refreshError, null);
      isRefreshing = false;

      // Don't use window.location.href - let React AuthContext handle redirect
      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;
