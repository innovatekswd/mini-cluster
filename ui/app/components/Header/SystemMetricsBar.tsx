import React, { memo } from "react";
import { FaMicrochip, FaMemory, FaHdd, FaServer, FaPlay, FaStop, FaExclamationTriangle } from "react-icons/fa";
import { MiniDonut } from "~/components/MiniDonut";
import type { AppStats } from "~/components/Layout";

interface SystemMetrics {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  totalProcesses: number;
  disks: Array<{ usagePercent: number }>;
}

interface SystemMetricsBarProps {
  appStats?: AppStats;
  systemMetrics?: SystemMetrics | null;
}

export const SystemMetricsBar = memo(function SystemMetricsBar({
  appStats,
  systemMetrics,
}: SystemMetricsBarProps) {
  return (
    <div className="hidden lg:flex items-center gap-2">
      {/* Service Stats */}
      {appStats && (
        <div className="flex items-center gap-1 mr-2 pr-2 border-r border-slate-700/50">
          {/* Running */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-md ${
              appStats.running > 0 ? "bg-emerald-500/10" : "bg-slate-800/30"
            }`}
          >
            <FaPlay
              className={`text-[8px] ${
                appStats.running > 0 ? "text-emerald-400" : "text-slate-500"
              }`}
              aria-hidden="true"
            />
            <span
              className={`text-xs font-medium ${
                appStats.running > 0 ? "text-emerald-400" : "text-slate-500"
              }`}
              aria-label={`${appStats.running} running services`}
            >
              {appStats.running}
            </span>
          </div>
          {/* Stopped */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-md ${
              appStats.stopped > 0 ? "bg-slate-600/20" : "bg-slate-800/30"
            }`}
          >
            <FaStop
              className={`text-[8px] ${
                appStats.stopped > 0 ? "text-slate-400" : "text-slate-500"
              }`}
              aria-hidden="true"
            />
            <span
              className={`text-xs font-medium ${
                appStats.stopped > 0 ? "text-slate-400" : "text-slate-500"
              }`}
              aria-label={`${appStats.stopped} stopped services`}
            >
              {appStats.stopped}
            </span>
          </div>
          {/* Failed */}
          {appStats.failed > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-500/10">
              <FaExclamationTriangle
                className="text-[8px] text-rose-400"
                aria-hidden="true"
              />
              <span
                className="text-xs font-medium text-rose-400"
                aria-label={`${appStats.failed} failed services`}
              >
                {appStats.failed}
              </span>
            </div>
          )}
        </div>
      )}

      {/* System Metrics with Mini Donuts */}
      {systemMetrics && (
        <div className="flex items-center gap-1">
          {/* CPU */}
          <div
            className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-slate-800/40 hover:bg-slate-700/50 transition-colors cursor-default"
            title={`CPU: ${systemMetrics.cpuUsagePercent.toFixed(1)}%`}
          >
            <MiniDonut
              value={systemMetrics.cpuUsagePercent}
              size={22}
              strokeWidth={2.5}
              color="#60a5fa"
              icon={<FaMicrochip />}
            />
            <span className="text-[10px] font-medium text-blue-400 tabular-nums w-7">
              {Math.round(systemMetrics.cpuUsagePercent)}%
            </span>
          </div>

          {/* Memory */}
          <div
            className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-slate-800/40 hover:bg-slate-700/50 transition-colors cursor-default"
            title={`Memory: ${systemMetrics.memoryUsagePercent.toFixed(1)}%`}
          >
            <MiniDonut
              value={systemMetrics.memoryUsagePercent}
              size={22}
              strokeWidth={2.5}
              color="#c084fc"
              icon={<FaMemory />}
            />
            <span className="text-[10px] font-medium text-purple-400 tabular-nums w-7">
              {Math.round(systemMetrics.memoryUsagePercent)}%
            </span>
          </div>

          {/* Disk */}
          {systemMetrics.disks[0] && (
            <div
              className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-slate-800/40 hover:bg-slate-700/50 transition-colors cursor-default"
              title={`Disk: ${systemMetrics.disks[0].usagePercent.toFixed(1)}%`}
            >
              <MiniDonut
                value={systemMetrics.disks[0].usagePercent}
                size={22}
                strokeWidth={2.5}
                color="#4ade80"
                icon={<FaHdd />}
              />
              <span className="text-[10px] font-medium text-green-400 tabular-nums w-7">
                {Math.round(systemMetrics.disks[0].usagePercent)}%
              </span>
            </div>
          )}

          {/* Processes Count */}
          <div
            className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-slate-800/40 hover:bg-slate-700/50 transition-colors cursor-default"
            title={`Processes: ${systemMetrics.totalProcesses}`}
          >
            <FaServer className="text-[10px] text-amber-400" aria-hidden="true" />
            <span className="text-[10px] font-medium text-amber-400 tabular-nums">
              {systemMetrics.totalProcesses}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
