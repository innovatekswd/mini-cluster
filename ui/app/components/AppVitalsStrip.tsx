import React, { useState, useEffect, useCallback } from "react";
import { FaMicrochip, FaMemory, FaCircle } from "react-icons/fa";
import { useSignalRConnection, useSignalRServiceGroup } from "~/context/SignalRConnectionContext";
import { useAppStatusContext } from "~/context/AppStatusContext";
import { metricsService, formatBytes, formatPercent, type ProcessMetricsSnapshot } from "~/services/metricsService";
import { HubConnectionState } from "@microsoft/signalr";
import type { Service } from "~/types/Service";

interface AppVitalsStripProps {
  services: Service[];
}

interface ServiceMetrics {
  cpuUsagePercent: number;
  workingSetMemory: number;
}

export function AppVitalsStrip({ services }: AppVitalsStripProps) {
  const connection = useSignalRConnection();
  const { joinServiceGroup, leaveServiceGroup } = useSignalRServiceGroup();
  const { statuses } = useAppStatusContext();
  const [metricsMap, setMetricsMap] = useState<Record<string, ServiceMetrics>>({});

  const fetchInitialMetrics = useCallback(async () => {
    const results = await Promise.allSettled(
      services.map(s => metricsService.getServiceLiveMetrics(s.id).catch(() => null))
    );
    const map: Record<string, ServiceMetrics> = {};
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) {
        map[services[i].id] = {
          cpuUsagePercent: r.value.cpuUsagePercent,
          workingSetMemory: r.value.workingSetMemory,
        };
      }
    });
    setMetricsMap(map);
  }, [services]);

  useEffect(() => {
    if (services.length > 0) fetchInitialMetrics();
  }, [fetchInitialMetrics]);

  useEffect(() => {
    if (!connection || connection.state !== HubConnectionState.Connected) return;

    services.forEach(s => joinServiceGroup(s.id));

    const handleMetrics = (snapshot: ProcessMetricsSnapshot) => {
      const svc = services.find(s => s.id === snapshot.serviceId);
      if (!svc) return;
      setMetricsMap(prev => ({
        ...prev,
        [snapshot.serviceId]: {
          cpuUsagePercent: snapshot.cpuUsagePercent,
          workingSetMemory: snapshot.workingSetMemory,
        },
      }));
    };

    connection.on("ProcessMetrics", handleMetrics);
    return () => {
      connection.off("ProcessMetrics", handleMetrics);
      services.forEach(s => leaveServiceGroup(s.id));
    };
  }, [connection, services, joinServiceGroup, leaveServiceGroup]);

  const totalCpu = Object.values(metricsMap).reduce((sum, m) => sum + m.cpuUsagePercent, 0);
  const totalMem = Object.values(metricsMap).reduce((sum, m) => sum + m.workingSetMemory, 0);

  const running = services.filter(s => {
    const st = (statuses[s.id] || "").toLowerCase();
    return st === "running" || st === "started";
  }).length;
  const total = services.length;

  const healthColor = running === total && total > 0
    ? "text-emerald-400"
    : running === 0
    ? "text-slate-500"
    : "text-amber-400";

  return (
    <div className="flex items-center gap-6 px-5 py-3 bg-slate-800/40 border border-slate-700/40 rounded-xl">
      <div className="flex items-center gap-2">
        <FaCircle className={`text-xs ${healthColor}`} />
        <span className={`text-sm font-semibold ${healthColor}`}>
          {running}/{total} Running
        </span>
      </div>

      <div className="w-px h-4 bg-slate-700" />

      <div className="flex items-center gap-1.5">
        <FaMicrochip className="text-cyan-400 text-xs" />
        <span className="text-xs text-slate-400">CPU</span>
        <span className="text-sm font-semibold text-slate-200">{formatPercent(totalCpu)}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <FaMemory className="text-violet-400 text-xs" />
        <span className="text-xs text-slate-400">MEM</span>
        <span className="text-sm font-semibold text-slate-200">{formatBytes(totalMem)}</span>
      </div>

      {services.length === 0 && (
        <span className="text-xs text-slate-500 italic">No services</span>
      )}
    </div>
  );
}
