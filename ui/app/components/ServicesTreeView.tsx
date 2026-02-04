import React, { useCallback, memo } from "react";
import { 
  FaCubes, FaPlus, FaSync,
  FaPlay, FaStop, FaCircle, FaEllipsisV
} from "react-icons/fa";
import { useAppsQuery, useAppControlMutation } from "~/hooks/useServiceQueries";
import type { Service } from "~/types/Service";

interface ServicesTreeViewProps {
  onSelectApp?: (appId: string) => void;
  selectedAppId?: string;
  onAddApp?: (parentId?: string) => void;
}

export function ServicesTreeView({ onSelectApp, selectedAppId, onAddApp }: ServicesTreeViewProps) {
  const { data: services = [], isLoading, refetch } = useAppsQuery();
  const controlMutation = useAppControlMutation();

  const handleServiceAction = useCallback((service: Service, action: "start" | "stop") => {
    controlMutation.mutate({ appId: service.id, appName: service.name, action });
  }, [controlMutation]);

  const isActionPending = (serviceId: string) => 
    controlMutation.isPending && controlMutation.variables?.appId === serviceId;

  const getStatusColor = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case "running":
        return "text-emerald-400";
      case "stopped":
        return "text-slate-500";
      case "starting":
      case "stopping":
        return "text-amber-400 animate-pulse";
      case "failed":
        return "text-rose-400";
      default:
        return "text-slate-600";
    }
  };

  const runningCount = services.filter(s => s.status?.toLowerCase() === "running").length;

  const renderServiceItem = (service: Service) => {
    const isSelected = service.id === selectedAppId;
    const isPending = isActionPending(service.id);

    return (
      <div key={service.id}>
        <div
          className={`
            flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors rounded-lg mx-1 my-0.5
            ${isSelected 
              ? "bg-cyan-500/15 border border-cyan-500/30" 
              : "hover:bg-slate-700/30 border border-transparent"
            }
          `}
          onClick={() => onSelectApp?.(service.id)}
        >
          {/* Spacer for alignment */}
          <span className="w-4" />

          {/* Icon */}
          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-slate-700/50 text-slate-400">
            <FaCubes className="w-3 h-3" />
          </div>

          {/* Name & Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-medium truncate ${isSelected ? "text-cyan-300" : "text-slate-200"}`}>
                {service.name}
              </span>
              {service.isExternal && (
                <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
                  External
                </span>
              )}
            </div>
            {service.workingDirectory && (
              <div className="text-xs text-slate-500 truncate">{service.workingDirectory}</div>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-1">
            <FaCircle className={`w-2 h-2 ${getStatusColor(service.status)}`} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {isPending ? (
              <div className="p-1.5">
                <FaSync className="w-3 h-3 animate-spin text-slate-400" />
              </div>
            ) : service.status?.toLowerCase() === "running" ? (
              <button
                onClick={() => handleServiceAction(service, "stop")}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                aria-label={`Stop ${service.name}`}
              >
                <FaStop className="w-3 h-3" aria-hidden="true" />
              </button>
            ) : (
              <button
                onClick={() => handleServiceAction(service, "start")}
                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                aria-label={`Start ${service.name}`}
              >
                <FaPlay className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
            
            <button
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
              aria-label={`More options for ${service.name}`}
            >
              <FaEllipsisV className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 
            flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <FaCubes className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Services</h2>
            <p className="text-sm text-slate-500">
              {services.length} service{services.length !== 1 ? "s" : ""} • {runningCount} running
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="btn-secondary p-2"
            aria-label="Refresh services"
          >
            <FaSync className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => onAddApp?.()}
            className="btn-primary flex items-center gap-2"
          >
            <FaPlus className="w-3 h-3" />
            <span>Add Service</span>
          </button>
        </div>
      </div>

      {/* Service List */}
      <div className="flex-1 overflow-auto">
        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <FaCubes className="w-12 h-12 mb-4 opacity-30" />
            <p>No services found</p>
            <button
              onClick={() => onAddApp?.()}
              className="mt-4 text-cyan-400 hover:text-cyan-300 text-sm"
            >
              Add your first service
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {services.map(service => renderServiceItem(service))}
          </div>
        )}
      </div>
    </div>
  );
}
