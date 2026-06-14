import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { useSystemMetricsHistory } from "~/hooks/useSystemMetricsHistory";
import { useAppsWithStatsQuery } from "~/hooks/useAppsQueries";
import { useTabVisible } from "~/hooks/useTabVisible";
import { metricsService, formatBytes, formatBytesPerSecond, formatDuration, formatPercent, type ProcessMetricsSnapshot } from "~/services/metricsService";
import { sessionsService, type SessionCorrelationResponse } from "~/services/sessionsService";
import { SessionTimeline } from "~/components/SessionTimeline";
import { ActiveSessionsFeed } from "~/components/ActiveSessionsFeed";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  ReferenceArea,
} from "recharts";
import {
  FaMicrochip,
  FaMemory,
  FaHdd,
  FaNetworkWired,
  FaServer,
  FaClock,
  FaPlay,
  FaStop,
  FaExclamationTriangle,
  FaCubes,
  FaArrowUp,
  FaArrowDown,
  FaChartLine,
  FaThermometerHalf,
  FaBolt,
  FaLayerGroup,
  FaHistory,
  FaStream,
} from "react-icons/fa";

// Chart colors
const COLORS = {
  cpu: { primary: "#06b6d4", gradient: ["#06b6d4", "#0891b2"] },
  memory: { primary: "#8b5cf6", gradient: ["#8b5cf6", "#7c3aed"] },
  disk: { primary: "#10b981", gradient: ["#10b981", "#059669"] },
  network: { primary: "#f59e0b", gradient: ["#f59e0b", "#d97706"] },
  running: "#22c55e",
  stopped: "#64748b",
  failed: "#ef4444",
};

interface HistoryPoint {
  index: number;
  time: string;
  cpu: number;
  memory: number;
  disk: number;
  networkIn: number;
  networkOut: number;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { data: apps = [] } = useAppsWithStatsQuery();
  const {
    current: systemMetrics,
    cpuHistory,
    memoryHistory,
    diskHistory,
    networkSendHistory,
    networkReceiveHistory,
    isLoading,
  } = useSystemMetricsHistory();

  const [liveMetrics, setLiveMetrics] = useState<ProcessMetricsSnapshot[]>([]);
  const [chartHistory, setChartHistory] = useState<HistoryPoint[]>([]);
  const [sessionCorrelation, setSessionCorrelation] = useState<SessionCorrelationResponse | null>(null);

  const isTabVisible = useTabVisible();

  // Fetch live process metrics (pause when tab is hidden)
  useEffect(() => {
    if (!isTabVisible) return;
    const fetchLiveMetrics = async () => {
      try {
        const data = await metricsService.getLiveMetrics();
        setLiveMetrics(Object.values(data));
      } catch (err) {
        console.error("Failed to fetch live metrics:", err);
      }
    };
    fetchLiveMetrics();
    const interval = setInterval(fetchLiveMetrics, 5000);
    return () => clearInterval(interval);
  }, [isTabVisible]);

  // Fetch session correlation data for timeline + events feed
  useEffect(() => {
    if (!isTabVisible) return;
    const fetchSessions = async () => {
      try {
        const from = new Date(Date.now() - 60 * 60 * 1000);
        const res = await sessionsService.getSessionCorrelation(from, new Date());
        setSessionCorrelation(res);
      } catch (err) {
        // non-critical — dashboard still works without session data
      }
    };
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [isTabVisible]);

  // Build chart history from arrays
  useEffect(() => {
    const now = new Date();
    const history: HistoryPoint[] = cpuHistory.map((cpu, i) => ({
      index: i,
      time: new Date(now.getTime() - (cpuHistory.length - i - 1) * 2000).toLocaleTimeString(),
      cpu,
      memory: memoryHistory[i] || 0,
      disk: diskHistory[i] || 0,
      networkIn: (networkReceiveHistory[i] || 0),
      networkOut: (networkSendHistory[i] || 0),
    }));
    setChartHistory(history);
  }, [cpuHistory, memoryHistory, diskHistory, networkSendHistory, networkReceiveHistory]);

  // Compute stats
  const stats = useMemo(() => {
    const totalServices = apps.reduce((sum, app) => sum + (app.serviceCount || 0), 0);
    const runningServices = apps.reduce((sum, app) => sum + (app.runningCount || 0), 0);
    const stoppedServices = apps.reduce((sum, app) => sum + (app.stoppedCount || 0), 0);
    const failedServices = apps.reduce((sum, app) => sum + (app.failedCount || 0), 0);
    
    return {
      totalApps: apps.length,
      totalServices,
      runningServices,
      stoppedServices,
      failedServices,
    };
  }, [apps]);

  // Service status pie chart data
  const statusPieData = [
    { name: "Running", value: stats.runningServices, color: COLORS.running },
    { name: "Stopped", value: stats.stoppedServices, color: COLORS.stopped },
    { name: "Failed", value: stats.failedServices, color: COLORS.failed },
  ].filter(d => d.value > 0);

  // Top services by memory
  const topByMemory = [...liveMetrics]
    .sort((a, b) => b.workingSetMemory - a.workingSetMemory)
    .slice(0, 5);

  // Top services by CPU
  const topByCpu = [...liveMetrics]
    .sort((a, b) => b.cpuUsagePercent - a.cpuUsagePercent)
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin" />
          <span className="text-slate-400">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <FaBolt className="text-amber-400" />
                Dashboard
              </h1>
              <p className="text-slate-400 mt-1">
                {systemMetrics?.machineName || "System"} • {systemMetrics?.osDescription || "Loading..."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-slate-500">System Uptime</div>
                <div className="text-lg font-semibold text-slate-200">
                  {systemMetrics ? formatDuration(systemMetrics.systemUptime) : "--"}
                </div>
              </div>
              <FaClock className="text-3xl text-slate-600" />
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <QuickStatCard
              icon={<FaMicrochip />}
              label="CPU"
              value={systemMetrics ? `${systemMetrics.cpuUsagePercent.toFixed(1)}%` : "--"}
              subValue={`${systemMetrics?.processorCount || 0} cores`}
              color="cyan"
              trend={cpuHistory.length > 1 ? (cpuHistory[cpuHistory.length - 1] > cpuHistory[cpuHistory.length - 2] ? "up" : "down") : null}
              onClick={() => navigate("/monitor/performance")}
            />
            <QuickStatCard
              icon={<FaMemory />}
              label="Memory"
              value={systemMetrics ? `${systemMetrics.memoryUsagePercent.toFixed(1)}%` : "--"}
              subValue={systemMetrics ? formatBytes(systemMetrics.usedPhysicalMemory) : "--"}
              color="violet"
              trend={memoryHistory.length > 1 ? (memoryHistory[memoryHistory.length - 1] > memoryHistory[memoryHistory.length - 2] ? "up" : "down") : null}
              onClick={() => navigate("/monitor/performance")}
            />
            <QuickStatCard
              icon={<FaHdd />}
              label="Disk"
              value={systemMetrics?.disks[0] ? `${systemMetrics.disks[0].usagePercent.toFixed(1)}%` : "--"}
              subValue={systemMetrics?.disks[0] ? formatBytes(systemMetrics.disks[0].availableSpace) + " free" : "--"}
              color="emerald"
              onClick={() => navigate("/monitor/disks")}
            />
            <QuickStatCard
              icon={<FaNetworkWired />}
              label="Network"
              value={systemMetrics ? formatBytesPerSecond(systemMetrics.totalNetworkSendRate + systemMetrics.totalNetworkReceiveRate) : "--"}
              subValue={`↑${systemMetrics ? formatBytesPerSecond(systemMetrics.totalNetworkSendRate) : "--"}`}
              color="amber"
              onClick={() => navigate("/monitor/performance")}
            />
            <QuickStatCard
              icon={<FaCubes />}
              label="Apps"
              value={stats.totalApps.toString()}
              subValue={`${stats.totalServices} services`}
              color="blue"
              onClick={() => navigate("/apps")}
            />
            <QuickStatCard
              icon={<FaServer />}
              label="Processes"
              value={systemMetrics?.totalProcesses.toString() || "--"}
              subValue={`${systemMetrics?.totalThreads || 0} threads`}
              color="rose"
              onClick={() => navigate("/monitor")}
            />
          </div>

          {/* Secondary Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Service Status Distribution - Simplified */}
            <ChartCard
              title="Service Status"
              icon={<FaLayerGroup className="text-emerald-400" />}
              action={
                <button
                  onClick={() => navigate("/monitor/performance")}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  View in Monitor →
                </button>
              }
            >
              {statusPieData.length > 0 ? (
                <div className="space-y-2">
                  {statusPieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            item.name === 'Running' ? 'bg-green-500' :
                            item.name === 'Stopped' ? 'bg-slate-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="text-sm text-slate-400">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-20 text-slate-500">
                  No services found
                </div>
              )}
            </ChartCard>

            {/* Disk Usage */}
            <ChartCard 
              title="Disk Storage" 
              icon={<FaHdd className="text-emerald-400" />}
              action={
                systemMetrics?.disks && systemMetrics.disks.length > 5 ? (
                  <button 
                    onClick={() => navigate("/monitor")}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    View all ({systemMetrics.disks.length})
                  </button>
                ) : undefined
              }
            >
              <div className="space-y-3">
                {systemMetrics?.disks.slice(0, 5).map((disk, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400 truncate max-w-[60%]">{disk.name} ({disk.driveType})</span>
                      <span className="text-slate-200">{disk.usagePercent.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden relative">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                          disk.usagePercent > 90 ? "bg-rose-500" :
                          disk.usagePercent > 70 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${disk.usagePercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{formatBytes(disk.usedSpace)} used</span>
                      <span>{formatBytes(disk.availableSpace)} free</span>
                    </div>
                  </div>
                ))}
                {(!systemMetrics?.disks || systemMetrics.disks.length === 0) && (
                  <div className="text-center text-slate-500 py-4">No disk data available</div>
                )}
              </div>
            </ChartCard>

            {/* Top Memory Consumers */}
            <ChartCard title="Top Memory Usage" icon={<FaMemory className="text-violet-400" />}>
              {topByMemory.length > 0 ? (
                <div className="space-y-3">
                  {topByMemory.map((service, i) => (
                    <div key={service.serviceId} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200 truncate">{service.serviceName || service.serviceId.slice(0, 8)}</div>
                        <div className="h-1.5 bg-slate-700/50 rounded-full mt-1 relative overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-violet-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (service.workingSetMemory / (topByMemory[0]?.workingSetMemory || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{formatBytes(service.workingSetMemory)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-500">
                  No running services
                </div>
              )}
            </ChartCard>
          </div>

          {/* Bottom Row - Top CPU & Events & Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top CPU Consumers */}
            <ChartCard title="Top CPU Usage" icon={<FaMicrochip className="text-cyan-400" />}>
              {topByCpu.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topByCpu} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={10} domain={[0, "auto"]} tickFormatter={(v) => `${v}%`} />
                    <YAxis
                      dataKey="serviceName"
                      type="category"
                      stroke="#64748b"
                      fontSize={10}
                      width={100}
                      tickFormatter={(v) => v?.slice(0, 15) || "Unknown"}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                      labelStyle={{ color: "#94a3b8" }}
                      formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(2)}%`, "CPU"]}
                    />
                    <Bar dataKey="cpuUsagePercent" fill={COLORS.cpu.primary} radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-500">
                  No running services
                </div>
              )}
            </ChartCard>

            {/* Active Sessions Feed */}
            <ChartCard title="Recent Events" icon={<FaHistory className="text-emerald-400" />}>
              <ActiveSessionsFeed correlationData={sessionCorrelation} maxItems={8} />
            </ChartCard>

            {/* Quick Actions / Navigation */}
            <ChartCard title="Quick Actions" icon={<FaBolt className="text-amber-400" />}>
              <div className="grid grid-cols-2 gap-3">
                <QuickActionButton
                  icon={<FaCubes />}
                  label="Applications"
                  description="Manage your apps"
                  onClick={() => navigate("/apps")}
                  color="blue"
                />
                <QuickActionButton
                  icon={<FaServer />}
                  label="Services"
                  description={`${stats.runningServices} running`}
                  onClick={() => navigate("/services")}
                  color="emerald"
                />
                <QuickActionButton
                  icon={<FaThermometerHalf />}
                  label="Monitor"
                  description="System processes"
                  onClick={() => navigate("/monitor")}
                  color="violet"
                />
                <QuickActionButton
                  icon={<FaNetworkWired />}
                  label="Proxy"
                  description="Reverse proxy"
                  onClick={() => navigate("/proxy")}
                  color="amber"
                />
              </div>
            </ChartCard>
          </div>
        </div>
      </div>
    );
  }

// =============================================================================
// Sub-components
// =============================================================================

interface QuickStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: "cyan" | "violet" | "emerald" | "amber" | "blue" | "rose";
  trend?: "up" | "down" | null;
  onClick?: () => void;
}

function QuickStatCard({ icon, label, value, subValue, color, trend, onClick }: QuickStatCardProps) {
  const colorClasses = {
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };

  const iconColors = {
    cyan: "text-cyan-400",
    violet: "text-violet-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
    rose: "text-rose-400",
  };

  return (
    <div
      className={`glass-card border rounded-xl p-4 ${colorClasses[color]} ${onClick ? "cursor-pointer hover:scale-[1.02] transition-transform" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-lg ${iconColors[color]}`}>{icon}</span>
        <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
        {trend && (
          <span className={`ml-auto ${trend === "up" ? "text-rose-400" : "text-emerald-400"}`}>
            {trend === "up" ? <FaArrowUp size={10} /> : <FaArrowDown size={10} />}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-100">{value}</div>
      {subValue && <div className="text-xs text-slate-500 mt-1">{subValue}</div>}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}

function ChartCard({ title, icon, children, action }: ChartCardProps) {
  return (
    <div className="glass-card border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  color: "blue" | "emerald" | "violet" | "amber";
}

function QuickActionButton({ icon, label, description, onClick, color }: QuickActionButtonProps) {
  const colors = {
    blue: "hover:bg-blue-500/20 hover:border-blue-500/40",
    emerald: "hover:bg-emerald-500/20 hover:border-emerald-500/40",
    violet: "hover:bg-violet-500/20 hover:border-violet-500/40",
    amber: "hover:bg-amber-500/20 hover:border-amber-500/40",
  };

  const iconColors = {
    blue: "text-blue-400",
    emerald: "text-emerald-400",
    violet: "text-violet-400",
    amber: "text-amber-400",
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg border border-slate-700/50 bg-slate-800/30 transition-all ${colors[color]}`}
    >
      <span className={`text-xl ${iconColors[color]}`}>{icon}</span>
      <div className="text-left">
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
    </button>
  );
}
