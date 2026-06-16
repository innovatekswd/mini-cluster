import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { SidePanel } from "~/components/SidePanel";
import { serviceService } from "~/services/appService";
import { apiClient } from "~/lib/apiClient";
import type { Service, ServiceFormData } from "~/types/Service";
import { ServiceConfigForm } from "~/components/ServiceConfigForm";
import { ServiceConsole } from "~/components/ServiceConsole";
import { EnvironmentProvider } from "~/context/EnvironmentContext";
import { useToast } from "~/components/Toast";
import { FaPlus, FaExclamationTriangle, FaKeyboard, FaPlay, FaStop, FaSpinner, FaEllipsisV, FaCopy, FaTrash, FaMapMarkerAlt, FaChartBar, FaHistory, FaBolt, FaThLarge, FaChevronRight, FaSync, FaUpload, FaDownload } from "react-icons/fa";
import { useDashboardData } from "~/hooks/useDashboardData";
import { AppOverview } from "~/components/AppOverview";
import { AppMetricsTab } from "~/components/AppMetricsTab";
import { AppHistoryTab } from "~/components/AppHistoryTab";
import { AppEventsTab } from "~/components/AppEventsTab";
import { useAppStatusContext } from "~/context/AppStatusContext";
import { useAppControlMutation } from "~/hooks/useServiceQueries";
import { useMachinesQuery } from "~/hooks/useMachinesQueries";
import { useConfirm } from "~/components/ConfirmDialog";
import { useCloneAppMutation, useDeleteAppMutationV2 } from "~/hooks/useAppsQueries";
import { useLogContext } from "~/context/LogContext";
import { useImportAppsMutation, useExportAppsMutation } from "~/hooks/useServiceQueries";

// ─── CaptureOutput helper ─────────────────────────────────────────────────────
// Convert frontend numeric captureOutput (0=Auto, 1=Always, 2=Never)
// to backend string values ("Both", "Stdout", "None")
const CAPTURE_OUTPUT_MAP: Record<number, string> = {
  0: "Both",
  1: "Stdout",
  2: "None",
};

/**
 * Prepares service form data for submission, converting numeric captureOutput
 * to the string value expected by the backend.
 */
function prepareServiceData(data: ServiceFormData): Record<string, unknown> {
  const captureOutputStr = data.captureOutput !== undefined
    ? CAPTURE_OUTPUT_MAP[data.captureOutput] || "Both"
    : "Both";
  return {
    ...data,
    captureOutput: captureOutputStr,
  };
}

function RedirectToApps() {
  const nav = useNavigate();
  useEffect(() => { nav("/apps", { replace: true }); }, [nav]);
  return null;
}

// ─── App Context Bar (full-width, above sidebar + content) ───────────────────

type AppTab = "overview" | "metrics" | "history" | "events";

const APP_TABS: { id: AppTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <FaThLarge size={11} /> },
  { id: "metrics", label: "Metrics", icon: <FaChartBar size={11} /> },
  { id: "history", label: "History", icon: <FaHistory size={11} /> },
  { id: "events", label: "Events", icon: <FaBolt size={11} /> },
];

interface AppContextBarProps {
  app: import("~/types/App").AppWithStats;
  services: Service[];
  selectedService?: Service | null;
  onClearService?: () => void;
  onNavigateToApps: () => void;
  onRefresh?: () => void;
  onImport?: () => void;
  onExport?: () => void;
}

function AppContextBar({ app, services, selectedService, onClearService, onNavigateToApps, onRefresh, onImport, onExport }: AppContextBarProps) {
  const { statuses } = useAppStatusContext();
  const { data: machines = [] } = useMachinesQuery();
  const { confirm } = useConfirm();
  const toast = useToast();
  const { clearLogs } = useLogContext();
  const cloneMutation = useCloneAppMutation();
  const deleteMutation = useDeleteAppMutationV2();
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  const controlMutation = useAppControlMutation({
    onMutate: async ({ action }) => {
      if (action === "start" || action === "restart") {
        services.forEach(s => clearLogs(s.id));
      }
    },
  });

  const running = services.filter(s => {
    const st = (statuses[s.id] || "").toLowerCase();
    return st === "running" || st === "started";
  }).length;
  const failed = services.filter(s => {
    const st = (statuses[s.id] || "").toLowerCase();
    return st === "failed" || st === "error" || st === "crashed";
  }).length;
  const total = services.length;
  const allRunning = running === total && total > 0;

  const healthPill = () => {
    if (total === 0)    return { dot: "bg-slate-600",   text: "No Services", color: "bg-slate-700/50 text-slate-400 border-slate-600/40" };
    if (failed > 0)     return { dot: "bg-rose-500",    text: "Failed",      color: "bg-rose-500/20 text-rose-400 border-rose-500/40" };
    if (allRunning)     return { dot: "bg-emerald-400", text: "Running",     color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" };
    if (running === 0)  return { dot: "bg-slate-500",   text: "Stopped",     color: "bg-slate-700/50 text-slate-400 border-slate-600/40" };
    return              { dot: "bg-amber-400",           text: "Partial",     color: "bg-amber-500/20 text-amber-400 border-amber-500/40" };
  };
  const pill = healthPill();
  const machineName = machines.length === 0 ? null : machines.length === 1 ? machines[0].name || "Local" : "Local";

  const handleStartAll = () => {
    services
      .filter(s => { const st = (statuses[s.id] || "").toLowerCase(); return st !== "running" && st !== "started"; })
      .forEach(s => controlMutation.mutate({ appId: s.id, appName: s.name, action: "start" }));
  };
  const handleStopAll = () => {
    services
      .filter(s => { const st = (statuses[s.id] || "").toLowerCase(); return st === "running" || st === "started"; })
      .forEach(s => controlMutation.mutate({ appId: s.id, appName: s.name, action: "stop" }));
  };
  const handleDelete = async () => {
    const ok = await confirm({ title: "Delete App", message: `Delete "${app.name}"? Its services will become unassigned.`, confirmLabel: "Delete", variant: "danger" });
    if (ok) deleteMutation.mutate({ id: app.id, name: app.name });
  };

  return (
    <div className="flex-none border-b border-slate-700/40 bg-slate-900/80">
      {/* Breadcrumb + actions row */}
      <div className="flex items-center gap-2 px-4 h-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* Apps root */}
          <button
            onClick={onNavigateToApps}
            className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex-shrink-0"
          >
            Apps
          </button>
          <FaChevronRight size={8} className="text-slate-600 flex-shrink-0" />

          {/* App name */}
          <span
            className="w-4 h-4 rounded flex items-center justify-center text-xs flex-shrink-0"
            style={{ backgroundColor: `${app.color || "#3b82f6"}20` }}
          >
            {app.icon || "📦"}
          </span>
          {selectedService ? (
            <>
              <button
                onClick={onClearService}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors truncate"
              >
                {app.name}
              </button>
              <FaChevronRight size={8} className="text-slate-600 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-100 truncate">{selectedService.name}</span>
            </>
          ) : (
            <span className="text-sm font-medium text-slate-100 truncate">{app.name}</span>
          )}

          {/* Health pill */}
          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${pill.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pill.dot} ${allRunning && total > 0 ? "animate-pulse" : ""}`} />
            {pill.text}
          </span>

          {/* Machine badge — app level only */}
          {!selectedService && machineName && (
            <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-slate-400 bg-slate-800/60 border border-slate-700/50 flex-shrink-0">
              <FaMapMarkerAlt size={8} /> {machineName}
            </span>
          )}
          {!selectedService && machines.length === 0 && (
            <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 flex-shrink-0">
              <FaExclamationTriangle size={8} /> No machine
            </span>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!selectedService && total > 0 && (
            <>
              {!allRunning && (
                <button
                  onClick={handleStartAll}
                  disabled={controlMutation.isPending}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition-colors disabled:opacity-50"
                >
                  {controlMutation.isPending ? <FaSpinner className="animate-spin" size={10} /> : <FaPlay size={10} />}
                  Start All
                </button>
              )}
              {allRunning && (
                <button
                  onClick={handleStopAll}
                  disabled={controlMutation.isPending}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition-colors disabled:opacity-50"
                >
                  {controlMutation.isPending ? <FaSpinner className="animate-spin" size={10} /> : <FaStop size={10} />}
                  Stop All
                </button>
              )}
            </>
          )}
          <div className="relative">
            <button
              onClick={() => setHeaderMenuOpen(o => !o)}
              className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
            >
              <FaEllipsisV size={11} />
            </button>
            {headerMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-30 py-1" onClick={() => setHeaderMenuOpen(false)}>
                {onRefresh && (
                  <button onClick={onRefresh} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                    <FaSync size={11} /> Refresh
                  </button>
                )}
                {onImport && (
                  <button onClick={onImport} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                    <FaUpload size={11} className="text-cyan-400" /> Import Services
                  </button>
                )}
                {onExport && (
                  <button onClick={onExport} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                    <FaDownload size={11} className="text-emerald-400" /> Export Services
                  </button>
                )}
                {(onRefresh || onImport || onExport) && (
                  <div className="h-px bg-slate-700/60 my-1 mx-2" />
                )}
                <button onClick={() => cloneMutation.mutate(app.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                  <FaCopy size={11} /> Clone App
                </button>
                <button onClick={handleDelete} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors">
                  <FaTrash size={11} /> Delete App
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

interface AppWorkspaceProps {
  app: import("~/types/App").AppWithStats;
  services: Service[];
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onSelectService: (service: Service) => void;
  onEditService: (service: Service) => void;
  onAddService: () => void;
  selectedService?: Service | null;
  onClearService: () => void;
  serviceActiveTab: string;
  onServiceTabChange: (tab: string) => void;
  isFullScreen: boolean;
  onFullScreenChange: (v: boolean) => void;
  onError: (e: any) => void;
}

function AppWorkspace({
  app, services, activeTab, onTabChange,
  onSelectService, onEditService, onAddService,
  selectedService, onClearService,
  serviceActiveTab, onServiceTabChange,
  isFullScreen, onFullScreenChange, onError,
}: AppWorkspaceProps) {
  return (
    <div className="h-full overflow-hidden flex flex-col">
      {selectedService ? (
        <ServiceConsole
          key={selectedService.id}
          appId={selectedService.id}
          isFullScreen={isFullScreen}
          onFullScreenChange={onFullScreenChange}
          activeTab={serviceActiveTab}
          onTabChange={onServiceTabChange}
          onError={onError}
          hideHeader
          onBack={onClearService}
        />
      ) : (
        <>
          {/* App tab bar — inside the content panel, same pattern as ServiceConsole */}
          <div className="flex-none flex items-center border-b border-slate-700/50 bg-slate-900/40 px-2">
            {APP_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "overview" && (
              <AppOverview
                app={app}
                services={services}
                onSelectService={onSelectService}
                onEditService={onEditService}
                onAddService={onAddService}
              />
            )}
            {activeTab === "metrics" && <AppMetricsTab services={services} />}
            {activeTab === "history" && (
              <AppHistoryTab
                services={services}
                onSelectService={id => {
                  const svc = services.find(s => s.id === id);
                  if (svc) onSelectService(svc);
                }}
              />
            )}
            {activeTab === "events" && <AppEventsTab services={services} />}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const toast = useToast();
  
  // Use the centralized dashboard data hook
  const {
    apps,
    services,
    filteredServices,
    appStats,
    appNameFromRoute,
    selectedAppId,
    setSelectedAppId,
    selectedAppIds,
    selectedServiceId,
    mode,
    setMode,
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
    isLoading: loading,
    error,
    setError,
    isConnected,
    refreshServices,
    handleSelectService,
    handleDeleteService,
    handleClearAppFilter,
    handleAppFilterChange,
    handleEditService,
    navigateToDashboard,
    navigateToApp,
  } = useDashboardData();
  
  // Additional local state for edit mode
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [appTab, setAppTab] = useState<"overview" | "metrics" | "history" | "events">("overview");

  // Import / Export (used in context bar ⋯ menu)
  const importFileRef = React.useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const importMutation = useImportAppsMutation();
  const exportMutation = useExportAppsMutation();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || importing) return;
    try {
      setImporting(true);
      await importMutation.mutateAsync(file);
      refreshServices();
    } catch (err) {
      console.error("Import failed", err);
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportMutation.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = data.exportedAt ? new Date(data.exportedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      a.download = `minicluster-config-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    }
  };
  const prevSelectedAppId = React.useRef<string | null>(null);

  // Reset app tab when switching to a different app
  useEffect(() => {
    if (selectedAppId && selectedAppId !== prevSelectedAppId.current) {
      prevSelectedAppId.current = selectedAppId;
      setAppTab("overview");
    }
  }, [selectedAppId]);

  // When mode changes to edit and we have a selected service, set it for editing
  useEffect(() => {
    if (mode === "edit" && selectedServiceId) {
      const service = filteredServices.find(s => s.id === selectedServiceId);
      if (service) {
        setEditingService(service);
      }
    } else if (mode !== "edit") {
      setEditingService(null);
    }
  }, [mode, selectedServiceId, filteredServices]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + N: Add new service
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setMode("add");
        if (appNameFromRoute) {
          navigateToApp(appNameFromRoute);
        } else {
          navigateToDashboard();
        }
        setError(null);
      }
      
      // Ctrl/Cmd + R: Refresh (prevent browser refresh)
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        refreshServices();
        toast.info("Refreshing services...");
      }

      // Escape: Go back to view mode or exit fullscreen
      if (e.key === "Escape") {
        if (isFullScreen) {
          setIsFullScreen(false);
        } else if (mode !== "view") {
          setMode("view");
        }
      }

      // Arrow keys for service navigation
      if (mode === "view" && filteredServices.length > 0) {
        const currentIndex = filteredServices.findIndex(service => service.id === selectedServiceId);
        
        if (e.key === "ArrowDown" || e.key === "j") {
          e.preventDefault();
          const nextIndex = currentIndex < filteredServices.length - 1 ? currentIndex + 1 : 0;
          handleSelectService(filteredServices[nextIndex]);
          setActiveTab("logs");
        }
        
        if (e.key === "ArrowUp" || e.key === "k") {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredServices.length - 1;
          handleSelectService(filteredServices[prevIndex]);
          setActiveTab("logs");
        }
      }

      // ? for keyboard shortcuts help
      if (e.key === "?") {
        setShowKeyboardHelp(!showKeyboardHelp);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredServices, selectedServiceId, mode, isFullScreen, refreshServices, toast, handleSelectService, setMode, setActiveTab, setError, setIsFullScreen, setShowKeyboardHelp, appNameFromRoute, navigateToApp, navigateToDashboard, showKeyboardHelp]);

  const handleServiceAdded = useCallback(() => {
    setMode("view");
    refreshServices();
    toast.success("Service added successfully!");
  }, [setMode, refreshServices, toast]);

  const handleUpdateService = useCallback(async (data: ServiceFormData) => {
    if (!editingService) return;
    try {
      await serviceService.updateService(editingService.id, prepareServiceData(data));
      toast.success("Service updated successfully!");
      setMode("view");
      setEditingService(null);
      refreshServices();
    } catch (error) {
      console.error("Error updating service:", error);
      toast.error("Failed to update service");
    }
  }, [editingService, toast, setMode, refreshServices]);

  return (
      <EnvironmentProvider>
        {/* Hidden file input for import */}
        <input ref={importFileRef} type="file" accept=".json,.csv" onChange={handleImportFile} className="hidden" />
        <div className="flex h-full overflow-hidden flex-col">
          {/* Full-width context bar — always visible */}
          {(() => {
            const ctxApp = selectedAppId ? apps.find(a => a.id === selectedAppId) : null;
            const selectedSvc = selectedServiceId ? filteredServices.find(s => s.id === selectedServiceId) ?? null : null;
            if (ctxApp) {
              return (
                <AppContextBar
                  app={ctxApp}
                  services={filteredServices}
                  selectedService={selectedSvc}
                  onClearService={() => appNameFromRoute && navigateToApp(appNameFromRoute)}
                  onNavigateToApps={navigateToDashboard}
                  onRefresh={refreshServices}
                  onImport={() => importFileRef.current?.click()}
                  onExport={handleExport}
                />
              );
            }
            // Root state — show just the Apps breadcrumb
            return (
              <div className="flex-none h-10 flex items-center px-4 gap-2 border-b border-slate-700/40 bg-slate-900/80">
                <span className="text-sm font-medium text-slate-100">Apps</span>
              </div>
            );
          })()}

          <div className="flex flex-1 min-h-0 overflow-hidden">
          {!isFullScreen && (
            <SidePanel
              apps={filteredServices}
              selectedAppId={selectedServiceId}
              currentApp={selectedAppId ? (apps.find(a => a.id === selectedAppId) ?? null) : null}
              onSelectApp={(id) => {
                const service = filteredServices.find(s => s.id === id);
                if (service) handleSelectService(service);
              }}
              onSelectAppGroup={(appId) => {
                const app = apps.find(a => a.id === appId);
                if (app) navigateToApp(app.slug || app.name);
              }}
              onAddApp={() => {
                setMode("add");
                if (appNameFromRoute) navigateToApp(appNameFromRoute);
                else navigateToDashboard();
                setError(null);
              }}
              onEditApp={handleEditService}
              onDeleteApp={handleDeleteService}
              onSelectTab={setActiveTab}
              loading={loading}
            />
          )}
          <div className={`
            flex-1 min-h-0 flex flex-col transition-all duration-300 ease-in-out
            ${isFullScreen ? 'fixed inset-0 z-50 bg-slate-900' : 'relative'}
          `}>
            {loading && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-12 h-12 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"></div>
                <span className="text-slate-400">Loading services...</span>
              </div>
            )}

            {!loading && (
              <div className="flex-1 min-h-0 overflow-hidden">
                {mode === "add" && (
                  <div className="h-full w-full overflow-auto fade-in p-6">
                    <div className="max-w-2xl mx-auto">
                      {/* Header */}
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 
                          flex items-center justify-center shadow-lg shadow-cyan-500/20">
                          <FaPlus className="text-white text-lg" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-semibold text-slate-100">Add New Service</h2>
                          <p className="text-sm text-slate-500">Configure and register a new service</p>
                        </div>
                      </div>

                      {/* Error Message */}
                      {error && (
                        <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 
                          text-rose-400 p-4 rounded-xl mb-6 fade-in">
                          <FaExclamationTriangle className="flex-shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      {/* Form Card */}
                      <div className="card-elevated">
                        <ServiceConfigForm
                          onSubmit={async (data: ServiceFormData) => {
                            try {
                              setError(null);
                              // If exactly one app is selected in filter, assign the new service to it
                              const baseData = selectedAppIds.length === 1
                                ? { ...data, appId: selectedAppIds[0] }
                                : data;
                              // Convert captureOutput from number to string for backend
                              const serviceData = prepareServiceData(baseData);
                              await apiClient.post("/api/services", serviceData);
                              handleServiceAdded();
                            } catch (error: any) {
                              const errorMessage = error?.response?.data?.message || error?.message || "Failed to add service. Please try again.";
                              setError(errorMessage);
                              console.error("Error adding service:", error);
                            }
                          }}
                          submitLabel="Add Service"
                        />
                      </div>
                    </div>
                  </div>
                )}
                {mode === "edit" && editingService && (
                  <div className="fade-in p-6">
                    <ServiceConfigForm
                      initialData={{
                        name: editingService.name,
                        executablePath: editingService.executablePath,
                        arguments: editingService.arguments,
                        workingDirectory: editingService.workingDirectory,
                        environmentVariables: editingService.environmentVariables,
                        createNoWindow: editingService.createNoWindow,
                        isExternal: editingService.isExternal,
                        accessLink: editingService.accessLink,
                        useShellExecute: editingService.useShellExecute,
                        autoStart: editingService.autoStart,
                        captureOutput: editingService.captureOutput,
                      }}
                      onSubmit={handleUpdateService}
                      submitLabel="Save Changes"
                    />
                  </div>
                )}
                {mode === "view" && selectedAppId ? (
                  <AppWorkspace
                    app={apps.find(a => a.id === selectedAppId) || { id: selectedAppId, name: 'Unknown App', slug: '', createdAt: '', modifiedAt: '', sortOrder: 0, serviceCount: 0, runningCount: 0, stoppedCount: 0, failedCount: 0 }}
                    services={filteredServices}
                    activeTab={appTab}
                    onTabChange={setAppTab}
                    onSelectService={(service) => {
                      handleSelectService(service);
                      setActiveTab("logs");
                    }}
                    onEditService={(service) => handleEditService(service.id)}
                    onAddService={() => setMode("add")}
                    selectedService={selectedServiceId ? filteredServices.find(s => s.id === selectedServiceId) ?? null : null}
                    onClearService={() => appNameFromRoute && navigateToApp(appNameFromRoute)}
                    serviceActiveTab={activeTab}
                    onServiceTabChange={setActiveTab}
                    isFullScreen={isFullScreen}
                    onFullScreenChange={setIsFullScreen}
                    onError={(error) => setError(error)}
                  />
                ) : mode === "view" && selectedServiceId ? (
                  <div className="h-full">
                    <ServiceConsole
                      key={selectedServiceId}
                      appId={selectedServiceId}
                      isFullScreen={isFullScreen}
                      onFullScreenChange={setIsFullScreen}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                      onError={(error) => setError(error)}
                    />
                  </div>
                ) : mode === "view" ? (
                  <RedirectToApps />
                ) : null}
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Keyboard Shortcuts Modal */}
        {showKeyboardHelp && (
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowKeyboardHelp(false)}
          >
            <div 
              className="card-elevated max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 
                  flex items-center justify-center">
                  <FaKeyboard className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Keyboard Shortcuts</h3>
                  <p className="text-sm text-slate-500">Quick navigation tips</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Add new service</span>
                  <div className="flex gap-1">
                    <kbd className="kbd">Ctrl</kbd>
                    <span className="text-slate-500">+</span>
                    <kbd className="kbd">N</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Refresh services</span>
                  <div className="flex gap-1">
                    <kbd className="kbd">Ctrl</kbd>
                    <span className="text-slate-500">+</span>
                    <kbd className="kbd">R</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Navigate services</span>
                  <div className="flex gap-1">
                    <kbd className="kbd">↑</kbd>
                    <kbd className="kbd">↓</kbd>
                    <span className="text-slate-500 mx-1">or</span>
                    <kbd className="kbd">J</kbd>
                    <kbd className="kbd">K</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Exit fullscreen / Go back</span>
                  <kbd className="kbd">Esc</kbd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-300">Toggle this help</span>
                  <kbd className="kbd">?</kbd>
                </div>
              </div>

              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="w-full mt-6 btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </EnvironmentProvider>
  );
}
