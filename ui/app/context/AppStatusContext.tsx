import React, { createContext, useContext, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { serviceService } from "~/services/appService";
import { getBackendConnectionStatus } from "~/lib/queryClient";
import { useAuth } from "~/context/AuthContext";

export type AppStatusMap = Record<string, string>;

// Query key for batch status
export const statusBatchQueryKey = ["services", "statuses"] as const;

interface AppStatusContextType {
  statuses: AppStatusMap;
  updateStatus: (appId: string, status: string) => void;
  clearStatuses: () => void;
  isLoading: boolean;
  refetch: () => void;
}

const AppStatusContext = createContext<AppStatusContextType | undefined>(undefined);

export const AppStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  
  // Batch fetch all statuses with polling (only when authenticated)
  const { data: statuses = {}, isLoading, refetch } = useQuery({
    queryKey: statusBatchQueryKey,
    queryFn: () => serviceService.getAllStatuses(),
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: () => isAuthenticated && getBackendConnectionStatus() ? 10 * 1000 : false,
    refetchOnWindowFocus: () => isAuthenticated && getBackendConnectionStatus(),
    enabled: isAuthenticated,
  });

  // Update a single status (for immediate UI feedback after actions)
  const updateStatus = useCallback((appId: string, status: string) => {
    queryClient.setQueryData<AppStatusMap>(statusBatchQueryKey, (prev) => ({
      ...prev,
      [appId]: status,
    }));
  }, [queryClient]);

  // Clear all statuses (used when going offline)
  const clearStatuses = useCallback(() => {
    queryClient.setQueryData<AppStatusMap>(statusBatchQueryKey, (prev) => {
      if (!prev) return {};
      const updated: AppStatusMap = {};
      Object.keys(prev).forEach(appId => {
        updated[appId] = "Unknown";
      });
      return updated;
    });
  }, [queryClient]);

  return (
    <AppStatusContext.Provider value={{ statuses, updateStatus, clearStatuses, isLoading, refetch }}>
      {children}
    </AppStatusContext.Provider>
  );
};

export const useAppStatusContext = (): AppStatusContextType => {
  const context = useContext(AppStatusContext);
  if (!context) {
    throw new Error("useAppStatusContext must be used within an AppStatusProvider");
  }
  return context;
};
