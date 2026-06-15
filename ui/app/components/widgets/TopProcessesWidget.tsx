import React, { useState, useEffect, useCallback } from "react";
import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import { metricsService, type SystemProcessInfo } from "~/services/metricsService";
import { useCockpitContext } from "~/context/CockpitContext";
import { formatBytes } from "~/services/metricsService";

// ============================================================================
// Types
// ============================================================================

type SortColumn = 'name' | 'pid' | 'memory' | 'threads' | 'status';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// Constants
// ============================================================================

const LIMIT = 10;

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusColor(isResponding: boolean): string {
  return isResponding ? 'text-emerald-400' : 'text-rose-400';
}

function getStatusLabel(isResponding: boolean): string {
  return isResponding ? 'Running' : 'Not Responding';
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
  align?: 'left' | 'right' | 'center';
}

const SortHeader: React.FC<SortHeaderProps> = ({
  label,
  column,
  currentSort,
  currentDir,
  onSort,
  align = 'left',
}) => {
  const isActive = currentSort === column;

  return (
    <th
      className={`px-3 py-2 text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none text-${align}`}
      onClick={() => onSort(column)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        <span>{label}</span>
        <span className="text-[10px]">
          {isActive ? (
            currentDir === 'asc' ? <FaSortUp /> : <FaSortDown />
          ) : (
            <FaSort className="opacity-30" />
          )}
        </span>
      </div>
    </th>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const TopProcessesWidget: React.FC = () => {
  const { refreshRate, isLive } = useCockpitContext();

  const [processes, setProcesses] = useState<SystemProcessInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortColumn>('memory');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const fetchProcesses = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await metricsService.getSystemProcesses(sortBy, LIMIT);
      setProcesses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch processes');
    } finally {
      setIsLoading(false);
    }
  }, [sortBy]);

  // Initial fetch
  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  // Polling based on refresh rate and live mode
  useEffect(() => {
    if (!isLive || refreshRate === 0) return;

    const intervalId = setInterval(fetchProcesses, refreshRate);
    return () => clearInterval(intervalId);
  }, [refreshRate, isLive, fetchProcesses]);

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  // Sort processes client-side (API may not support all sort options)
  const sortedProcesses = [...processes].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.processName.localeCompare(b.processName);
        break;
      case 'pid':
        comparison = a.processId - b.processId;
        break;
      case 'memory':
        comparison = a.workingSetMemory - b.workingSetMemory;
        break;
      case 'threads':
        comparison = a.threadCount - b.threadCount;
        break;
      case 'status':
        comparison = (a.isResponding ? 1 : 0) - (b.isResponding ? 1 : 0);
        break;
    }

    return sortDir === 'asc' ? comparison : -comparison;
  });

  if (isLoading && processes.length === 0) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-8 bg-slate-700 rounded" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-6 bg-slate-700/50 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <p className="text-sm text-rose-400">{error}</p>
        <button
          onClick={fetchProcesses}
          className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700/50">
            <SortHeader
              label="Name"
              column="name"
              currentSort={sortBy}
              currentDir={sortDir}
              onSort={handleSort}
            />
            <SortHeader
              label="PID"
              column="pid"
              currentSort={sortBy}
              currentDir={sortDir}
              onSort={handleSort}
              align="right"
            />
            <SortHeader
              label="Memory"
              column="memory"
              currentSort={sortBy}
              currentDir={sortDir}
              onSort={handleSort}
              align="right"
            />
            <SortHeader
              label="Threads"
              column="threads"
              currentSort={sortBy}
              currentDir={sortDir}
              onSort={handleSort}
              align="right"
            />
            <SortHeader
              label="Status"
              column="status"
              currentSort={sortBy}
              currentDir={sortDir}
              onSort={handleSort}
              align="center"
            />
          </tr>
        </thead>
        <tbody>
          {sortedProcesses.map((proc) => (
            <tr
              key={proc.processId}
              className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
            >
              <td className="px-3 py-2 text-sm text-slate-200 font-mono truncate max-w-[150px]">
                {proc.processName}
              </td>
              <td className="px-3 py-2 text-sm text-slate-400 text-right font-mono">
                {proc.processId}
              </td>
              <td className="px-3 py-2 text-sm text-slate-300 text-right font-mono">
                {formatBytes(proc.workingSetMemory)}
              </td>
              <td className="px-3 py-2 text-sm text-slate-400 text-right">
                {proc.threadCount}
              </td>
              <td className="px-3 py-2 text-sm text-center">
                <span className={`inline-flex items-center gap-1 ${getStatusColor(proc.isResponding)}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span className="text-xs">{getStatusLabel(proc.isResponding)}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sortedProcesses.length === 0 && (
        <div className="flex items-center justify-center h-20 text-slate-500 text-sm">
          No processes available
        </div>
      )}
    </div>
  );
};
