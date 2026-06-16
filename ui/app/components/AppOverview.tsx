import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import type { AppWithStats } from "~/types/App";
import type { Service } from "~/types/Service";
import { useAppStatusContext } from "~/context/AppStatusContext";
import { useSignalRConnection, useSignalRServiceGroup } from "~/context/SignalRConnectionContext";
import { useAppControlMutation } from "~/hooks/useServiceQueries";
import { metricsService, formatBytes, formatPercent, type ProcessMetricsSnapshot } from "~/services/metricsService";
import { HubConnectionState } from "@microsoft/signalr";
import { AppVitalsStrip } from "./AppVitalsStrip";
import {
  FaPlay, FaStop, FaSpinner, FaEllipsisV, FaEdit,
  FaExternalLinkAlt, FaPlus, FaChartBar, FaList,
  FaTerminal, FaFolderOpen,
} from "react-icons/fa";
import { useLogContext } from "~/context/LogContext";

interface AppOverviewProps {
  app: AppWithStats;
  services: Service[];
  onSelectService: (service: Service) => void;
  onEditService: (service: Service) => void;
  onAddService: () => void;
}

interface ServiceRowMetrics {
  cpu: number;
  mem: number;
}

function ServiceRow({
  service,
  onSelect,
  onEdit,
}: {
  service: Service;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const { statuses } = useAppStatusContext();
  const connection = useSignalRConnection();
  const { joinServiceGroup, leaveServiceGroup } = useSignalRServiceGroup();
  const { clearLogs } = useLogContext();
  const [metrics, setMetrics] = useState<ServiceRowMetrics | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const status = (statuses[service.id] || service.status || "stopped").toLowerCase();
  const isRunning = status === "running" || status === "started";

  const controlMutation = useAppControlMutation({
    onMutate: async ({ action }) => {
      if (action === "start" || action === "restart") clearLogs(service.id);
    },
  });
  const isPending = controlMutation.isPending;

  const fetchMetrics = useCallback(async () => {
    const m = await metricsService.getServiceLiveMetrics(service.id).catch(() => null);
    if (m) setMetrics({ cpu: m.cpuUsagePercent, mem: m.workingSetMemory });
  }, [service.id]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics, isRunning]);

  useEffect(() => {
    if (!connection || connection.state !== HubConnectionState.Connected || !isRunning) return;
    joinServiceGroup(service.id);
    const handle = (snap: ProcessMetricsSnapshot) => {
      if (snap.serviceId === service.id) {
        setMetrics({ cpu: snap.cpuUsagePercent, mem: snap.workingSetMemory });
      }
    };
    connection.on("ProcessMetrics", handle);
    return () => {
      connection.off("ProcessMetrics", handle);
      leaveServiceGroup(service.id);
    };
  }, [connection, service.id, isRunning, joinServiceGroup, leaveServiceGroup]);

  const handleControl = (e: React.MouseEvent, action: "start" | "stop") => {
    e.stopPropagation();
    controlMutation.mutate({ appId: service.id, appName: service.name, action });
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 bg-slate-800/40 border border-slate-700/40 rounded-xl hover:bg-slate-700/40 cursor-pointer transition-colors group"
      onClick={onSelect}
    >
      {/* Status dot */}
      <div
        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          isRunning ? "bg-emerald-400" : status === "failed" || status === "error" ? "bg-rose-500" : "bg-slate-500"
        }`}
      />

      {/* Name + path */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-100 text-sm truncate">{service.name}</span>
          {service.isExternal && (
            <span className="px-1.5 py-0.5 rounded bg-yellow-700/40 text-yellow-300 text-xs">External</span>
          )}
        </div>
        <div className="text-xs text-slate-500 truncate mt-0.5">
          {service.executablePath || "No executable"}
        </div>
      </div>

      {/* Live metrics */}
      <div className="hidden md:flex items-center gap-4 text-xs text-slate-400 flex-shrink-0">
        <span className="flex items-center gap-1">
          <span className="text-slate-500">CPU</span>
          <span className={`font-mono font-medium ${metrics && metrics.cpu > 80 ? "text-amber-400" : "text-slate-300"}`}>
            {metrics ? formatPercent(metrics.cpu) : "—"}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-slate-500">MEM</span>
          <span className="font-mono font-medium text-slate-300">
            {metrics ? formatBytes(metrics.mem) : "—"}
          </span>
        </span>
      </div>

      {/* Access link */}
      {service.accessLink && (
        <a
          href={service.accessLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 p-1.5 flex-shrink-0"
          onClick={e => e.stopPropagation()}
          title="Open"
        >
          <FaExternalLinkAlt size={11} />
        </a>
      )}

      {/* Status badge */}
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
          isRunning
            ? "bg-emerald-500/10 text-emerald-400"
            : status === "failed" || status === "error"
            ? "bg-rose-500/10 text-rose-400"
            : "bg-slate-700/50 text-slate-400"
        }`}
      >
        {isRunning ? "Running" : status.charAt(0).toUpperCase() + status.slice(1)}
      </span>

      {/* Controls — always visible, compact */}
      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
        {isRunning ? (
          <button
            onClick={e => handleControl(e, "stop")}
            disabled={isPending}
            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors disabled:opacity-50"
            title="Stop"
          >
            {isPending ? <FaSpinner size={11} className="animate-spin" /> : <FaStop size={11} />}
          </button>
        ) : (
          <button
            onClick={e => handleControl(e, "start")}
            disabled={isPending}
            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors disabled:opacity-50"
            title="Start"
          >
            {isPending ? <FaSpinner size={11} className="animate-spin" /> : <FaPlay size={11} />}
          </button>
        )}

        {/* ⋯ menu */}
        <div className="relative">
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
          >
            <FaEllipsisV size={11} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => { setMenuOpen(false); onEdit(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                <FaEdit size={11} /> Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AppOverview({ app, services, onSelectService, onEditService, onAddService }: AppOverviewProps) {
  const navigate = useNavigate();

  const quickLinks = [
    { label: "Inspect", icon: <FaChartBar size={12} />, path: "/inspect/local/overview" },
    { label: "Events", icon: <FaList size={12} />, path: "/inspect/local/events" },
    { label: "Terminal", icon: <FaTerminal size={12} />, path: "/inspect/local/terminal" },
    { label: "Files", icon: <FaFolderOpen size={12} />, path: "/inspect/local/files" },
  ];

  return (
    <div className="h-full overflow-auto p-6 space-y-5">
      {/* App Vitals Strip */}
      <AppVitalsStrip services={services} />

      {/* Service Cards — 2-col grid, metric-first layout */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Services</h2>
        {services.length === 0 ? (
          <button
            onClick={onAddService}
            className="w-full py-10 rounded-xl border-2 border-dashed border-slate-700/60 hover:border-slate-600 text-slate-500 hover:text-slate-300 transition-colors text-sm flex flex-col items-center gap-2"
          >
            <FaPlus size={14} />
            Add your first service
          </button>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {services.map(service => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  onSelect={() => onSelectService(service)}
                  onEdit={() => onEditService(service)}
                />
              ))}
            </div>
            {/* Add Service — full-width dashed below the cards */}
            <button
              onClick={onAddService}
              className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-slate-700/60 hover:border-slate-600 text-slate-500 hover:text-slate-300 transition-colors text-xs flex items-center justify-center gap-1.5"
            >
              <FaPlus size={9} /> Add Service
            </button>
          </>
        )}
      </div>

      {/* Quick Access */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Machine Tools</h2>
        <div className="flex flex-wrap gap-2">
          {quickLinks.map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/40 hover:bg-slate-700/50 hover:border-slate-600/50 text-slate-300 text-sm transition-colors"
            >
              <span className="text-slate-400">{link.icon}</span>
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
