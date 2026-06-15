import React, { useMemo } from "react";
import { Link } from "react-router";
import { FaArrowRight, FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaStopCircle } from "react-icons/fa";
import { useAppsWithStatsQuery } from "~/hooks/useAppsQueries";

// ============================================================================
// Types
// ============================================================================

interface ServiceHealthStatus {
  name: string;
  slug: string;
  appId: string;
  appSlug: string;
  status: "running" | "restarting" | "failed" | "stopped";
}

// ============================================================================
// Status Badge Component
// ============================================================================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = {
    running: { icon: FaCheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    restarting: { icon: FaExclamationTriangle, color: "text-amber-400", bg: "bg-amber-400/10" },
    failed: { icon: FaTimesCircle, color: "text-rose-400", bg: "bg-rose-400/10" },
    stopped: { icon: FaStopCircle, color: "text-slate-400", bg: "bg-slate-400/10" },
  }[status] || { icon: FaStopCircle, color: "text-slate-400", bg: "bg-slate-400/10" };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      <Icon className="text-[10px]" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ServicesHealthWidget: React.FC = () => {
  const { data: apps, isLoading } = useAppsWithStatsQuery();

  // Aggregate stats across all apps
  const stats = useMemo(() => {
    if (!apps) return { running: 0, restarting: 0, failed: 0, stopped: 0, total: 0 };

    let running = 0;
    let failed = 0;
    let stopped = 0;

    apps.forEach((app) => {
      running += app.runningCount;
      failed += app.failedCount;
      stopped += app.stoppedCount;
    });

    // Restarting is counted as part of running in the current API
    // We'll estimate it as a subset (could be refined with more detailed API)
    const restarting = 0; // TODO: Get from API when available

    return {
      running,
      restarting,
      failed,
      stopped,
      total: running + failed + stopped,
    };
  }, [apps]);

  // Get non-healthy services for the mini-list
  const unhealthyServices = useMemo<ServiceHealthStatus[]>(() => {
    if (!apps) return [];

    const services: ServiceHealthStatus[] = [];

    apps.forEach((app) => {
      if (app.failedCount > 0) {
        services.push({
          name: `${app.name} (failed)`,
          slug: app.slug,
          appId: app.id,
          appSlug: app.slug,
          status: "failed",
        });
      }
      if (app.stoppedCount > 0 && app.serviceCount > app.runningCount) {
        services.push({
          name: `${app.name} (stopped)`,
          slug: app.slug,
          appId: app.id,
          appSlug: app.slug,
          status: "stopped",
        });
      }
    });

    // Limit to 5 items
    return services.slice(0, 5);
  }, [apps]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-700/50 rounded-lg" />
          ))}
        </div>
        <div className="h-24 bg-slate-700/50 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Counts */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{stats.running}</div>
          <div className="text-xs text-slate-400 mt-1">Running</div>
        </div>
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{stats.restarting}</div>
          <div className="text-xs text-slate-400 mt-1">Restarting</div>
        </div>
        <div className="bg-rose-400/10 border border-rose-400/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-rose-400">{stats.failed}</div>
          <div className="text-xs text-slate-400 mt-1">Failed</div>
        </div>
        <div className="bg-slate-400/10 border border-slate-400/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-slate-400">{stats.stopped}</div>
          <div className="text-xs text-slate-400 mt-1">Stopped</div>
        </div>
      </div>

      {/* Unhealthy Services List */}
      {unhealthyServices.length > 0 && (
        <div className="border-t border-slate-700/50 pt-3">
          <div className="text-xs text-slate-500 mb-2">Unhealthy Services</div>
          <div className="space-y-1.5">
            {unhealthyServices.map((service, index) => (
              <Link
                key={index}
                to={`/apps/${service.appSlug}`}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <StatusBadge status={service.status} />
                  <span className="text-sm text-slate-300 group-hover:text-slate-100">
                    {service.name}
                  </span>
                </div>
                <FaArrowRight className="text-[10px] text-slate-500 group-hover:text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {unhealthyServices.length === 0 && stats.total > 0 && (
        <div className="border-t border-slate-700/50 pt-3">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <FaCheckCircle />
            <span>All services are healthy</span>
          </div>
        </div>
      )}
    </div>
  );
};
