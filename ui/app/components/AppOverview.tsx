import React from "react";
import type { AppWithStats } from "~/types/App";
import type { Service } from "~/types/Service";
import { useAppStatusContext } from "~/context/AppStatusContext";
import { FaPlay, FaStop, FaExclamationTriangle, FaCog, FaExternalLinkAlt, FaEdit, FaPlus } from "react-icons/fa";
import { ServiceControl } from "./ServiceControl";
import { useServiceStatus } from "~/hooks/useServiceStatus";

interface AppOverviewProps {
  app: AppWithStats;
  services: Service[];
  onSelectService: (service: Service) => void;
  onEditService: (service: Service) => void;
  onAddService: () => void;
}

// Individual service row component
function ServiceRow({ service, onSelect, onEdit }: { service: Service; onSelect: () => void; onEdit: () => void }) {
  const realtimeStatus = useServiceStatus(service.id);
  const status = realtimeStatus || service.status || "stopped";
  const isRunning = status.toLowerCase() === "running" || status.toLowerCase() === "started";

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors group"
      onClick={onSelect}
    >
      {/* Status indicator */}
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isRunning ? "bg-emerald-500" : "bg-slate-500"}`} />

      {/* Service info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-100 truncate">{service.name}</span>
          {service.isExternal && (
            <span className="px-1.5 py-0.5 rounded bg-yellow-700/50 text-yellow-300 text-xs">External</span>
          )}
        </div>
        <div className="text-xs text-slate-500 truncate mt-0.5">
          {service.executablePath || "No executable"}
        </div>
      </div>

      {/* Access link */}
      {service.accessLink && (
        <a
          href={service.accessLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 p-2"
          onClick={(e) => e.stopPropagation()}
          title="Open access link"
        >
          <FaExternalLinkAlt size={12} />
        </a>
      )}

      {/* Status badge */}
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${isRunning ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-700/50 text-slate-400"}`}>
        {isRunning ? "Running" : "Stopped"}
      </span>

      {/* Controls */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <ServiceControl service={service} />
        <button
          onClick={onEdit}
          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-600/50 rounded transition-colors"
          title="Edit service"
        >
          <FaEdit size={12} />
        </button>
      </div>
    </div>
  );
}

export function AppOverview({ app, services, onSelectService, onEditService, onAddService }: AppOverviewProps) {
  const { statuses } = useAppStatusContext();

  // Calculate live stats
  const stats = React.useMemo(() => {
    let running = 0, stopped = 0, failed = 0;
    services.forEach(s => {
      const status = (statuses[s.id] || s.status || "").toLowerCase();
      if (status === "running" || status === "started") running++;
      else if (status === "failed" || status === "error" || status === "crashed") failed++;
      else stopped++;
    });
    return { total: services.length, running, stopped, failed };
  }, [services, statuses]);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* App Header */}
        <div className="flex items-start gap-4">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ backgroundColor: `${app.color || "#3b82f6"}20` }}
          >
            {app.icon || "📦"}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-100">{app.name}</h1>
            {app.description && (
              <p className="text-sm text-slate-400 mt-1">{app.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span>Created {new Date(app.createdAt).toLocaleDateString()}</span>
              <span>Modified {new Date(app.modifiedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-1">Total Services</div>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
              <FaPlay size={12} />
              {stats.running}
            </div>
            <div className="text-xs text-slate-500 mt-1">Running</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-slate-400 flex items-center gap-2">
              <FaStop size={12} />
              {stats.stopped}
            </div>
            <div className="text-xs text-slate-500 mt-1">Stopped</div>
          </div>
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-rose-400 flex items-center gap-2">
              <FaExclamationTriangle size={12} />
              {stats.failed}
            </div>
            <div className="text-xs text-slate-500 mt-1">Failed</div>
          </div>
        </div>

        {/* Services List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <FaCog className="text-slate-500" />
              Services
            </h2>
            <button
              onClick={onAddService}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm transition-colors"
            >
              <FaPlus size={10} />
              Add Service
            </button>
          </div>

          {services.length === 0 ? (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-8 text-center">
              <FaCog className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-2">No services in this app yet</p>
              <p className="text-sm text-slate-500 mb-4">Add a service to get started</p>
              <button
                onClick={onAddService}
                className="px-4 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm transition-colors"
              >
                <FaPlus className="inline mr-2" size={10} />
                Add Service
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {services.map(service => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  onSelect={() => onSelectService(service)}
                  onEdit={() => onEditService(service)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
