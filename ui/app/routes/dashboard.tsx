import React, { useState, useEffect, useCallback } from "react";
import { SidePanel } from "~/components/SidePanel";
import { serviceService } from "~/services/appService";
import { apiClient } from "~/lib/apiClient";
import type { Service, ServiceFormData } from "~/types/Service";
import { ServiceConfigForm } from "~/components/ServiceConfigForm";
import { ServiceConsole } from "~/components/ServiceConsole";
import { EnvironmentProvider } from "~/context/EnvironmentContext";
import { useToast } from "~/components/Toast";
import { FaPlus, FaServer, FaExclamationTriangle, FaRocket, FaKeyboard, FaTimes } from "react-icons/fa";
import { AppFilter } from "~/components/AppFilter";
import { useDashboardData } from "~/hooks/useDashboardData";
import { SystemDashboardCharts } from "~/components/SystemDashboardCharts";

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
      await serviceService.updateService(editingService.id, data);
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
        <div className="flex h-full overflow-hidden flex-col">
          {/* App Filter Bar */}
          <div className="flex-none px-4 py-3 bg-slate-900/50 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <AppFilter
                apps={apps}
                selectedAppIds={selectedAppIds}
                onAppFilterChange={handleAppFilterChange}
              />
              {selectedAppIds.length > 0 && (
                <button
                  onClick={handleClearAppFilter}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-xs text-white transition-colors"
                >
                  <FaTimes size={10} />
                  Clear Filter
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-1 min-h-0 overflow-hidden">
          {!isFullScreen && (
            <SidePanel 
              apps={filteredServices}
              selectedAppId={selectedServiceId}
              onSelectApp={(id) => {
                const service = filteredServices.find(s => s.id === id);
                if (service) handleSelectService(service);
              }}
              onAddApp={() => {
                setMode("add");
                // Navigate to current app's add page or dashboard
                if (appNameFromRoute) {
                  navigateToApp(appNameFromRoute);
                } else {
                  navigateToDashboard();
                }
                setError(null);
              }}
              onEditApp={handleEditService}
              onDeleteApp={handleDeleteService}
              onSelectTab={setActiveTab}
              onRefresh={refreshServices}
              loading={loading}
              error={error}
              isOpen={sidebarOpen || sidebarPinned}
              onClose={() => setSidebarOpen(false)}
              isPinned={sidebarPinned}
              onPinChange={(pinned) => {
                setSidebarPinned(pinned);
                if (pinned) setSidebarOpen(true);
              }}
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
              <div className="flex-1 min-h-0 overflow-hidden p-6">
                {mode === "add" && (
                  <div className="h-full w-full overflow-auto fade-in">
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
                              const serviceData = selectedAppIds.length === 1 
                                ? { ...data, appId: selectedAppIds[0] }
                                : data;
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
                  <div className="fade-in">
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
                {mode === "view" && selectedServiceId ? (
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
                  <SystemDashboardCharts />
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
