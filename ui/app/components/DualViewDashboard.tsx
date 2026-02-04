import React, { useState, useEffect, useCallback } from "react";
import { ViewToggle } from "~/components/ViewToggle";
import { MachinesView } from "~/components/MachinesView";
import { ServicesTreeView } from "~/components/ServicesTreeView";
import { ServiceDetails } from "~/components/ServiceDetails";
import { ServiceConsole } from "~/components/ServiceConsole";
import type { Service } from "~/types/Service";
import { machineService } from "~/services/machineService";
import { serviceService } from "~/services/appService";

// View mode for the dashboard
type ViewMode = "machines" | "services";

interface DualViewDashboardProps {
  initialView?: ViewMode;
  onAddService?: () => void;
}

export function DualViewDashboard({ initialView = "services", onAddService }: DualViewDashboardProps) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [machineCount, setMachineCount] = useState(0);
  const [appCount, setAppCount] = useState(0);

  // Load counts for toggle badges
  const loadCounts = useCallback(async () => {
    try {
      const [machines, apps] = await Promise.all([
        machineService.getAll(),
        serviceService.getAll(),
      ]);
      setMachineCount(machines.length);
      setAppCount(apps.length);
    } catch (err) {
      console.error("Failed to load counts:", err);
    }
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  // Clear selection when switching views
  useEffect(() => {
    setSelectedAppId(null);
    setSelectedService(null);
  }, [view]);

  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setSelectedAppId(null); // Clear app selection when selecting service
  };

  const handleSelectApp = (appId: string) => {
    setSelectedAppId(appId);
    setSelectedService(null); // Clear service selection when selecting app
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <ViewToggle
          view={view}
          onChange={setView}
          machineCount={machineCount}
          appCount={appCount}
        />
        
        <div className="text-sm text-slate-500">
          {view === "machines" 
            ? "View services organized by machine/server" 
            : "View services and their hierarchy"
          }
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - List View */}
        <div className="w-1/2 border-r border-slate-700/50 overflow-hidden">
          <div className="h-full p-4">
            {view === "machines" ? (
              <MachinesView
                onSelectService={handleSelectService}
                selectedServiceId={selectedService?.id}
              />
            ) : (
              <ServicesTreeView
                onSelectApp={handleSelectApp}
                selectedAppId={selectedAppId || undefined}
                onAddApp={onAddService}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Details View */}
        <div className="w-1/2 overflow-hidden bg-slate-900/30">
          {selectedService ? (
            <ServiceDetails
              service={selectedService}
              onUpdate={() => {
                // Trigger refresh
                loadCounts();
              }}
              onClose={() => setSelectedService(null)}
            />
          ) : selectedAppId ? (
            <ServiceConsole
              appId={selectedAppId}
              isFullScreen={false}
              onFullScreenChange={() => {}}
              activeTab="logs"
              onTabChange={() => {}}
              onError={() => {}}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <div className="w-16 h-16 mb-4 rounded-2xl bg-slate-800/50 flex items-center justify-center">
                {view === "machines" ? (
                  <svg className="w-8 h-8 opacity-30" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/>
                  </svg>
                ) : (
                  <svg className="w-8 h-8 opacity-30" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h18v2H3V3zm0 8h18v2H3v-2zm0 8h18v2H3v-2z"/>
                  </svg>
                )}
              </div>
              <h3 className="text-lg font-medium text-slate-400 mb-2">
                {view === "machines" ? "Select a Service" : "Select a Service"}
              </h3>
              <p className="text-sm text-center max-w-xs">
                {view === "machines"
                  ? "Choose a service from a machine to view its details, logs, and configuration."
                  : "Select a service from the list to view its console, logs, and settings."
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
