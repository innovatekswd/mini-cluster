import React, { useEffect, useState, Suspense, lazy, useCallback, useRef } from "react";
import { serviceService } from "../services/appService";
import type { Service } from "~/types/Service";
import { Tabs } from "./Tabs";
import { ServiceControl } from "./ServiceControl";
import { ServiceConfigForm } from "./ServiceConfigForm";
import { FileManager } from "./FileManager";
const LogViewer = lazy(() => import("./LogViewer").then(m => ({ default: m.LogViewer })));
import { ProcessMetrics } from "./ProcessMetrics";
import { SessionExplorer } from "./SessionExplorer";
import { FaExpand, FaCompress, FaExternalLinkAlt, FaServer, FaTerminal, FaFolder, FaCog, FaChartLine, FaHistory, FaMicrochip, FaMemory, FaMapMarkerAlt, FaChevronLeft } from "react-icons/fa";
import { useServiceStatus } from "../hooks/useServiceStatus";
import { useLogStream } from "../hooks/useLogStream";
import { useSignalRConnection, useSignalRServiceGroup } from "~/context/SignalRConnectionContext";
import { metricsService, formatBytes, formatPercent, type ProcessMetricsSnapshot } from "~/services/metricsService";
import { useMachinesQuery } from "~/hooks/useMachinesQueries";
import { HubConnectionState } from "@microsoft/signalr";
import { withRetry } from "~/lib/retry";

export interface ServiceConsoleProps {
  appId: string;
  isFullScreen: boolean;
  onFullScreenChange: (isFullScreen: boolean) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onError?: (error: any) => void;
  hideHeader?: boolean;
  onBack?: () => void;
}

export const ServiceConsole: React.FC<ServiceConsoleProps> = (props) => {
  const {
    appId,
    isFullScreen,
    onFullScreenChange,
    activeTab,
    onTabChange,
    onError,
    hideHeader = false,
    onBack,
  } = props;

  useLogStream(appId);
  const realtimeStatus = useServiceStatus(appId);
  const [service, setService] = useState<Service | null>(null);
  const [fileManagerLoaded, setFileManagerLoaded] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState<{ cpu: number; mem: number } | null>(null);
  const connection = useSignalRConnection();
  const { joinServiceGroup, leaveServiceGroup } = useSignalRServiceGroup();
  const { data: machines = [] } = useMachinesQuery();

  // SignalR handles real-time log streaming — no need for DB refresh polling.
  // This callback is passed to ServiceControl but is now a no-op since
  // logs arrive via SignalR "LogEntry" events automatically.
  const handleServiceAction = useCallback(() => {
    // No-op: SignalR pushes log lines in real-time.
    // The grace timer in useLogStream keeps us subscribed for 3s after stop.
  }, []);

  const isRunning = realtimeStatus === "Running" || realtimeStatus === "Started";
  const machineName = machines.length === 1 ? machines[0].name || "Local" : machines.length > 1 ? "Local" : null;

  const fetchLiveMetrics = useCallback(async () => {
    try {
      const m = await withRetry(
        () => metricsService.getServiceLiveMetrics(appId),
        {
          maxRetries: 3,
          initialDelay: 400,
          backoffMultiplier: 2,
          maxDelay: 3_000,
        }
      );
      if (m) setLiveMetrics({ cpu: m.cpuUsagePercent, mem: m.workingSetMemory });
    } catch {
      // Metrics are non-critical; swallow and show stale/empty
    }
  }, [appId]);

  useEffect(() => { fetchLiveMetrics(); }, [fetchLiveMetrics, isRunning]);

  useEffect(() => {
    if (!connection || connection.state !== HubConnectionState.Connected || !isRunning) return;
    joinServiceGroup(appId);
    const handle = (snap: ProcessMetricsSnapshot) => {
      if (snap.serviceId === appId) setLiveMetrics({ cpu: snap.cpuUsagePercent, mem: snap.workingSetMemory });
    };
    connection.on("ProcessMetrics", handle);
    return () => { connection.off("ProcessMetrics", handle); leaveServiceGroup(appId); };
  }, [connection, appId, isRunning, joinServiceGroup, leaveServiceGroup]);

  useEffect(() => {
    if (!appId) return;
    const controller = new AbortController();

    withRetry(
      async () => {
        const services = await serviceService.getAll();
        const fetchedService = services.find((s) => s.id === appId);
        if (!fetchedService) {
          throw new Error(`Service with ID ${appId} not found`);
        }
        return fetchedService;
      },
      {
        maxRetries: 3,
        initialDelay: 500,
        backoffMultiplier: 2,
        maxDelay: 4_000,
        signal: controller.signal,
      }
    )
      .then((fetchedService) => {
        setService(fetchedService);
      })
      .catch((error: any) => {
        if (error?.name === "AbortError") return;
        console.error("Error fetching service:", error);
        onError?.("Failed to load service details. Please try again.");
      });

    return () => controller.abort();
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

  const SERVICE_TABS = [
    { key: "logs", label: "Logs", icon: <FaTerminal size={11} /> },
    { key: "sessions", label: "History", icon: <FaHistory size={11} /> },
    { key: "metrics", label: "Metrics", icon: <FaChartLine size={11} /> },
    { key: "files", label: "Files", icon: <FaFolder size={11} /> },
    { key: "config", label: "Configuration", icon: <FaCog size={11} /> },
  ];

  return (
    <div className={`
      flex flex-col h-full overflow-hidden
      ${isFullScreen ? 'fixed inset-0 z-50 bg-slate-950 p-0' : ''}
      transition-all duration-300 ease-out
    `}>
      {/* Header Card — hidden when embedded inside AppWorkspace */}
      {!hideHeader && (
        <>
          <div className="flex-none px-4 pt-4">
            <div className="card-elevated">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-700/60 flex-shrink-0">
                    <FaServer className="text-slate-300 text-lg" />
                  </div>
                  <div>
                    <div className="flex items-center flex-wrap gap-2">
                      <h1 className="text-lg font-bold text-white">{service.name}</h1>
                      <span className={`badge ${statusConfig.class}`}>
                        <span className={`w-2 h-2 rounded-full mr-1.5 ${realtimeStatus === "Running" ? "bg-emerald-400 animate-pulse" : "bg-current"}`} />
                        {realtimeStatus}
                      </span>
                      {machineName && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-slate-400 bg-slate-800/60 border border-slate-700/50">
                          <FaMapMarkerAlt size={9} /> {machineName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center flex-wrap gap-3 mt-1">
                      <span className="text-xs text-slate-500 truncate max-w-xs">{service.executablePath || "No executable"}</span>
                      {liveMetrics && (
                        <>
                          <span className="flex items-center gap-1 text-xs">
                            <FaMicrochip className="text-cyan-400" size={10} />
                            <span className="text-slate-400">{formatPercent(liveMetrics.cpu)}</span>
                          </span>
                          <span className="flex items-center gap-1 text-xs">
                            <FaMemory className="text-violet-400" size={10} />
                            <span className="text-slate-400">{formatBytes(liveMetrics.mem)}</span>
                          </span>
                        </>
                      )}
                      {service.accessLink && (
                        <a href={service.accessLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                          <FaExternalLinkAlt size={10} />
                          <span className="truncate max-w-xs">{service.accessLink}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <ServiceControl service={service} onAction={handleServiceAction} />
                  <button onClick={() => onFullScreenChange(!isFullScreen)} className="icon-btn" title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}>
                    {isFullScreen ? <FaCompress /> : <FaExpand />}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-none px-4 py-3">
            <Tabs activeTab={activeTab} onTabChange={onTabChange} tabs={SERVICE_TABS} />
          </div>
        </>
      )}

      {/* Compact tab bar — full width underline style when header is hidden */}
      {hideHeader && (
        <div className="flex-none flex items-center border-b border-slate-700/50 bg-slate-900/40 px-2">
          {/* Back to overview */}
          {onBack && (
            <>
              <button
                onClick={onBack}
                className="flex items-center gap-1 px-3 py-2.5 text-xs text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
              >
                <FaChevronLeft size={9} />
                Overview
              </button>
              <div className="w-px h-4 bg-slate-700/60 mx-1 flex-shrink-0" />
            </>
          )}
          {SERVICE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-cyan-500 text-cyan-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
          {/* Service controls inline on the right */}
          <div className="ml-auto flex items-center gap-1 pr-1">
            <ServiceControl service={service} onAction={handleServiceAction} />
            <button onClick={() => onFullScreenChange(!isFullScreen)} className="icon-btn text-slate-500 hover:text-slate-300" title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}>
              {isFullScreen ? <FaCompress size={12} /> : <FaExpand size={12} />}
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className={`flex-1 min-h-0 flex flex-col ${hideHeader ? "" : "px-4 pb-4"}`}>
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
