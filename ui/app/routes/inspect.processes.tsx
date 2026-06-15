import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaSort,
  FaSortUp,
  FaSortDown,
  FaSearch,
  FaSync,
  FaFilter,
  FaExclamationTriangle,
  FaTrash,
} from "react-icons/fa";
import {
  metricsService,
  formatBytes,
  type SystemProcessInfo,
} from "~/services/metricsService";

// ============================================================================
// Types
// ============================================================================

type SortColumn =
  | "name"
  | "pid"
  | "memory"
  | "threads"
  | "status"
  | "cpu"
  | "startTime";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "running" | "not-responding";

// ============================================================================
// Constants
// ============================================================================

const REFRESH_INTERVAL = 3000; // 3 seconds
const MAX_PROCESSES = 500; // Show up to 500 processes

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusColor(isResponding: boolean): string {
  return isResponding ? "text-emerald-400" : "text-rose-400";
}

function getStatusLabel(isResponding: boolean): string {
  return isResponding ? "Running" : "Not Responding";
}

function getStatusBadgeClasses(isResponding: boolean): string {
  return isResponding
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    : "bg-rose-500/10 text-rose-400 border-rose-500/20";
}

function formatStartTime(startTime: string | null): string {
  if (!startTime) return "—";
  try {
    const date = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return "—";
  }
}

function getCpuColor(cpu: number): string {
  if (cpu >= 80) return "text-rose-400";
  if (cpu >= 50) return "text-amber-400";
  if (cpu >= 20) return "text-cyan-400";
  return "text-slate-300";
}

function getMemoryColor(memMb: number): string {
  if (memMb >= 1024) return "text-rose-400";
  if (memMb >= 512) return "text-amber-400";
  if (memMb >= 100) return "text-cyan-400";
  return "text-slate-300";
}

// ============================================================================
// Sub-Components
// ============================================================================

interface SortHeaderProps {
  label: string;
  column: SortColumn;
  currentSort: SortColumn;
  currentDir: SortDirection;
  onSort: (column: SortColumn) => void;
  align?: "left" | "right" | "center";
  className?: string;
}

const SortHeader: React.FC<SortHeaderProps> = ({
  label,
  column,
  currentSort,
  currentDir,
  onSort,
  align = "left",
  className = "",
}) => {
  const isActive = currentSort === column;

  return (
    <th
      className={`px-3 py-2.5 text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none text-${align} ${className}`}
      onClick={() => onSort(column)}
    >
      <div
        className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}
      >
        <span>{label}</span>
        <span className="text-[10px]">
          {isActive ? (
            currentDir === "asc" ? (
              <FaSortUp />
            ) : (
              <FaSortDown />
            )
          ) : (
            <FaSort className="opacity-30" />
          )}
        </span>
      </div>
    </th>
  );
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3 flex items-center gap-3">
    <div className={`text-lg ${color}`}>{icon}</div>
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-100">{value}</div>
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export default function ProcessManagerPage() {
  const [processes, setProcesses] = useState<SystemProcessInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortColumn>("memory");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [confirmKill, setConfirmKill] = useState<SystemProcessInfo | null>(null);

  const fetchProcesses = useCallback(async () => {
    try {
      setError(null);
      const data = await metricsService.getSystemProcesses("memory", MAX_PROCESSES);
      setProcesses(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch processes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  // Auto-refresh polling
  useEffect(() => {
    if (!isAutoRefresh) return;
    const intervalId = setInterval(fetchProcesses, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [isAutoRefresh, fetchProcesses]);

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  };

  // Filter processes
  const filteredProcesses = useMemo(() => {
    let result = [...processes];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.processName.toLowerCase().includes(query) ||
          p.processId.toString().includes(query)
      );
    }

    // Status filter
    if (statusFilter === "running") {
      result = result.filter((p) => p.isResponding);
    } else if (statusFilter === "not-responding") {
      result = result.filter((p) => !p.isResponding);
    }

    return result;
  }, [processes, searchQuery, statusFilter]);

  // Sort processes client-side
  const sortedProcesses = useMemo(() => {
    const sorted = [...filteredProcesses].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "name":
          comparison = a.processName.localeCompare(b.processName);
          break;
        case "pid":
          comparison = a.processId - b.processId;
          break;
        case "memory":
          comparison = a.workingSetMemory - b.workingSetMemory;
          break;
        case "threads":
          comparison = a.threadCount - b.threadCount;
          break;
        case "status":
          comparison = (a.isResponding ? 1 : 0) - (b.isResponding ? 1 : 0);
          break;
        case "cpu":
          comparison = (a.cpu || 0) - (b.cpu || 0);
          break;
        case "startTime":
          comparison = (a.startTime || "").localeCompare(b.startTime || "");
          break;
      }

      return sortDir === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredProcesses, sortBy, sortDir]);

  // Summary statistics
  const stats = useMemo(() => {
    const totalProcesses = processes.length;
    const runningProcesses = processes.filter((p) => p.isResponding).length;
    const notResponding = totalProcesses - runningProcesses;
    const totalMemory = processes.reduce((sum, p) => sum + p.workingSetMemory, 0);
    const totalThreads = processes.reduce((sum, p) => sum + p.threadCount, 0);
    const totalCpu = processes.reduce((sum, p) => sum + (p.cpu || 0), 0);

    return {
      totalProcesses,
      runningProcesses,
      notResponding,
      totalMemory,
      totalThreads,
      totalCpu,
    };
  }, [processes]);

  const handleKillProcess = async (proc: SystemProcessInfo) => {
    setConfirmKill(proc);
  };

  const confirmKillProcess = async () => {
    if (!confirmKill) return;
    setKillingPid(confirmKill.processId);
    try {
      await metricsService.killProcess(confirmKill.processId);
      // Refresh the list after killing
      await fetchProcesses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to kill process ${confirmKill.processId}`
      );
    } finally {
      setKillingPid(null);
      setConfirmKill(null);
    }
  };

  if (isLoading && processes.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 bg-slate-800/50 border border-slate-700/50 rounded-lg"
              />
            ))}
          </div>
          <div className="h-10 bg-slate-700 rounded" />
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-8 bg-slate-700/50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Summary Stats */}
      <div className="flex-none px-6 pt-4 pb-2">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard
            label="Total Processes"
            value={stats.totalProcesses}
            icon={<span>📊</span>}
            color="text-cyan-400"
          />
          <StatCard
            label="Running"
            value={stats.runningProcesses}
            icon={<span>✅</span>}
            color="text-emerald-400"
          />
          <StatCard
            label="Not Responding"
            value={stats.notResponding}
            icon={<FaExclamationTriangle />}
            color="text-rose-400"
          />
          <StatCard
            label="Total Memory"
            value={formatBytes(stats.totalMemory)}
            icon={<span>💾</span>}
            color="text-violet-400"
          />
          <StatCard
            label="Total Threads"
            value={stats.totalThreads.toLocaleString()}
            icon={<span>🧵</span>}
            color="text-amber-400"
          />
          <StatCard
            label="Total CPU"
            value={`${stats.totalCpu.toFixed(1)}%`}
            icon={<span>⚡</span>}
            color="text-blue-400"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-none px-6 py-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
          <input
            type="text"
            placeholder="Search by name or PID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="appearance-none pl-3 pr-8 py-2 text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="not-responding">Not Responding</option>
          </select>
          <FaFilter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] pointer-events-none" />
        </div>

        {/* Auto-refresh toggle */}
        <button
          onClick={() => setIsAutoRefresh(!isAutoRefresh)}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all ${
            isAutoRefresh
              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
              : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200"
          }`}
          title={isAutoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
        >
          <FaSync className={isAutoRefresh ? "animate-spin" : ""} />
          <span className="hidden sm:inline">
            {isAutoRefresh ? "Live" : "Paused"}
          </span>
        </button>

        {/* Manual refresh */}
        <button
          onClick={fetchProcesses}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all disabled:opacity-50"
          title="Refresh now"
        >
          <FaSync className={isLoading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {/* Last updated */}
        {lastUpdated && (
          <span className="text-xs text-slate-500">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex-none mx-6 mb-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400 flex items-center gap-2">
          <FaExclamationTriangle />
          <span>{error}</span>
          <button
            onClick={fetchProcesses}
            className="ml-auto text-xs text-rose-300 hover:text-rose-200 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Process Table */}
      <div className="flex-1 min-h-0 overflow-auto px-6 pb-4">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-800/95 backdrop-blur-sm z-10">
              <tr className="border-b border-slate-700/50">
                <SortHeader
                  label="Name"
                  column="name"
                  currentSort={sortBy}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="min-w-[180px]"
                />
                <SortHeader
                  label="PID"
                  column="pid"
                  currentSort={sortBy}
                  currentDir={sortDir}
                  onSort={handleSort}
                  align="right"
                  className="w-20"
                />
                <SortHeader
                  label="CPU %"
                  column="cpu"
                  currentSort={sortBy}
                  currentDir={sortDir}
                  onSort={handleSort}
                  align="right"
                  className="w-20"
                />
                <SortHeader
                  label="Memory"
                  column="memory"
                  currentSort={sortBy}
                  currentDir={sortDir}
                  onSort={handleSort}
                  align="right"
                  className="w-28"
                />
                <SortHeader
                  label="Threads"
                  column="threads"
                  currentSort={sortBy}
                  currentDir={sortDir}
                  onSort={handleSort}
                  align="right"
                  className="w-20"
                />
                <SortHeader
                  label="Status"
                  column="status"
                  currentSort={sortBy}
                  currentDir={sortDir}
                  onSort={handleSort}
                  align="center"
                  className="w-32"
                />
                <SortHeader
                  label="Start Time"
                  column="startTime"
                  currentSort={sortBy}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="w-28"
                />
                <th className="px-3 py-2.5 text-xs font-medium text-slate-400 text-center w-16">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedProcesses.map((proc) => {
                const isSelected = selectedPid === proc.processId;
                return (
                  <tr
                    key={proc.processId}
                    className={`border-b border-slate-700/30 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-cyan-500/10"
                        : "hover:bg-slate-700/20"
                    }`}
                    onClick={() =>
                      setSelectedPid(
                        isSelected ? null : proc.processId
                      )
                    }
                  >
                    <td className="px-3 py-2 text-sm text-slate-200 font-mono truncate max-w-[200px]">
                      {proc.processName}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-400 text-right font-mono">
                      {proc.processId}
                    </td>
                    <td
                      className={`px-3 py-2 text-sm text-right font-mono ${getCpuColor(proc.cpu || 0)}`}
                    >
                      {(proc.cpu || 0).toFixed(1)}%
                    </td>
                    <td
                      className={`px-3 py-2 text-sm text-right font-mono ${getMemoryColor(proc.memMb || 0)}`}
                    >
                      {formatBytes(proc.workingSetMemory)}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-400 text-right">
                      {proc.threadCount}
                    </td>
                    <td className="px-3 py-2 text-sm text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${getStatusBadgeClasses(proc.isResponding)}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{getStatusLabel(proc.isResponding)}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {formatStartTime(proc.startTime)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleKillProcess(proc);
                        }}
                        disabled={killingPid === proc.processId}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-50"
                        title={`Kill process ${proc.processId}`}
                      >
                        <FaTrash className="text-xs" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sortedProcesses.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-slate-500">
              <FaSearch className="text-2xl mb-2" />
              <p className="text-sm">No processes match your filters</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="mt-2 text-xs text-slate-500 text-right">
          Showing {sortedProcesses.length} of {processes.length} processes
        </div>
      </div>

      {/* Kill Confirmation Dialog */}
      {confirmKill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                <FaTrash className="text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Kill Process</h3>
                <p className="text-sm text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            <div className="mb-4 p-3 bg-slate-900/50 rounded-lg">
              <div className="text-sm text-slate-300">
                <span className="font-mono font-semibold">{confirmKill.processName}</span>
                <span className="text-slate-500 ml-2">(PID: {confirmKill.processId})</span>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Are you sure you want to terminate this process? Any unsaved data will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmKill(null)}
                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmKillProcess}
                disabled={killingPid !== null}
                className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {killingPid !== null ? "Killing..." : "Kill Process"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
