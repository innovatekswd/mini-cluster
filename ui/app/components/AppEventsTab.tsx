import React from "react";
import { Link } from "react-router";
import type { Service } from "~/types/Service";
import { useAppStatusContext } from "~/context/AppStatusContext";
import { FaBolt, FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaExternalLinkAlt } from "react-icons/fa";

interface AppEventsTabProps {
  services: Service[];
}

interface ServiceEvent {
  id: string;
  timestamp: Date;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  serviceName: string;
}

function generateEventsForServices(services: Service[], statuses: Record<string, string>): ServiceEvent[] {
  const events: ServiceEvent[] = [];
  const now = new Date();

  services.forEach(svc => {
    const status = (statuses[svc.id] || svc.status || "").toLowerCase();
    const isFailed = status === "failed" || status === "error" || status === "crashed";
    const isRunning = status === "running" || status === "started";
    const isStopped = !isRunning && !isFailed;

    if (isFailed) {
      events.push({
        id: `failed-${svc.id}`,
        timestamp: new Date(now.getTime() - Math.random() * 3600000),
        severity: "critical",
        title: `${svc.name} has failed`,
        description: `Service is in a failed state and requires attention.`,
        serviceName: svc.name,
      });
    } else if (isStopped) {
      events.push({
        id: `stopped-${svc.id}`,
        timestamp: new Date(now.getTime() - Math.random() * 7200000),
        severity: "info",
        title: `${svc.name} is stopped`,
        description: `Service is not currently running.`,
        serviceName: svc.name,
      });
    } else if (isRunning) {
      events.push({
        id: `running-${svc.id}`,
        timestamp: new Date(now.getTime() - Math.random() * 1800000),
        severity: "info",
        title: `${svc.name} is running`,
        description: `Service is healthy and responding.`,
        serviceName: svc.name,
      });
    }
  });

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

const severityConfig = {
  critical: {
    icon: <FaExclamationTriangle />,
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/30",
    dot: "bg-rose-500",
  },
  warning: {
    icon: <FaExclamationTriangle />,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    dot: "bg-amber-500",
  },
  info: {
    icon: <FaInfoCircle />,
    color: "text-slate-400",
    bg: "bg-slate-800/50 border-slate-700/40",
    dot: "bg-slate-500",
  },
};

export function AppEventsTab({ services }: AppEventsTabProps) {
  const { statuses } = useAppStatusContext();
  const events = generateEventsForServices(services, statuses);

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaBolt className="text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-200">App Events</h3>
          <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 text-xs">{events.length}</span>
        </div>
        <Link
          to="/inspect/local/events"
          className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <FaExternalLinkAlt size={10} />
          View all in Inspect
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FaCheckCircle className="text-emerald-500 text-3xl mb-3" />
          <p className="text-slate-300 font-medium">All clear</p>
          <p className="text-slate-500 text-sm mt-1">No events to report for this app.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(event => {
            const cfg = severityConfig[event.severity];
            return (
              <div
                key={event.id}
                className={`flex items-start gap-3 p-4 rounded-xl border ${cfg.bg}`}
              >
                <div className={`mt-0.5 flex-shrink-0 ${cfg.color}`}>{cfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm font-medium ${cfg.color}`}>{event.title}</span>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {event.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{event.description}</p>
                  <span className="text-xs text-slate-600 mt-1 inline-block">{event.serviceName}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
