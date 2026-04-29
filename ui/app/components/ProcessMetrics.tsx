import React, { useState, useEffect, useCallback } from "react";
import { 
  metricsService, 
  formatBytes, 
  formatBytesPerSecond,
  formatPercent, 
  formatDuration,
  type ProcessMetricsSnapshot,
  type MetricsDataPoint,
  type PeakMetricsResponse
} from "~/services/metricsService";
import { sessionsService, type SessionInfo, formatSessionDuration } from "~/services/sessionsService";
import { useSignalRConnection, useSignalRServiceGroup } from "~/context/SignalRConnectionContext";
import { useAppStatusContext } from "~/context/AppStatusContext";
import { useTabVisible } from "~/hooks/useTabVisible";
import { HubConnectionState } from "@microsoft/signalr";
import { 
  FaMemory, FaMicrochip, FaClock, FaChartLine, FaHistory, 
  FaExclamationTriangle, FaCheckCircle, FaArrowUp, FaArrowDown,
  FaSyncAlt, FaExpand, FaCompress, FaHdd
} from "react-icons/fa";

interface ProcessMetricsProps {
  serviceId: string;
  serviceName?: string;
}

type TimeRange = "5m" | "15m" | "1h" | "6h" | "24h";

const timeRangeOptions: { value: TimeRange; label: string; minutes: number }[] = [
  { value: "5m", label: "5 min", minutes: 5 },
  { value: "15m", label: "15 min", minutes: 15 },
  { value: "1h", label: "1 hour", minutes: 60 },
  { value: "6h", label: "6 hours", minutes: 360 },
  { value: "24h", label: "24 hours", minutes: 1440 },
];

export function ProcessMetrics({ serviceId, serviceName }: ProcessMetricsProps) {
  const connection = useSignalRConnection();
  const { joinServiceGroup, leaveServiceGroup } = useSignalRServiceGroup();
  const { statuses } = useAppStatusContext();
  const isTabVisible = useTabVisible();
  const [currentMetrics, setCurrentMetrics] = useState<ProcessMetricsSnapshot | null>(null);
  const [historicalData, setHistoricalData] = useState<MetricsDataPoint[]>([]);
  const [peakData, setPeakData] = useState<PeakMetricsResponse | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("15m");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("live");

  // Check if service is running from batch status (more reactive than currentMetrics)
  const serviceStatusFromContext = statuses[serviceId] || "Unknown";
  const isServiceRunning = serviceStatusFromContext === "Running" || serviceStatusFromContext === "Started";

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      let from: Date;
      let to: Date = new Date();

      // If a specific session is selected, scope to its time range
      const session = sessions.find(s => s.sessionId === selectedSessionId);
      if (session) {
        from = new Date(session.startTimestamp);
        to = session.endTimestamp ? new Date(session.endTimestamp) : new Date();
      } else {
        const rangeMinutes = timeRangeOptions.find(o => o.value === timeRange)?.minutes || 15;
        from = new Date(Date.now() - rangeMinutes * 60 * 1000);
      }
      
      const [current, history, peaks] = await Promise.all([
        metricsService.getServiceLiveMetrics(serviceId).catch(() => null),
        metricsService.getHistoricalMetrics(serviceId, from, to, 500).catch(() => ({ dataPoints: [] })),
        metricsService.getPeakMetrics(serviceId, from).catch(() => null),
      ]);
      
      setCurrentMetrics(current);
      setHistoricalData(history.dataPoints || []);
      setPeakData(peaks);
    } catch (err: any) {
      if (err.response?.status !== 404) {
        setError("Failed to load metrics");
        console.error("Error fetching metrics:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [serviceId, timeRange, selectedSessionId, sessions]);

  // Initial load and time range changes (also re-fetch when service becomes running)
  useEffect(() => {
    fetchData();
  }, [fetchData, isServiceRunning]);

  // Fetch recent sessions for session picker
  useEffect(() => {
    sessionsService.getSessions(serviceId, 1, 10).then((res) => {
      setSessions(res.sessions);
    }).catch(() => {});
  }, [serviceId]);

  // Subscribe to real-time updates via SignalR (only for running services)
  useEffect(() => {
    if (!connection || !autoRefresh || !isServiceRunning) return;

    // Join service group for metrics updates
    if (connection.state === HubConnectionState.Connected) {
      joinServiceGroup(serviceId);
    }

    const handleMetrics = (snapshot: ProcessMetricsSnapshot) => {
      if (snapshot.serviceId === serviceId) {
        setCurrentMetrics(snapshot);
        // Add to historical data
        setHistoricalData(prev => {
          const newPoint: MetricsDataPoint = {
            timestamp: snapshot.timestamp,
            workingSetMemory: snapshot.workingSetMemory,
            privateMemory: snapshot.privateMemory,
            cpuUsagePercent: snapshot.cpuUsagePercent,
            threadCount: snapshot.threadCount,
            handleCount: snapshot.handleCount,
            isResponding: snapshot.isResponding,
            diskBytesRead: snapshot.diskBytesRead,
            diskBytesWritten: snapshot.diskBytesWritten,
            diskReadRate: snapshot.diskReadRate,
            diskWriteRate: snapshot.diskWriteRate,
          };
          // Keep only points within time range
          const rangeMinutes = timeRangeOptions.find(o => o.value === timeRange)?.minutes || 15;
          const cutoff = new Date(Date.now() - rangeMinutes * 60 * 1000);
          const filtered = prev.filter(p => new Date(p.timestamp) > cutoff);
          return [...filtered, newPoint];
        });
      }
    };

    connection.on("ProcessMetrics", handleMetrics);
    
    return () => {
      connection.off("ProcessMetrics", handleMetrics);
      leaveServiceGroup(serviceId);
    };
  }, [connection, serviceId, autoRefresh, timeRange, joinServiceGroup, leaveServiceGroup, isServiceRunning]);

  // Fallback poll only when SignalR is disconnected AND tab is visible
  useEffect(() => {
    if (!autoRefresh || !isServiceRunning || !isTabVisible) return;
    // Skip fallback poll when SignalR is actively delivering real-time data
    if (connection?.state === HubConnectionState.Connected) return;
    
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData, isServiceRunning, isTabVisible, connection]);

  // Calculate min/max/avg from historical data
  const stats = React.useMemo(() => {
    if (historicalData.length === 0) return null;
    
    return {
      memory: {
        min: Math.min(...historicalData.map(d => d.workingSetMemory)),
        max: Math.max(...historicalData.map(d => d.workingSetMemory)),
        avg: historicalData.reduce((sum, d) => sum + d.workingSetMemory, 0) / historicalData.length,
      },
      cpu: {
        min: Math.min(...historicalData.map(d => d.cpuUsagePercent)),
        max: Math.max(...historicalData.map(d => d.cpuUsagePercent)),
        avg: historicalData.reduce((sum, d) => sum + d.cpuUsagePercent, 0) / historicalData.length,
      },
      threads: {
        min: Math.min(...historicalData.map(d => d.threadCount)),
        max: Math.max(...historicalData.map(d => d.threadCount)),
        avg: historicalData.reduce((sum, d) => sum + d.threadCount, 0) / historicalData.length,
      }
    };
  }, [historicalData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentMetrics && historicalData.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 text-center">
        <FaChartLine className="w-12 h-12 mx-auto text-slate-600 mb-3" />
        <h3 className="text-lg font-medium text-slate-400 mb-2">No Metrics Available</h3>
        <p className="text-sm text-slate-500">
          Process metrics will appear here when the service is running.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${expanded ? 'fixed inset-0 z-50 bg-slate-900 p-6 overflow-auto' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FaChartLine className="text-cyan-400" />
          <h3 className="text-lg font-semibold text-slate-100">Process Metrics</h3>
          {currentMetrics?.isResponding ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-full">
              <FaCheckCircle /> Responding
            </span>
          ) : currentMetrics ? (
            <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded-full">
              <FaExclamationTriangle /> Not Responding
            </span>
          ) : null}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Session Picker */}
          {sessions.length > 0 && (
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 max-w-[160px]"
              title="Scope metrics to a session"
            >
              <option value="live">Live / Time Range</option>
              {sessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {new Date(s.startTimestamp).toLocaleTimeString()} ({formatSessionDuration(s.durationSeconds)})
                </option>
              ))}
            </select>
          )}

          {/* Time Range Selector */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            {timeRangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeRange(opt.value)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  timeRange === opt.value
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg transition-colors ${
              autoRefresh ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
            }`}
            title={autoRefresh ? "Auto-refresh enabled" : "Auto-refresh disabled"}
          >
            <FaSyncAlt className={autoRefresh ? 'animate-spin-slow' : ''} />
          </button>
          
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
            title="Refresh"
          >
            <FaSyncAlt />
          </button>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <FaCompress /> : <FaExpand />}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Current Metrics Grid */}
      {currentMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Memory */}
          <MetricCard
            icon={<FaMemory className="text-blue-400" />}
            label="Memory"
            value={formatBytes(currentMetrics.workingSetMemory)}
            subValue={`Private: ${formatBytes(currentMetrics.privateMemory)}`}
            trend={stats ? getTrend(currentMetrics.workingSetMemory, stats.memory.avg) : null}
          />
          
          {/* CPU */}
          <MetricCard
            icon={<FaMicrochip className="text-emerald-400" />}
            label="CPU Usage"
            value={formatPercent(currentMetrics.cpuUsagePercent)}
            subValue={`Peak: ${stats ? formatPercent(stats.cpu.max) : '-'}`}
            trend={stats ? getTrend(currentMetrics.cpuUsagePercent, stats.cpu.avg) : null}
            highlight={currentMetrics.cpuUsagePercent > 80}
          />
          
          {/* Disk I/O */}
          <MetricCard
            icon={<FaHdd className="text-orange-400" />}
            label="Disk I/O"
            value={`↓${formatBytesPerSecond(currentMetrics.diskReadRate)}`}
            subValue={`↑${formatBytesPerSecond(currentMetrics.diskWriteRate)}`}
          />
          
          {/* Threads */}
          <MetricCard
            icon={<FaChartLine className="text-violet-400" />}
            label="Threads"
            value={currentMetrics.threadCount.toString()}
            subValue={`Handles: ${currentMetrics.handleCount}`}
            trend={stats ? getTrend(currentMetrics.threadCount, stats.threads.avg) : null}
          />
          
          {/* Uptime */}
          <MetricCard
            icon={<FaClock className="text-amber-400" />}
            label="Uptime"
            value={formatDuration(currentMetrics.uptime)}
            subValue={`PID: ${currentMetrics.processId || '-'}`}
          />
        </div>
      )}

      {/* Historical Chart (Simple ASCII representation) */}
      {historicalData.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <FaHistory className="text-slate-400" />
              Historical Data ({historicalData.length} samples)
            </h4>
          </div>
          
          {/* Memory Chart */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Memory Usage</span>
              <span className="text-xs text-slate-500">
                Min: {stats ? formatBytes(stats.memory.min) : '-'} | 
                Avg: {stats ? formatBytes(stats.memory.avg) : '-'} | 
                Max: {stats ? formatBytes(stats.memory.max) : '-'}
              </span>
            </div>
            <SimpleChart 
              data={historicalData.map(d => d.workingSetMemory)} 
              color="blue" 
              height={60}
            />
          </div>
          
          {/* CPU Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">CPU Usage</span>
              <span className="text-xs text-slate-500">
                Min: {stats ? formatPercent(stats.cpu.min) : '-'} | 
                Avg: {stats ? formatPercent(stats.cpu.avg) : '-'} | 
                Max: {stats ? formatPercent(stats.cpu.max) : '-'}
              </span>
            </div>
            <SimpleChart 
              data={historicalData.map(d => d.cpuUsagePercent)} 
              color="green" 
              height={60}
              maxValue={100}
            />
          </div>
        </div>
      )}

      {/* Peak Information */}
      {peakData && peakData.totalSamples > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <FaArrowUp className="text-rose-400" />
            Peak Values (Last {timeRangeOptions.find(o => o.value === timeRange)?.label})
          </h4>
          <div className="grid grid-cols-3 gap-4">
            {peakData.peakMemory && (
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-400">
                  {peakData.peakMemory.formattedValue}
                </div>
                <div className="text-xs text-slate-500">Peak Memory</div>
                <div className="text-xs text-slate-600">
                  {new Date(peakData.peakMemory.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
            {peakData.peakCpu && (
              <div className="text-center">
                <div className="text-lg font-semibold text-emerald-400">
                  {peakData.peakCpu.formattedValue}
                </div>
                <div className="text-xs text-slate-500">Peak CPU</div>
                <div className="text-xs text-slate-600">
                  {new Date(peakData.peakCpu.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
            {peakData.peakThreads && (
              <div className="text-center">
                <div className="text-lg font-semibold text-violet-400">
                  {peakData.peakThreads.formattedValue}
                </div>
                <div className="text-xs text-slate-500">Peak Threads</div>
                <div className="text-xs text-slate-600">
                  {new Date(peakData.peakThreads.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for metric cards
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'stable' | null;
  highlight?: boolean;
}

function MetricCard({ icon, label, value, subValue, trend, highlight }: MetricCardProps) {
  return (
    <div className={`bg-slate-800/50 border rounded-xl p-4 ${
      highlight ? 'border-amber-500/50' : 'border-slate-700/50'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-slate-400">{label}</span>
        {trend && (
          <span className={`ml-auto ${
            trend === 'up' ? 'text-rose-400' : 
            trend === 'down' ? 'text-emerald-400' : 
            'text-slate-400'
          }`}>
            {trend === 'up' ? <FaArrowUp size={10} /> : 
             trend === 'down' ? <FaArrowDown size={10} /> : null}
          </span>
        )}
      </div>
      <div className="text-xl font-semibold text-slate-100">{value}</div>
      {subValue && (
        <div className="text-xs text-slate-500 mt-1">{subValue}</div>
      )}
    </div>
  );
}

// Simple SVG-based chart component
interface SimpleChartProps {
  data: number[];
  color: 'blue' | 'green' | 'violet';
  height: number;
  maxValue?: number;
}

function SimpleChart({ data, color, height, maxValue }: SimpleChartProps) {
  if (data.length === 0) return null;
  
  const max = maxValue || Math.max(...data) * 1.1 || 1;
  const width = 100;
  const points = data.map((value, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * width;
    const y = height - (value / max) * height;
    return `${x},${y}`;
  }).join(' ');

  const colorMap = {
    blue: { stroke: '#60a5fa', fill: 'rgba(96, 165, 250, 0.1)' },
    green: { stroke: '#34d399', fill: 'rgba(52, 211, 153, 0.1)' },
    violet: { stroke: '#a78bfa', fill: 'rgba(167, 139, 250, 0.1)' },
  };

  const colors = colorMap[color];

  return (
    <svg 
      viewBox={`0 0 ${width} ${height}`} 
      className="w-full" 
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colors.stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Fill area */}
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#gradient-${color})`}
      />
      
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={colors.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getTrend(current: number, avg: number): 'up' | 'down' | 'stable' {
  const diff = (current - avg) / avg;
  if (diff > 0.1) return 'up';
  if (diff < -0.1) return 'down';
  return 'stable';
}

// Add custom CSS for slow spin animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-spin-slow {
    animation: spin-slow 3s linear infinite;
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
}
