/**
 * Custom hook for dashboard data and state management
 * 
 * Encapsulates all dashboard-related data fetching, filtering, and computed values.
 * Uses path-based routing: /dashboard/:appName?/:serviceName?
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useAppsQuery, useDeleteAppMutation } from "./useServiceQueries";
import { useAppsWithStatsQuery } from "./useAppsQueries";
import { useAppStatusContext } from "~/context/AppStatusContext";
import { useConnection } from "~/context/ConnectionContext";
import { useToast } from "~/components/Toast";
import type { Service, ServiceFormData } from "~/types/Service";
import type { AppWithStats } from "~/types/App";
import type { AppStats } from "~/components/Layout";

interface UseDashboardDataReturn {
  // Data
  apps: AppWithStats[];
  services: Service[];
  filteredServices: Service[];
  filteredApps: AppWithStats[];
  appStats: AppStats;
  
  // Route params
  appNameFromRoute: string | undefined;
  serviceNameFromRoute: string | undefined;
  
  // Selection state
  selectedAppId: string | null;
  setSelectedAppId: (id: string | null) => void;
  selectedAppIds: string[];
  setSelectedAppIds: (ids: string[]) => void;
  selectedServiceId: string | null;
  
  // Mode state
  mode: "view" | "add" | "edit";
  setMode: (mode: "view" | "add" | "edit") => void;
  
  // UI state
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isFullScreen: boolean;
  setIsFullScreen: (value: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  sidebarPinned: boolean;
  setSidebarPinned: (value: boolean) => void;
  showKeyboardHelp: boolean;
  setShowKeyboardHelp: (value: boolean) => void;
  
  // Loading/error states
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  
  // Connection state
  isConnected: boolean;
  
  // Actions
  refreshServices: () => void;
  handleSelectService: (service: Service) => void;
  handleDeleteService: (id: string) => Promise<void>;
  handleClearAppFilter: () => void;
  handleAppFilterChange: (appIds: string[]) => void;
  handleEditService: (serviceId: string) => void;
  navigateToApp: (appName: string) => void;
  navigateToService: (appName: string, serviceName: string) => void;
  navigateToDashboard: () => void;
}

export function useDashboardData(): UseDashboardDataReturn {
  const toast = useToast();
  const { statuses } = useAppStatusContext();
  const { status: connectionStatus } = useConnection();
  const isConnected = connectionStatus === "connected";
  const navigate = useNavigate();
  
  // Get route params: /dashboard/:appName?/:serviceName?
  const { appName: appNameFromRoute, serviceName: serviceNameFromRoute } = useParams<{
    appName?: string;
    serviceName?: string;
  }>();
  
  // UI State
  const [mode, setMode] = useState<"view" | "add" | "edit">("view");
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("logs");
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(true);

  // React Query hooks
  // Services are fetched from /api/Services
  const { 
    data: services = [], 
    isLoading: servicesLoading,
    refetch: refetchServices,
  } = useAppsQuery();

  // Apps with stats are fetched from /api/Apps
  const { 
    data: apps = [], 
    isLoading: appsLoading 
  } = useAppsWithStatsQuery();

  const deleteServiceMutation = useDeleteAppMutation();

  // Resolve app name from route to app ID
  const selectedAppId = useMemo(() => {
    if (!appNameFromRoute || apps.length === 0) return null;
    const decodedName = decodeURIComponent(appNameFromRoute);
    const app = apps.find(a => a.name.toLowerCase() === decodedName.toLowerCase());
    return app?.id || null;
  }, [appNameFromRoute, apps]);

  // Resolve service name from route to service ID
  const selectedServiceId = useMemo(() => {
    if (!serviceNameFromRoute || !selectedAppId || services.length === 0) return null;
    const decodedName = decodeURIComponent(serviceNameFromRoute);
    const service = services.find(s => 
      s.appId === selectedAppId && 
      s.name.toLowerCase() === decodedName.toLowerCase()
    );
    return service?.id || null;
  }, [serviceNameFromRoute, selectedAppId, services]);

  // Update selectedAppIds when route changes
  useEffect(() => {
    if (selectedAppId) {
      setSelectedAppIds([selectedAppId]);
    } else {
      setSelectedAppIds([]);
    }
  }, [selectedAppId]);

  // Auto-select service when route has service name
  useEffect(() => {
    if (selectedServiceId) {
      setMode("view");
    }
  }, [selectedServiceId]);

  // Filter services by selected app (from route)
  const filteredServices = useMemo(() => {
    if (!selectedAppId) return services;
    return services.filter(s => s.appId === selectedAppId);
  }, [services, selectedAppId]);

  // Get the filtered apps details
  const filteredApps = useMemo(() => {
    if (!selectedAppId) return [];
    const app = apps.find(a => a.id === selectedAppId);
    return app ? [app] : [];
  }, [selectedAppId, apps]);

  // Calculate app stats based on real-time statuses
  const appStats: AppStats = useMemo(() => {
    const stats = { total: filteredServices.length, running: 0, stopped: 0, failed: 0 };
    
    filteredServices.forEach(service => {
      const status = (statuses[service.id] || service.status || "").toLowerCase();
      if (status === "running" || status === "started") {
        stats.running++;
      } else if (status === "stopped" || status === "exited" || status === "") {
        stats.stopped++;
      } else if (status === "failed" || status === "error" || status === "crashed") {
        stats.failed++;
      } else {
        stats.stopped++;
      }
    });
    
    return stats;
  }, [filteredServices, statuses]);

  // Navigation helpers
  const navigateToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  const navigateToApp = useCallback((appName: string) => {
    navigate(`/dashboard/${encodeURIComponent(appName)}`);
  }, [navigate]);

  const navigateToService = useCallback((appName: string, serviceName: string) => {
    navigate(`/dashboard/${encodeURIComponent(appName)}/${encodeURIComponent(serviceName)}`);
  }, [navigate]);

  // Actions
  const refreshServices = useCallback(() => {
    refetchServices();
  }, [refetchServices]);

  const handleSelectService = useCallback((service: Service) => {
    try {
      // Find the app for this service
      const app = apps.find(a => a.id === service.appId);
      if (app) {
        navigateToService(app.name, service.name);
      } else {
        // Service without app - just show in current view
        setMode("view");
        setError(null);
      }
    } catch (err) {
      setError("Failed to select service. The service may have been deleted.");
      console.error("Error selecting service:", err);
    }
  }, [apps, navigateToService]);

  const handleDeleteService = useCallback(async (serviceId: string) => {
    try {
      const service = services.find(s => s.id === serviceId);
      const serviceName = service?.name;
      await deleteServiceMutation.mutateAsync({ appId: serviceId, appName: serviceName });
      toast.success(`${serviceName ? `"${serviceName}"` : "Service"} deleted successfully!`);
      
      // If we deleted the currently selected service, navigate back to app
      if (selectedServiceId === serviceId && appNameFromRoute) {
        navigateToApp(appNameFromRoute);
      }
    } catch (err) {
      console.error("Error deleting service:", err);
      toast.error("Failed to delete service");
    }
  }, [services, selectedServiceId, appNameFromRoute, deleteServiceMutation, toast, navigateToApp]);

  const handleClearAppFilter = useCallback(() => {
    navigateToDashboard();
  }, [navigateToDashboard]);

  const handleAppFilterChange = useCallback((appIds: string[]) => {
    if (appIds.length === 0) {
      navigateToDashboard();
    } else if (appIds.length === 1) {
      const app = apps.find(a => a.id === appIds[0]);
      if (app) {
        navigateToApp(app.name);
      }
    }
    // For multiple apps, we stay on dashboard (multi-app filter not supported in path routing)
  }, [apps, navigateToDashboard, navigateToApp]);

  const handleEditService = useCallback((serviceId: string) => {
    try {
      const serviceToEdit = services.find((s) => s.id === serviceId);
      if (!serviceToEdit) {
        throw new Error("Service not found");
      }
      const app = apps.find(a => a.id === serviceToEdit.appId);
      if (app) {
        navigateToService(app.name, serviceToEdit.name);
        setActiveTab("config");
      }
      setMode("view");
      setError(null);
    } catch (err) {
      setError("Failed to edit service. The service may have been deleted.");
      toast.error("Failed to edit service");
      console.error("Error editing service:", err);
    }
  }, [services, apps, navigateToService, toast]);

  // Legacy setter for backward compatibility
  const setSelectedAppId = useCallback((id: string | null) => {
    if (!id) {
      navigateToDashboard();
    } else {
      const app = apps.find(a => a.id === id);
      if (app) {
        navigateToApp(app.name);
      }
    }
  }, [apps, navigateToDashboard, navigateToApp]);

  return {
    // Data
    apps,
    services,
    filteredServices,
    filteredApps,
    appStats,
    
    // Route params
    appNameFromRoute,
    serviceNameFromRoute,
    
    // Selection state
    selectedAppId,
    setSelectedAppId,
    selectedAppIds,
    setSelectedAppIds,
    selectedServiceId,
    
    // Mode state
    mode,
    setMode,
    
    // UI state
    activeTab,
    setActiveTab,
    isFullScreen,
    setIsFullScreen,
    sidebarOpen,
    setSidebarOpen,
    sidebarPinned,
    setSidebarPinned,
    showKeyboardHelp,
    setShowKeyboardHelp,
    
    // Loading/error states
    isLoading: servicesLoading || appsLoading,
    error,
    setError,
    
    // Connection state
    isConnected,
    
    // Actions
    refreshServices,
    handleSelectService,
    handleDeleteService,
    handleClearAppFilter,
    handleAppFilterChange,
    handleEditService,
    navigateToApp,
    navigateToService,
    navigateToDashboard,
  };
}
