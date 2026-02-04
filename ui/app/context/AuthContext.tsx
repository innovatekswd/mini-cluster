import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import { authService, type User, type LoginCredentials } from "~/services/authService";

// Token storage keys
const ACCESS_TOKEN_KEY = "mc_access_token";
const REFRESH_TOKEN_KEY = "mc_refresh_token";
const USER_KEY = "mc_user";

// Helper to safely get initial state from localStorage (SSR-safe)
const getInitialUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getInitialToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token refresh interval (refresh 2 minutes before expiry, assuming 30 min expiry)
const REFRESH_INTERVAL = 28 * 60 * 1000; // 28 minutes

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state from localStorage to prevent flash
  const [user, setUser] = useState<User | null>(getInitialUser);
  const [accessToken, setAccessToken] = useState<string | null>(getInitialToken);
  // Only show loading if we have NO stored credentials (need to determine auth state)
  // If we have stored credentials, trust them initially to prevent flicker
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    // If we have stored user and token, don't show loading - trust localStorage
    const hasStoredAuth = !!(localStorage.getItem(ACCESS_TOKEN_KEY) && localStorage.getItem(USER_KEY));
    return !hasStoredAuth; // Only loading if we need to determine state
  });
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const initRef = useRef(false); // Prevent double init in strict mode

  // Get access token - can be used by axios interceptor
  const getAccessToken = useCallback(() => {
    return accessToken || localStorage.getItem(ACCESS_TOKEN_KEY);
  }, [accessToken]);

  // Save tokens and user to storage
  const saveAuthState = useCallback((token: string, refresh: string, userData: User) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setAccessToken(token);
    setUser(userData);
  }, []);

  // Clear auth state
  const clearAuthState = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAccessToken(null);
    setUser(null);
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Refresh the access token
  const refreshTokenFn = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) return false;
    isRefreshingRef.current = true;

    try {
      const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
      const result = await authService.refresh(storedRefresh || undefined);

      if (result.success && result.accessToken && result.refreshToken && result.user) {
        saveAuthState(result.accessToken, result.refreshToken, result.user);
        isRefreshingRef.current = false;
        return true;
      } else {
        clearAuthState();
        isRefreshingRef.current = false;
        return false;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      clearAuthState();
      isRefreshingRef.current = false;
      return false;
    }
  }, [saveAuthState, clearAuthState]);

  // Start periodic token refresh
  const startRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    refreshTimerRef.current = setInterval(() => {
      refreshTokenFn();
    }, REFRESH_INTERVAL);
  }, [refreshTokenFn]);

  // Login function
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await authService.login(credentials);

        if (result.success && result.accessToken && result.refreshToken && result.user) {
          saveAuthState(result.accessToken, result.refreshToken, result.user);
          startRefreshTimer();
          return { success: true };
        } else {
          return { success: false, error: result.error || "Login failed" };
        }
      } catch (error: any) {
        const message =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          "Login failed";
        return { success: false, error: message };
      }
    },
    [saveAuthState, startRefreshTimer]
  );

  // Logout function
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  // Initialize auth state on mount
  useLayoutEffect(() => {
    // Prevent double init in strict mode
    if (initRef.current) return;
    initRef.current = true;

    const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      // Trust localStorage - apiClient interceptor will handle 401s and refresh
      try {
        const userData = JSON.parse(storedUser);
        setAccessToken(storedToken);
        setUser(userData);
        // Start refresh timer for proactive token refresh
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = setInterval(() => {
          refreshTokenFn();
        }, REFRESH_INTERVAL);
      } catch {
        // Invalid stored user JSON - clear everything
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setAccessToken(null);
        setUser(null);
      }
    }
    setIsLoading(false);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []); // Empty deps - run once on mount

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        accessToken,
        login,
        logout,
        refreshToken: refreshTokenFn,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Export a function to get the token outside of React (for axios interceptors)
export function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
