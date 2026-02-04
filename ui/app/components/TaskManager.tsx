import { useState, useEffect, useCallback } from "react";
import { useSignalRConnection } from "../context/SignalRConnectionContext";
import type {
  ProcessMetricsSnapshot,
  SystemMetricsSnapshot,
  SystemProcessInfo,
} from "../services/metricsService";
import {
  metricsService,
  formatBytes,
  formatBytesPerSecond,
  formatDuration,
  formatPercent,
} from "../services/metricsService";

type SortField =
  | "serviceName"
  | "cpuUsagePercent"
  | "workingSetMemory"
  | "diskReadRate"
  | "diskWriteRate"
  | "threadCount"
  | "status";

type SystemSortField = "processName" | "workingSetMemory" | "threadCount" | "processId";

type ProcessView = "my-processes" | "all-processes";

interface TaskManagerProps {
  onSelectService?: (serviceId: string) => void;
}

export function TaskManager({ onSelectService }: TaskManagerProps) {
  const [processMetrics, setProcessMetrics] = useState<ProcessMetricsSnapshot[]>([]);
  const [systemProcesses, setSystemProcesses] = useState<SystemProcessInfo[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetricsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("cpuUsagePercent");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [systemSortField, setSystemSortField] = useState<SystemSortField>("workingSetMemory");
  const [systemSortDirection, setSystemSortDirection] = useState<"asc" | "desc">("desc");
  const [activeTab, setActiveTab] = useState<"processes" | "performance" | "disks" | "network">("processes");
  const [processView, setProcessView] = useState<ProcessView>("my-processes");

  // Use a shared connection for metrics
  const connection = useSignalRConnection();

  const fetchData = useCallback(async () => {
    try {
      const [metricsMap, system] = await Promise.all([
        metricsService.getLiveMetrics(),
        metricsService.getSystemMetrics(),
      ]);
      setProcessMetrics(Object.values(metricsMap));
      setSystemMetrics(system);
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSystemProcesses = useCallback(async () => {
    try {
      const processes = await metricsService.getSystemProcesses("memory", 100);
      setSystemProcesses(processes);
    } catch (err) {
      console.error("Failed to fetch system processes:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch system processes when viewing "all-processes"
  useEffect(() => {
    if (processView === "all-processes") {
      fetchSystemProcesses();
      const interval = setInterval(fetchSystemProcesses, 5000);
      return () => clearInterval(interval);
    }
  }, [processView, fetchSystemProcesses]);

  useEffect(() => {
    if (!connection) return;

    connection.invoke("JoinAllMetrics").catch(console.error);
    connection.invoke("JoinSystemMetrics").catch(console.error);

    const handleAllMetrics = (metrics: ProcessMetricsSnapshot[]) => {
      setProcessMetrics(metrics);
    };

    const handleSystemMetrics = (metrics: SystemMetricsSnapshot) => {
      setSystemMetrics(metrics);
    };

    connection.on("AllProcessMetrics", handleAllMetrics);
    connection.on("SystemMetrics", handleSystemMetrics);

    return () => {
      connection.off("AllProcessMetrics", handleAllMetrics);
      connection.off("SystemMetrics", handleSystemMetrics);
      connection.invoke("LeaveAllMetrics").catch(console.error);
      connection.invoke("LeaveSystemMetrics").catch(console.error);
    };
  }, [connection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleSystemSort = (field: SystemSortField) => {
    if (systemSortField === field) {
      setSystemSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSystemSortField(field);
      setSystemSortDirection("desc");
    }
  };

  const sortedMetrics = [...processMetrics].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "serviceName":
        cmp = (a.serviceName || "").localeCompare(b.serviceName || "");
        break;
      case "cpuUsagePercent":
        cmp = a.cpuUsagePercent - b.cpuUsagePercent;
        break;
      case "workingSetMemory":
        cmp = a.workingSetMemory - b.workingSetMemory;
        break;
      case "diskReadRate":
        cmp = a.diskReadRate - b.diskReadRate;
        break;
      case "diskWriteRate":
        cmp = a.diskWriteRate - b.diskWriteRate;
        break;
      case "threadCount":
        cmp = a.threadCount - b.threadCount;
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
    }
    return sortDirection === "asc" ? cmp : -cmp;
  });

  const sortedSystemProcesses = [...systemProcesses].sort((a, b) => {
    let cmp = 0;
    switch (systemSortField) {
      case "processName":
        cmp = a.processName.localeCompare(b.processName);
        break;
      case "workingSetMemory":
        cmp = a.workingSetMemory - b.workingSetMemory;
        break;
      case "threadCount":
        cmp = a.threadCount - b.threadCount;
        break;
      case "processId":
        cmp = a.processId - b.processId;
        break;
    }
    return systemSortDirection === "asc" ? cmp : -cmp;
  });

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-xs">{sortDirection === "asc" ? "▲" : "▼"}</span>
        )}
      </div>
    </th>
  );

  const SystemSortHeader = ({ field, label }: { field: SystemSortField; label: string }) => (
    <th
      className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
      onClick={() => handleSystemSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {systemSortField === field && (
          <span className="text-xs">{systemSortDirection === "asc" ? "▲" : "▼"}</span>
        )}
      </div>
    </th>
  );

  if (loading && !systemMetrics) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Loading metrics...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* System Overview Bar */}
      {systemMetrics && (
        <div className="bg-gray-100 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">{systemMetrics.machineName}</h2>
            <span className="text-sm text-gray-500">{systemMetrics.osDescription}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* CPU */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 shadow-sm">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">CPU</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatPercent(systemMetrics.cpuUsagePercent)}
              </div>
              <div className="text-xs text-gray-400">{systemMetrics.processorCount} cores</div>
              <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded">
                <div
                  className="h-full bg-blue-500 rounded transition-all"
                  style={{ width: `${Math.min(100, systemMetrics.cpuUsagePercent)}%` }}
                ></div>
              </div>
            </div>

            {/* Memory */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 shadow-sm">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Memory</div>
              <div className="text-2xl font-bold text-purple-600">
                {formatPercent(systemMetrics.memoryUsagePercent)}
              </div>
              <div className="text-xs text-gray-400">
                {formatBytes(systemMetrics.usedPhysicalMemory)} / {formatBytes(systemMetrics.totalPhysicalMemory)}
              </div>
              <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded">
                <div
                  className="h-full bg-purple-500 rounded transition-all"
                  style={{ width: `${Math.min(100, systemMetrics.memoryUsagePercent)}%` }}
                ></div>
              </div>
            </div>

            {/* Disk */}
            {systemMetrics.disks[0] && (
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 shadow-sm">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Disk ({systemMetrics.disks[0].name})
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatPercent(systemMetrics.disks[0].usagePercent)}
                </div>
                <div className="text-xs text-gray-400">
                  {formatBytes(systemMetrics.disks[0].usedSpace)} / {formatBytes(systemMetrics.disks[0].totalSize)}
                </div>
                <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded">
                  <div
                    className="h-full bg-green-500 rounded transition-all"
                    style={{ width: `${Math.min(100, systemMetrics.disks[0].usagePercent)}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Network */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 shadow-sm">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Network</div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-cyan-600">↑</span>
                <span className="text-sm">{formatBytesPerSecond(systemMetrics.totalNetworkSendRate)}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-orange-600">↓</span>
                <span className="text-sm">{formatBytesPerSecond(systemMetrics.totalNetworkReceiveRate)}</span>
              </div>
            </div>

            {/* Processes */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 shadow-sm">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Processes</div>
              <div className="text-2xl font-bold text-amber-600">{systemMetrics.totalProcesses}</div>
              <div className="text-xs text-gray-400">{systemMetrics.totalThreads} threads</div>
            </div>

            {/* Uptime */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 shadow-sm">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Uptime</div>
              <div className="text-lg font-bold text-gray-600 dark:text-gray-300">
                {formatDuration(systemMetrics.systemUptime)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4 px-4">
          {(["processes", "performance", "disks", "network"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "processes" && (
          <div className="p-4">
            {/* Process View Toggle */}
            <div className="mb-4 flex items-center gap-2">
              <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
                <button
                  onClick={() => setProcessView("my-processes")}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    processView === "my-processes"
                      ? "bg-white dark:bg-gray-700 text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  My Processes ({processMetrics.length})
                </button>
                <button
                  onClick={() => setProcessView("all-processes")}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    processView === "all-processes"
                      ? "bg-white dark:bg-gray-700 text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  All System Processes ({systemProcesses.length || systemMetrics?.totalProcesses || 0})
                </button>
              </div>
            </div>

            {/* My Processes Table */}
            {processView === "my-processes" && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <SortHeader field="serviceName" label="Name" />
                    <th className="px-4 py-2 text-left">PID</th>
                    <SortHeader field="status" label="Status" />
                    <SortHeader field="cpuUsagePercent" label="CPU" />
                    <SortHeader field="workingSetMemory" label="Memory" />
                    <SortHeader field="diskReadRate" label="Disk Read" />
                    <SortHeader field="diskWriteRate" label="Disk Write" />
                    <SortHeader field="threadCount" label="Threads" />
                    <th className="px-4 py-2 text-left">Uptime</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        No running applications
                      </td>
                    </tr>
                  ) : (
                    sortedMetrics.map((m) => (
                      <tr
                        key={m.serviceId}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => onSelectService?.(m.serviceId)}
                      >
                        <td className="px-4 py-2 font-medium">{m.serviceName || m.serviceId.slice(0, 8)}</td>
                        <td className="px-4 py-2 text-gray-500">{m.processId ?? "-"}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              m.status === "Running" && m.isResponding
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            }`}
                          >
                            {m.isResponding ? m.status : "Not Responding"}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded">
                              <div
                                className="h-full bg-blue-500 rounded"
                                style={{ width: `${Math.min(100, m.cpuUsagePercent)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs w-12">{formatPercent(m.cpuUsagePercent)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{formatBytes(m.workingSetMemory)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">
                          {formatBytesPerSecond(m.diskReadRate)}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">
                          {formatBytesPerSecond(m.diskWriteRate)}
                        </td>
                        <td className="px-4 py-2">{m.threadCount}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{formatDuration(m.uptime)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* All System Processes Table */}
            {processView === "all-processes" && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <SystemSortHeader field="processName" label="Name" />
                    <SystemSortHeader field="processId" label="PID" />
                    <th className="px-4 py-2 text-left">Status</th>
                    <SystemSortHeader field="workingSetMemory" label="Memory" />
                    <SystemSortHeader field="threadCount" label="Threads" />
                    <th className="px-4 py-2 text-left">Start Time</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSystemProcesses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Loading system processes...
                      </td>
                    </tr>
                  ) : (
                    sortedSystemProcesses.map((p) => (
                      <tr
                        key={p.processId}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-4 py-2 font-medium">{p.processName}</td>
                        <td className="px-4 py-2 text-gray-500">{p.processId}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              p.isResponding
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            }`}
                          >
                            {p.isResponding ? "Running" : "Not Responding"}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-xs">{formatBytes(p.workingSetMemory)}</span>
                        </td>
                        <td className="px-4 py-2">{p.threadCount}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">
                          {p.startTime ? new Date(p.startTime).toLocaleTimeString() : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "performance" && systemMetrics && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CPU Details */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">CPU</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Usage</span>
                  <span className="font-medium">{formatPercent(systemMetrics.cpuUsagePercent)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Logical Processors</span>
                  <span className="font-medium">{systemMetrics.processorCount}</span>
                </div>
                {systemMetrics.processorName && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-400">{systemMetrics.processorName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Memory Details */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Memory</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">In Use</span>
                  <span className="font-medium">{formatBytes(systemMetrics.usedPhysicalMemory)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Available</span>
                  <span className="font-medium">{formatBytes(systemMetrics.availablePhysicalMemory)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <span className="font-medium">{formatBytes(systemMetrics.totalPhysicalMemory)}</span>
                </div>
                <div className="mt-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded">
                    <div
                      className="h-full bg-purple-500 rounded transition-all"
                      style={{ width: `${systemMetrics.memoryUsagePercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "disks" && systemMetrics && (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemMetrics.disks.map((disk, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold">{disk.name}</h3>
                      <p className="text-xs text-gray-500">{disk.driveType} - {disk.fileSystem}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Used</span>
                      <span>{formatBytes(disk.usedSpace)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Free</span>
                      <span>{formatBytes(disk.availableSpace)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total</span>
                      <span>{formatBytes(disk.totalSize)}</span>
                    </div>
                    <div className="mt-3">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded">
                        <div
                          className={`h-full rounded transition-all ${
                            disk.usagePercent > 90
                              ? "bg-red-500"
                              : disk.usagePercent > 70
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${disk.usagePercent}%` }}
                        ></div>
                      </div>
                      <div className="text-right text-xs text-gray-500 mt-1">
                        {formatPercent(disk.usagePercent)} used
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "network" && systemMetrics && (
          <div className="p-4">
            <div className="space-y-4">
              {systemMetrics.networkInterfaces.map((nic, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold">{nic.name}</h3>
                        <p className="text-xs text-gray-500">{nic.description}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        nic.status === "Up"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {nic.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-gray-500">Send Rate</div>
                      <div className="font-medium text-cyan-600">{formatBytesPerSecond(nic.sendRate)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Receive Rate</div>
                      <div className="font-medium text-orange-600">{formatBytesPerSecond(nic.receiveRate)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Total Sent</div>
                      <div className="font-medium">{formatBytes(nic.bytesSent)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Total Received</div>
                      <div className="font-medium">{formatBytes(nic.bytesReceived)}</div>
                    </div>
                  </div>
                  {nic.speed > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      Link Speed: {(nic.speed / 1_000_000).toFixed(0)} Mbps
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
