import React from "react";
import { FaBell, FaExclamationTriangle, FaInfoCircle, FaCheckCircle, FaFilter, FaDownload } from "react-icons/fa";
import { useAppsWithStatsQuery } from "~/hooks/useAppsQueries";
import { useSystemMetricsHistory } from "~/hooks/useSystemMetricsHistory";

interface Event {
  id: string;
  timestamp: Date;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  source: string;
}

function generateEventsFromState(apps: any[], cpu: number, memory: number): Event[] {
  const events: Event[] = [];
  const now = new Date();

  // Check for failed services
  apps.forEach((app) => {
    if (app.failedCount > 0) {
      events.push({
        id: `failed-${app.id}`,
        timestamp: new Date(now.getTime() - Math.random() * 3600000),
        severity: "critical",
        title: `${app.failedCount} service(s) failed in ${app.name}`,
        description: `Services in ${app.name} have failed and require attention.`,
        source: app.name,
      });
    }
  });

  // Check for high CPU
  if (cpu > 90) {
    events.push({
      id: "high-cpu",
      timestamp: new Date(now.getTime() - Math.random() * 1800000),
      severity: "warning",
      title: "High CPU Usage",
      description: `CPU usage is at ${cpu.toFixed(1)}%, which is above the 90% threshold.`,
      source: "System",
    });
  }

  // Check for high memory
  if (memory > 90) {
    events.push({
      id: "high-memory",
      timestamp: new Date(now.getTime() - Math.random() * 1800000),
      severity: "warning",
      title: "High Memory Usage",
      description: `Memory usage is at ${memory.toFixed(1)}%, which is above the 90% threshold.`,
      source: "System",
    });
  }

  // Add some info events
  events.push({
    id: "system-startup",
    timestamp: new Date(now.getTime() - 7200000),
    severity: "info",
    title: "System Started",
    description: "MiniCluster agent started successfully.",
    source: "System",
  });

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ObserveEventsPage() {
  const { data: apps = [] } = useAppsWithStatsQuery();
  const { current } = useSystemMetricsHistory();

  const events = generateEventsFromState(
    apps,
    current?.cpuUsagePercent || 0,
    current?.memoryUsagePercent || 0
  );

  const severityConfig = {
    critical: {
      icon: <FaExclamationTriangle />,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
    },
    warning: {
      icon: <FaExclamationTriangle />,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
    },
    info: {
      icon: <FaInfoCircle />,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
    },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <FaBell className="text-cyan-400" />
            Events
          </h1>
          <p className="text-slate-400 mt-1">Alerts and recent system activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2">
            <FaFilter />
            Filter
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <FaDownload />
            Export
          </button>
        </div>
      </div>

      {/* Event Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-rose-400 uppercase tracking-wide">Critical</p>
              <p className="text-2xl font-bold text-rose-400 mt-1">
                {events.filter((e) => e.severity === "critical").length}
              </p>
            </div>
            <FaExclamationTriangle className="text-2xl text-rose-400" />
          </div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-400 uppercase tracking-wide">Warning</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">
                {events.filter((e) => e.severity === "warning").length}
              </p>
            </div>
            <FaExclamationTriangle className="text-2xl text-amber-400" />
          </div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-400 uppercase tracking-wide">Info</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">
                {events.filter((e) => e.severity === "info").length}
              </p>
            </div>
            <FaInfoCircle className="text-2xl text-blue-400" />
          </div>
        </div>
      </div>

      {/* Event List */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Recent Events</h2>
        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="text-center py-8">
              <FaCheckCircle className="text-4xl text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-400">No events to display</p>
              <p className="text-xs text-slate-500 mt-1">System is operating normally</p>
            </div>
          ) : (
            events.map((event) => {
              const config = severityConfig[event.severity];
              return (
                <div
                  key={event.id}
                  className={`${config.bg} border ${config.border} rounded-lg p-4 flex items-start gap-3`}
                >
                  <span className={`${config.color} text-lg mt-0.5`}>{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-semibold text-slate-200">{event.title}</h3>
                      <span className="text-xs text-slate-500">{formatTimeAgo(event.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-400">{event.description}</p>
                    <p className="text-xs text-slate-500 mt-1">Source: {event.source}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
