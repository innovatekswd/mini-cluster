import React, { useState, memo } from "react";
import { FaCog, FaPlay, FaSpinner, FaStop, FaTrash } from "react-icons/fa";
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

function getStatusDot(status: string): { color: string; pulse: boolean; label: string; canStart: boolean; canStop: boolean } {
  switch (status) {
    case "Running":   return { color: "bg-emerald-400", pulse: true,  label: "Running", canStart: false, canStop: true  };
    case "Stopped":   return { color: "bg-slate-600",   pulse: false, label: "Stopped", canStart: true,  canStop: false };
    case "FailedToStart":
    case "Failed":    return { color: "bg-rose-500",    pulse: false, label: "Failed",  canStart: true,  canStop: false };
    case "Starting":  return { color: "bg-amber-400",   pulse: true,  label: "Starting",canStart: false, canStop: true  };
    default:          return { color: "bg-slate-600",   pulse: false, label: status || "Unknown", canStart: true, canStop: false };
  }
}

export const ServiceListItem = memo<ServiceListItemProps>(function ServiceListItem({
  service, onSelectApp, onEditApp, onDeleteApp, onSelectTab, selected,
}) {
  const status = useServiceStatus(service.id);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [hovered, setHovered] = useState(false);
  const appControlMutation = useAppControlMutation();
  const { confirm } = useConfirm();
  const dot = getStatusDot(status);

  const handleAction = async (e: React.MouseEvent, action: "start" | "stop") => {
    e.stopPropagation();
    setActionInProgress(true);
    try {
      await appControlMutation.mutateAsync({ appId: service.id, appName: service.name, action });
    } catch (err) {
      console.error(`Failed to ${action} service`, err);
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div
      onClick={() => { onSelectApp(service.id); onSelectTab?.("logs"); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer
        transition-all duration-150
        ${selected
          ? "bg-slate-700/60 border-l-2 border-cyan-500"
          : "border-l-2 border-transparent hover:bg-slate-800/60"
        }
      `}
    >
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot.color} ${dot.pulse ? "animate-pulse" : ""}`} />

      {/* Name */}
      <span className={`flex-1 min-w-0 text-sm truncate ${selected ? "text-white font-medium" : "text-slate-300"}`}>
        {service.name}
        {service.autoStart && <sup className="ml-0.5 text-[8px] text-cyan-400">auto</sup>}
      </span>

      {/* Right side: controls (always laid out, opacity switch) */}
      <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
        {/* Secondary actions — gear + trash, show on hover/selected */}
        <div className={`flex items-center gap-0.5 transition-opacity duration-100 ${hovered || selected ? "opacity-100" : "opacity-0"}`}>
          <button
            onClick={e => { e.stopPropagation(); onSelectTab?.("config"); onEditApp(service.id); }}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors"
            title="Configure"
          >
            <FaCog size={10} />
          </button>
          <button
            onClick={async e => {
              e.stopPropagation();
              const ok = await confirm({ title: "Delete Service", message: `Delete "${service.name}"?`, confirmLabel: "Delete", variant: "danger" });
              if (ok) onDeleteApp(service.id);
            }}
            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Delete"
          >
            <FaTrash size={10} />
          </button>
        </div>

        {/* Primary action — start/stop, always visible */}
        {actionInProgress ? (
          <FaSpinner size={10} className="animate-spin text-slate-500 mx-1" />
        ) : dot.canStart ? (
          <button
            onClick={e => handleAction(e, "start")}
            className="p-1 rounded text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            title="Start"
          >
            <FaPlay size={10} />
          </button>
        ) : dot.canStop ? (
          <button
            onClick={e => handleAction(e, "stop")}
            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Stop"
          >
            <FaStop size={10} />
          </button>
        ) : null}
      </div>
    </div>
  );
});
