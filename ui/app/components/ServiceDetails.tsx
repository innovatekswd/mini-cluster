import React, { useState } from "react";
import {
  FaDocker, FaTerminal, FaNetworkWired, FaPlay, FaStop, FaSync,
  FaCircle, FaServer, FaCubes, FaClock, FaLink, FaCog, FaTrash,
  FaChevronDown, FaChevronUp
} from "react-icons/fa";
import type { Service } from "~/types/Service";
import { serviceService } from "~/services/appService";
import { useToast } from "~/components/Toast";
import { useQueryClient } from "@tanstack/react-query";

interface ServiceDetailsProps {
  service: Service;
  onUpdate?: () => void;
  onClose?: () => void;
}

export function ServiceDetails({ service, onUpdate, onClose }: ServiceDetailsProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [actionInProgress, setActionInProgress] = useState(false);
  const [showEnv, setShowEnv] = useState(false);

  const handleAction = async (action: "start" | "stop" | "restart") => {
    setActionInProgress(true);
    try {
      if (action === "start") {
        await serviceService.start(service.id);
        toast.success(`Started ${service.name}`);
      } else if (action === "stop") {
        await serviceService.stop(service.id);
        toast.success(`Stopped ${service.name}`);
      } else {
        await serviceService.restart(service.id);
        toast.success(`Restarted ${service.name}`);
      }
      // Optimistically update status cache
      const optimisticStatus = action === "stop" ? "Stopped" : "Running";
      queryClient.setQueryData<Record<string, string>>(
        ["services", "statuses"],
        (prev) => prev ? { ...prev, [service.id]: optimisticStatus } : { [service.id]: optimisticStatus }
      );
      // Delay the refetch to allow components to react to optimistic update
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["services", "statuses"] });
        queryClient.invalidateQueries({ queryKey: ["apps"] });
      }, 500);
      onUpdate?.();
    } catch (err) {
      toast.error(`Failed to ${action} ${service.name}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "running":
        return { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" };
      case "stopped":
        return { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30" };
      case "starting":
      case "stopping":
        return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" };
      case "failed":
        return { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/30" };
      default:
        return { bg: "bg-slate-500/10", text: "text-slate-500", border: "border-slate-500/30" };
    }
  };

  const statusColors = getStatusColor(service.status || "unknown");

  const getServiceIcon = () => {
    if (service.type === "container") return FaDocker;
    if (service.type === "pod") return FaNetworkWired;
    return FaTerminal;
  };

  const ServiceIcon = getServiceIcon();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-start gap-4">
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center
            ${service.type === "container" ? "bg-blue-500/20 text-blue-400" :
              service.type === "pod" ? "bg-violet-500/20 text-violet-400" :
              "bg-slate-700 text-slate-400"
            }
          `}>
            <ServiceIcon className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-100 truncate">{service.name}</h2>
              <span className={`
                px-2 py-0.5 rounded text-xs font-medium border
                ${statusColors.bg} ${statusColors.text} ${statusColors.border}
              `}>
                <FaCircle className="w-1.5 h-1.5 inline mr-1.5" />
                {service.status}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <FaServer className="w-3 h-3" />
                {service.machineName || "Unknown"}
              </span>
              <span className="flex items-center gap-1.5">
                <FaCubes className="w-3 h-3" />
                {service.appName || "Unknown"}
              </span>
              <span className="capitalize">{service.type}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {actionInProgress ? (
              <div className="p-3">
                <FaSync className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                {service.status === "running" ? (
                  <button
                    onClick={() => handleAction("stop")}
                    className="p-2.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Stop"
                  >
                    <FaStop className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction("start")}
                    className="p-2.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                    title="Start"
                  >
                    <FaPlay className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleAction("restart")}
                  className="p-2.5 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                  title="Restart"
                >
                  <FaSync className="w-4 h-4" />
                </button>
                <button
                  className="p-2.5 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                  title="Settings"
                >
                  <FaCog className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Configuration */}
        <section>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Configuration
          </h3>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 divide-y divide-slate-700/50">
            {service.type === "process" && (
              <>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-400 text-sm">Executable</span>
                  <span className="text-slate-200 text-sm font-mono truncate max-w-[60%]">
                    {service.executablePath || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-400 text-sm">Arguments</span>
                  <span className="text-slate-200 text-sm font-mono truncate max-w-[60%]">
                    {service.arguments || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-400 text-sm">Working Directory</span>
                  <span className="text-slate-200 text-sm font-mono truncate max-w-[60%]">
                    {service.workingDirectory || "-"}
                  </span>
                </div>
                {service.processId && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-slate-400 text-sm">Process ID</span>
                    <span className="text-emerald-400 text-sm font-mono">{service.processId}</span>
                  </div>
                )}
              </>
            )}

            {service.type === "container" && (
              <>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-400 text-sm">Image</span>
                  <span className="text-slate-200 text-sm font-mono truncate max-w-[60%]">
                    {service.image || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-400 text-sm">Container Name</span>
                  <span className="text-slate-200 text-sm font-mono">
                    {service.containerName || "-"}
                  </span>
                </div>
                {service.ports && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-slate-400 text-sm">Ports</span>
                    <span className="text-slate-200 text-sm font-mono">{service.ports}</span>
                  </div>
                )}
                {service.volumes && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-slate-400 text-sm">Volumes</span>
                    <span className="text-slate-200 text-sm font-mono truncate max-w-[60%]">
                      {service.volumes}
                    </span>
                  </div>
                )}
                {service.containerId && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-slate-400 text-sm">Container ID</span>
                    <span className="text-blue-400 text-sm font-mono">
                      {service.containerId.substring(0, 12)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Settings */}
        <section>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Settings
          </h3>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 divide-y divide-slate-700/50">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400 text-sm">Auto Start</span>
              <span className={`text-sm ${service.autoStart ? "text-emerald-400" : "text-slate-500"}`}>
                {service.autoStart ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400 text-sm">Restart on Failure</span>
              <span className={`text-sm ${service.restartOnFailure ? "text-emerald-400" : "text-slate-500"}`}>
                {service.restartOnFailure ? `Yes (max ${service.maxRestartAttempts})` : "No"}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400 text-sm">Start Order</span>
              <span className="text-slate-200 text-sm">{service.startOrder || 0}</span>
            </div>
            {service.accessLink && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-slate-400 text-sm">Access Link</span>
                <a 
                  href={service.accessLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
                >
                  <FaLink className="w-3 h-3" />
                  Open
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Environment Variables */}
        {Object.keys(service.environmentVariables || {}).length > 0 && (
          <section>
            <button
              onClick={() => setShowEnv(!showEnv)}
              className="flex items-center justify-between w-full text-sm font-medium text-slate-400 uppercase tracking-wider mb-3 hover:text-slate-300"
            >
              <span>Environment Variables ({Object.keys(service.environmentVariables).length})</span>
              {showEnv ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />}
            </button>
            
            {showEnv && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="max-h-48 overflow-auto">
                  {Object.entries(service.environmentVariables).map(([key, value]) => (
                    <div key={key} className="flex items-center px-4 py-2 border-b border-slate-700/30 last:border-0">
                      <span className="text-cyan-400 text-sm font-mono w-1/3 truncate">{key}</span>
                      <span className="text-slate-400 text-sm mx-2">=</span>
                      <span className="text-slate-300 text-sm font-mono flex-1 truncate">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Metadata */}
        <section>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Metadata
          </h3>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 divide-y divide-slate-700/50">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400 text-sm">Created</span>
              <span className="text-slate-300 text-sm">
                {new Date(service.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400 text-sm">Modified</span>
              <span className="text-slate-300 text-sm">
                {new Date(service.modifiedAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-slate-400 text-sm">Service ID</span>
              <span className="text-slate-500 text-xs font-mono">{service.id}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
