import React, { useMemo } from "react";
import { Link } from "react-router";
import { FaArrowRight, FaExclamationTriangle, FaInfoCircle, FaTimesCircle } from "react-icons/fa";
import { useAppsWithStatsQuery } from "~/hooks/useAppsQueries";
import { useSystemMetricsHistory } from "~/hooks/useSystemMetricsHistory";

// ============================================================================
// Types
// ============================================================================

interface SystemEvent {
  id: string;
  timestamp: Date;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  link?: string;
}

// ============================================================================
// Severity Badge Component
// ============================================================================

const SeverityBadge: React.FC<{ severity: SystemEvent["severity"] }> = ({ severity }) => {
  const config = {
    critical: { icon: FaTimesCircle, color: "text-rose-400", bg: "bg-rose-400/10", label: "Critical" },
    warning: { icon: FaExclamationTriangle, color: "text-amber-400", bg: "bg-amber-400/10", label: "Warning" },
    info: { icon: FaInfoCircle, color: "text-blue-400", bg: "bg-blue-400/10", label: "Info" },
  }[severity];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      <Icon className="text-[10px]" />
      {config.label}
    </span>
  );
};

// ============================================================================
// Time Ago Helper
// ============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

// ============================================================================
// Main Component
// ============================================================================

export const RecentEventsWidget: React.FC = () => {
  const { data: apps } = useAppsWithStatsQuery();
  const { current, cpuHistory, memoryHistory } = useSystemMetricsHistory();

  // Generate events from current system state
  // TODO: Replace with actual Events API when available
  const events = useMemo<SystemEvent[]>(() => {
    const generated: SystemEvent[] = [];
    const now = new Date();

    // Check for failed services
    if (apps) {
      apps.forEach((app) => {
        if (app.failedCount > 0) {
          generated.push({
            id: `failed-${app.id}`,
            timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2h ago
            severity: "critical",
            title: `${app.name} service failed`,
            description: `${app.failedCount} service(s) in failed state`,
            link: `/apps/${app.slug}`,
          });
        }
      });
    }

    // Check for high CPU
    if (cpuHistory.length > 0) {
      const recentCpu = cpuHistory[cpuHistory.length - 1];
      if (recentCpu > 90) {
        generated.push({
          id: "cpu-spike",
          timestamp: new Date(now.getTime() - 30 * 60 * 1000), // 30m ago
          severity: "warning",
          title: "High CPU usage detected",
          description: `CPU usage at ${recentCpu.toFixed(1)}%`,
          link: "/machines/local/resources",
        });
      } else if (recentCpu > 75) {
        generated.push({
          id: "cpu-elevated",
          timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1h ago
          severity: "info",
          title: "Elevated CPU usage",
          description: `CPU usage at ${recentCpu.toFixed(1)}%`,
          link: "/machines/local/resources",
        });
      }
    }

    // Check for high memory
    if (memoryHistory.length > 0) {
      const recentMem = memoryHistory[memoryHistory.length - 1];
      if (recentMem > 90) {
        generated.push({
          id: "memory-spike",
          timestamp: new Date(now.getTime() - 15 * 60 * 1000), // 15m ago
          severity: "warning",
          title: "High memory usage detected",
          description: `Memory usage at ${recentMem.toFixed(1)}%`,
          link: "/machines/local/resources",
        });
      }
    }

    // Check for stopped services
    if (apps) {
      const totalStopped = apps.reduce((sum, app) => sum + app.stoppedCount, 0);
      if (totalStopped > 0) {
        generated.push({
          id: "services-stopped",
          timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4h ago
          severity: "info",
          title: `${totalStopped} service(s) stopped`,
          description: "Some services are not running",
          link: "/services",
        });
      }
    }

    // Add a default info event if no events generated
    if (generated.length === 0) {
      generated.push({
        id: "system-healthy",
        timestamp: now,
        severity: "info",
        title: "System operating normally",
        description: "No recent events detected",
      });
    }

    // Sort by timestamp (most recent first) and limit to 10
    return generated
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }, [apps, cpuHistory, memoryHistory]);

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <Link
          key={event.id}
          to={event.link || "#"}
          className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors group"
        >
          <div className="flex-shrink-0 mt-0.5">
            <SeverityBadge severity={event.severity} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-200 group-hover:text-slate-100 truncate">
                {event.title}
              </span>
              <span className="text-xs text-slate-500 flex-shrink-0">
                {formatTimeAgo(event.timestamp)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{event.description}</p>
          </div>
          {event.link && (
            <FaArrowRight className="flex-shrink-0 text-[10px] text-slate-500 group-hover:text-slate-300 mt-1.5" />
          )}
        </Link>
      ))}
    </div>
  );
};
