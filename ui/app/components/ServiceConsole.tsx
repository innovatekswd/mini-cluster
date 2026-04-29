import React, { useEffect, useState, Suspense, lazy } from "react";
import { serviceService } from "../services/appService";
import type { Service } from "~/types/Service";
import { Tabs } from "./Tabs";
import { ServiceControl } from "./ServiceControl";
import { ServiceConfigForm } from "./ServiceConfigForm";
import { FileManager } from "./FileManager"; 
const LogViewer = lazy(() => import("./LogViewer").then(m => ({ default: m.LogViewer })));
import { ProcessMetrics } from "./ProcessMetrics";
import { SessionExplorer } from "./SessionExplorer";
import { FaExpand, FaCompress, FaExternalLinkAlt, FaServer, FaTerminal, FaFolder, FaCog, FaChartLine, FaHistory } from "react-icons/fa";
import { useServiceStatus } from "../hooks/useServiceStatus";
import { useLogStream } from "../hooks/useLogStream";

export interface ServiceConsoleProps {
  appId: string;
  isFullScreen: boolean;
  onFullScreenChange: (isFullScreen: boolean) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onError?: (error: any) => void;
}

export const ServiceConsole: React.FC<ServiceConsoleProps> = (props) => {
  const {
    appId,
    isFullScreen,
    onFullScreenChange,
    activeTab,
    onTabChange,
    onError,
  } = props;

  useLogStream(appId);
  const realtimeStatus = useServiceStatus(appId);
  const [service, setService] = useState<Service | null>(null);
  const [fileManagerLoaded, setFileManagerLoaded] = useState(false);

  useEffect(() => {
    if (!appId) return;
    serviceService
      .getAll()
      .then((services: Service[]) => {
        const fetchedService = services.find((s) => s.id === appId);
        if (fetchedService) {
          setService(fetchedService);
        } else {
          onError?.(`Service with ID ${appId} not found`);
        }
      })
      .catch((error: any) => {
        console.error("Error fetching service:", error);
        onError?.("Failed to load service details. Please try again.");
      });
  }, [appId, onError]);

  useEffect(() => {
    if (activeTab === "files") {
      setFileManagerLoaded(true);
    }
  }, [activeTab]);

  const handleUpdateService = async (data: Partial<Service>) => {
    if (!service) return;
    try {
      await serviceService.updateService(service.id, data);
      setService({ ...service, ...data });
    } catch (error) {
      console.error("Error updating service:", error);
    }
  };

  if (!service) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800 flex items-center justify-center">
            <FaServer className="text-2xl text-slate-500 animate-pulse" />
          </div>
          <p className="text-slate-400">Loading service...</p>
        </div>
      </div>
    );
  }

  const statusConfig = {
    Running: { class: "badge-success", glow: "glow-emerald" },
    Stopped: { class: "badge-danger", glow: "glow-rose" },
    Starting: { class: "badge-warning", glow: "glow-amber" },
  }[realtimeStatus] || { class: "badge-warning", glow: "" };

  const tabIcons: Record<string, React.ReactNode> = {
    logs: <FaTerminal className="text-sm" />,
    files: <FaFolder className="text-sm" />,
    config: <FaCog className="text-sm" />,
  };

  return (
    <div className={`
      flex flex-col h-full overflow-hidden
      ${isFullScreen 
        ? 'fixed inset-0 z-50 bg-slate-950 p-0' 
        : ''
      }
      transition-all duration-300 ease-out
    `}>
      {/* Header Card */}
      <div className="flex-none px-4 pt-4">
        <div className="card-elevated flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* App Info */}
          <div className="flex items-center gap-4">
            <div className={`
              w-14 h-14 rounded-2xl flex items-center justify-center
              bg-gradient-to-br from-cyan-500 to-blue-600
              shadow-lg shadow-cyan-500/20
            `}>
              <FaServer className="text-white text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white">{service.name}</h1>
                <span className={`badge ${statusConfig.class}`}>
                  <span className={`w-2 h-2 rounded-full mr-2 ${
                    realtimeStatus === "Running" ? "bg-emerald-400 animate-pulse" : "bg-current"
                  }`}></span>
                  {realtimeStatus}
                </span>
              </div>
              {service.accessLink && (
                <a
                  href={service.accessLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <FaExternalLinkAlt className="text-xs" />
                  <span className="truncate max-w-xs">{service.accessLink}</span>
                </a>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <ServiceControl service={service} />
            <button
              onClick={() => onFullScreenChange(!isFullScreen)}
              className="icon-btn"
              title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullScreen ? <FaCompress /> : <FaExpand />}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-none px-4 py-4">
        <Tabs
          onTabChange={onTabChange}
          tabs={[
            { key: "logs", label: "Logs" },
            { key: "sessions", label: "Sessions" },
            { key: "metrics", label: "Metrics" },
            { key: "files", label: "Files" },
            { key: "config", label: "Configuration" },
          ]}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 px-4 pb-4 flex flex-col">
        {/* Logs Tab - Full height */}
        <div className={`flex-1 min-h-0 ${activeTab === "logs" ? "flex flex-col" : "hidden"}`}>
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-gray-500">Loading logs...</div>}>
            <LogViewer appId={appId} />
          </Suspense>
        </div>

        {/* Sessions Tab */}
        <div className={`flex-1 min-h-0 ${activeTab === "sessions" ? "flex flex-col" : "hidden"}`}>
          <SessionExplorer serviceId={appId} serviceName={service.name} />
        </div>
        
        {/* Metrics Tab */}
        <div className={`h-full overflow-y-auto ${activeTab === "metrics" ? "block" : "hidden"}`}>
          <ProcessMetrics serviceId={appId} serviceName={service.name} />
        </div>
        
        {/* Files Tab */}
        {fileManagerLoaded && (
          <div className={`h-full ${activeTab === "files" ? "block" : "hidden"}`}>
            <FileManager 
              appId={appId} 
              visible={activeTab === "files"}
            />
          </div>
        )}
        
        {/* Config Tab */}
        <div className={`h-full overflow-y-auto ${activeTab === "config" ? "block" : "hidden"}`}>
          <div className="card">
            <ServiceConfigForm
              initialData={{
                name: service.name,
                executablePath: service.executablePath,
                arguments: service.arguments,
                workingDirectory: service.workingDirectory,
                environmentVariables: service.environmentVariables,
                accessLink: service.accessLink,
                isExternal: service.isExternal,
                useShellExecute: service.useShellExecute,
                createNoWindow: service.createNoWindow,
                autoStart: service.autoStart,
                captureOutput: service.captureOutput,
              }}
              onSubmit={handleUpdateService}
              submitLabel="Save Changes"
              autoSave={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
