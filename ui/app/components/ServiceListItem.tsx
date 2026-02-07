import React, { useState, memo } from "react";
import {
  FaCog,
  FaPlay,
  FaSpinner,
  FaStop,
  FaTrash,
  FaServer,
} from "react-icons/fa";
import { useServiceStatus } from "~/hooks/useServiceStatus";
import { useAppControlMutation } from "~/hooks/useServiceQueries";
import { useConfirm } from "~/components/ConfirmDialog";
import type { Service } from "~/types/Service";

export interface ServiceListItemProps {
  service: Service;
  onSelectApp: (id: string) => void;
  onEditApp: (id: string) => void;
  onDeleteApp: (id: string) => void;
  onSelectTab?: (tab: string) => void;
  selected: boolean;
}

function getStatusConfig(currentStatus: string) {
  switch (currentStatus) {
    case "Running":
      return {
        text: "Running",
        dotClass: "status-dot-running",
        badgeClass: "badge-success",
        canStart: false,
        canStop: true,
      };
    case "Stopped":
      return {
        text: "Stopped",
        dotClass: "status-dot-stopped",
        badgeClass: "badge-danger",
        canStart: true,
        canStop: false,
      };
    case "FailedToStart":
      return {
        text: "Failed",
        dotClass: "status-dot-warning",
        badgeClass: "badge-warning",
        canStart: true,
        canStop: false,
      };
    case "Unknown":
      return {
        text: "Unknown",
        dotClass: "status-dot-unknown",
        badgeClass: "badge-muted",
        canStart: true,
        canStop: false,
      };
    default:
      return {
        text: currentStatus || "Unknown",
        dotClass: "status-dot-warning",
        badgeClass: "badge-warning",
        canStart: true,
        canStop: false,
      };
  }
}

export const ServiceListItem = memo<ServiceListItemProps>(function ServiceListItem({ 
  service, onSelectApp, onEditApp, onDeleteApp, onSelectTab, selected 
}) {
  const status = useServiceStatus(service.id);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const appControlMutation = useAppControlMutation();
  const { confirm } = useConfirm();

  const handleServiceAction = async (action: "start" | "stop") => {
    setActionInProgress(true);
    try {
      await appControlMutation.mutateAsync({ appId: service.id, appName: service.name, action });
      onSelectApp(service.id);
    } catch (err) {
      console.error(`Failed to ${action} service ${service.id}`, err);
    } finally {
      setActionInProgress(false);
    }
  };

  const statusConfig = getStatusConfig(status);

  return (
    <div
      onClick={() => {
        onSelectApp(service.id);
        onSelectTab?.("logs");
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={`
        group relative cursor-pointer rounded-lg px-2.5 py-2 mb-1
        transition-all duration-200 ease-out
        ${selected 
          ? "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30" 
          : "hover:bg-slate-800/50 border border-transparent"
        }
      `}
    >
      {/* Row 1: Icon + Name^auto */}
      <div className="flex items-center gap-2">
        {/* App Icon with Status Dot */}
        <div className="relative flex-shrink-0">
          <div className={`
            w-6 h-6 rounded-md flex items-center justify-center
            ${selected 
              ? "bg-gradient-to-br from-cyan-500 to-blue-600" 
              : "bg-slate-700/50"
            }
            transition-all duration-200
          `}>
            <FaServer className={`text-[10px] ${selected ? "text-white" : "text-slate-400"}`} />
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${statusConfig.dotClass}`}></span>
        </div>

        {/* Service Name with auto superscript */}
        <div className="flex-1 min-w-0 flex items-baseline gap-0.5">
          <h4 
            className={`app-name-tooltip text-sm font-medium truncate ${selected ? "text-white" : "text-slate-200"}`}
            title={service.name}
            data-tooltip={service.name}
          >
            {service.name}
          </h4>
          {service.autoStart && (
            <sup className="text-[8px] text-cyan-400 font-medium">auto</sup>
          )}
        </div>

        {service.isExternal && (
          <span className="badge text-[9px] px-1.5 py-0.5 badge-info flex-shrink-0">Ext</span>
        )}
      </div>

      {/* Row 2: Status Badge + Action Buttons on hover */}
      <div className="flex items-center justify-between mt-1.5 ml-8">
        {/* Status Badge */}
        <span className={`badge text-[9px] px-1.5 py-0.5 ${statusConfig.badgeClass}`}>
          {statusConfig.text}
        </span>
        
        {/* Controls - always to the right */}
        <div className="flex items-center gap-0.5">
          {/* Start/Stop Button - always visible */}
          {actionInProgress ? (
            <FaSpinner className="animate-spin text-slate-400 text-xs" aria-label="Loading" />
          ) : statusConfig.canStart ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleServiceAction("start"); }}
              className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors"
              title="Start"
              aria-label={`Start ${service.name}`}
            >
              <FaPlay className="text-[10px]" />
            </button>
          ) : statusConfig.canStop ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleServiceAction("stop"); }}
              className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 transition-colors"
              title="Stop"
              aria-label={`Stop ${service.name}`}
            >
              <FaStop className="text-[10px]" />
            </button>
          ) : null}

          {/* Config/Delete Buttons - appear on hover */}
          <div className={`
            flex items-center gap-0.5 transition-all duration-150
            ${showActions || selected ? "opacity-100" : "opacity-0"}
          `}>
            <button
              onClick={(e) => { e.stopPropagation(); onSelectTab?.("config"); onEditApp(service.id); }}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Configure"
              aria-label={`Configure ${service.name}`}
            >
              <FaCog className="text-[10px]" />
            </button>
            
            <button
              onClick={async (e) => {
                e.stopPropagation();
                const confirmed = await confirm({
                  title: 'Delete Service',
                  message: `Are you sure you want to delete "${service.name}"?`,
                  confirmLabel: 'Delete',
                  variant: 'danger',
                });
                if (confirmed) onDeleteApp(service.id);
              }}
              className="p-1.5 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
              title="Delete"
              aria-label={`Delete ${service.name}`}
            >
              <FaTrash className="text-[10px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
