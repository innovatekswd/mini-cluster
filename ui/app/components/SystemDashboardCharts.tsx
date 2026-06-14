import React from "react";
import { useSystemMetricsHistory } from "~/hooks/useSystemMetricsHistory";
import { RichChart } from "./RichChart";
import { formatBytes, formatBytesPerSecond } from "~/services/metricsService";
import { FaMicrochip, FaMemory, FaNetworkWired, FaHdd } from "react-icons/fa";

export function SystemDashboardCharts() {
  const {
    current,
    cpuHistory,
    memoryHistory,
    networkSendHistory,
    networkReceiveHistory,
    diskHistory,
    timestamps,
    isLoading,
    error,
  } = useSystemMetricsHistory();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading system metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">Unable to load system metrics</h3>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  // Calculate stats for each metric
  const calcStats = (data: number[]) => {
    if (data.length === 0) return { min: 0, max: 0, avg: 0 };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const avg = data.reduce((sum, val) => sum + val, 0) / data.length;
    return { min, max, avg };
  };

  const cpuStats = calcStats(cpuHistory);
  const memStats = calcStats(memoryHistory);
  const diskStats = calcStats(diskHistory);
  const netSendStats = calcStats(networkSendHistory);
  const netRecvStats = calcStats(networkReceiveHistory);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-100">System Performance</h2>
            <p className="text-sm text-slate-500 mt-1">Real-time system metrics over the last 5 minutes</p>
          </div>
          {current && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Live • Updates every 5s
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CPU Usage */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FaMicrochip className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-300">CPU Usage</h3>
                <p className="text-xs text-slate-500">
                  {current ? `${current.cpuUsagePercent.toFixed(1)}% current` : 'No data'}
                </p>
              </div>
            </div>
            <RichChart
              data={cpuHistory}
              timestamps={timestamps}
              color="blue"
              height={120}
              maxValue={100}
              showTimeAxis={true}
              showValueAxis={true}
              showGrid={true}
              label="CPU Usage"
              unit="%"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700/50">
              <span>Min: {cpuStats.min.toFixed(1)}%</span>
              <span>Avg: {cpuStats.avg.toFixed(1)}%</span>
              <span>Max: {cpuStats.max.toFixed(1)}%</span>
            </div>
          </div>

          {/* Memory Usage */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <FaMemory className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-300">Memory Usage</h3>
                <p className="text-xs text-slate-500">
                  {current
                    ? `${formatBytes(current.usedPhysicalMemory)} / ${formatBytes(current.totalPhysicalMemory)}`
                    : 'No data'}
                </p>
              </div>
            </div>
            <RichChart
              data={memoryHistory}
              timestamps={timestamps}
              color="violet"
              height={120}
              maxValue={100}
              showTimeAxis={true}
              showValueAxis={true}
              showGrid={true}
              label="Memory Usage"
              unit="%"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700/50">
              <span>Min: {memStats.min.toFixed(1)}%</span>
              <span>Avg: {memStats.avg.toFixed(1)}%</span>
              <span>Max: {memStats.max.toFixed(1)}%</span>
            </div>
          </div>

          {/* Network I/O */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <FaNetworkWired className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-300">Network I/O</h3>
                <p className="text-xs text-slate-500">
                  {current
                    ? `↓ ${formatBytesPerSecond(current.totalNetworkReceiveRate)} • ↑ ${formatBytesPerSecond(current.totalNetworkSendRate)}`
                    : 'No data'}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Send Rate (MB/s)</span>
                  <span>{netSendStats.max.toFixed(2)} MB/s peak</span>
                </div>
                <RichChart
                  data={networkSendHistory}
                  timestamps={timestamps}
                  color="green"
                  height={60}
                  showTimeAxis={true}
                  showValueAxis={false}
                  showGrid={true}
                  label="Network Send"
                  unit="MB/s"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Receive Rate (MB/s)</span>
                  <span>{netRecvStats.max.toFixed(2)} MB/s peak</span>
                </div>
                <RichChart
                  data={networkReceiveHistory}
                  timestamps={timestamps}
                  color="cyan"
                  height={60}
                  showTimeAxis={true}
                  showValueAxis={false}
                  showGrid={true}
                  label="Network Receive"
                  unit="MB/s"
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700/50">
              <span>Send avg: {netSendStats.avg.toFixed(2)} MB/s</span>
              <span>Recv avg: {netRecvStats.avg.toFixed(2)} MB/s</span>
            </div>
          </div>

          {/* Disk Usage */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <FaHdd className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-300">Disk Usage</h3>
                <p className="text-xs text-slate-500">
                  {current && current.disks.length > 0
                    ? `${formatBytes(current.disks[0].usedSpace)} / ${formatBytes(current.disks[0].totalSize)}`
                    : 'No data'}
                </p>
              </div>
            </div>
            <RichChart
              data={diskHistory}
              timestamps={timestamps}
              color="amber"
              height={120}
              maxValue={100}
              showTimeAxis={true}
              showValueAxis={true}
              showGrid={true}
              label="Disk Usage"
              unit="%"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700/50">
              <span>Min: {diskStats.min.toFixed(1)}%</span>
              <span>Avg: {diskStats.avg.toFixed(1)}%</span>
              <span>Max: {diskStats.max.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
