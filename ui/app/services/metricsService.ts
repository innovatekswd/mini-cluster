import apiClient from "~/lib/apiClient";

export interface ProcessMetricsSnapshot {
  serviceId: string;
  serviceName?: string;
  timestamp: string;
  workingSetMemory: number;
  privateMemory: number;
  virtualMemory: number;
  peakWorkingSetMemory: number;
  cpuUsagePercent: number;
  threadCount: number;
  handleCount: number;
  networkBytesSent: number;
  networkBytesReceived: number;
  networkSendRate: number;
  networkReceiveRate: number;
  diskBytesRead: number;
  diskBytesWritten: number;
  diskReadRate: number;
  diskWriteRate: number;
  isResponding: boolean;
  processId: number | null;
  priority?: string;
  uptime: string;
  status: string;
}

export interface DiskInfo {
  name: string;
  driveType: string;
  fileSystem: string;
  totalSize: number;
  availableSpace: number;
  usedSpace: number;
  usagePercent: number;
}

export interface NetworkInterfaceInfo {
  name: string;
  description: string;
  bytesSent: number;
  bytesReceived: number;
  sendRate: number;
  receiveRate: number;
  status: string;
  speed: number;
}

export interface SystemMetricsSnapshot {
  timestamp: string;
  cpuUsagePercent: number;
  processorCount: number;
  processorName?: string;
  totalPhysicalMemory: number;
  availablePhysicalMemory: number;
  usedPhysicalMemory: number;
  memoryUsagePercent: number;
  disks: DiskInfo[];
  networkInterfaces: NetworkInterfaceInfo[];
  totalNetworkSendRate: number;
  totalNetworkReceiveRate: number;
  totalProcesses: number;
  totalThreads: number;
  systemUptime: string;
  osDescription: string;
  machineName: string;
}

export interface MetricsDataPoint {
  timestamp: string;
  workingSetMemory: number;
  privateMemory: number;
  cpuUsagePercent: number;
  threadCount: number;
  handleCount: number;
  isResponding: boolean;
  diskBytesRead: number;
  diskBytesWritten: number;
  diskReadRate: number;
  diskWriteRate: number;
}

export interface MetricsHistoryResponse {
  serviceId: string;
  from: string;
  to: string;
  dataPoints: MetricsDataPoint[];
  totalCount: number;
}

export interface AggregatedDataPoint {
  timestamp: string;
  sampleCount: number;
  avgWorkingSetMemory: number;
  maxWorkingSetMemory: number;
  minWorkingSetMemory: number;
  avgCpuUsagePercent: number;
  maxCpuUsagePercent: number;
  minCpuUsagePercent: number;
  avgThreadCount: number;
  maxThreadCount: number;
}

export interface AggregatedMetricsResponse {
  serviceId: string;
  intervalSeconds: number;
  from: string;
  to: string;
  dataPoints: AggregatedDataPoint[];
  totalCount: number;
}

export interface PeakDataPoint {
  timestamp: string;
  value: number;
  formattedValue: string;
}

export interface PeakMetricsResponse {
  serviceId: string;
  from: string;
  to: string;
  peakMemory: PeakDataPoint | null;
  peakCpu: PeakDataPoint | null;
  peakThreads: PeakDataPoint | null;
  averageMemory: number;
  averageCpu: number;
  totalSamples: number;
}

export interface ServiceMetricsSummary {
  serviceId: string;
  current: ProcessMetricsSnapshot | null;
  avgMemoryLastHour: number;
  avgCpuLastHour: number;
  peakMemoryLastHour: number;
  peakCpuLastHour: number;
  samplesLastHour: number;
}

export interface SystemProcessInfo {
  processId: number;
  processName: string;
  workingSetMemory: number;
  threadCount: number;
  startTime: string | null;
  isResponding: boolean;
  cpu?: number;
  memMb?: number;
  status?: string;
}

export interface SystemMetricsHistory {
  timestamp: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  totalPhysicalMemory: number;
  usedPhysicalMemory: number;
  networkBytesSent: number;
  networkBytesReceived: number;
  networkSendRate: number;
  networkReceiveRate: number;
  totalDiskSpace: number;
  usedDiskSpace: number;
  diskUsagePercent: number;
  totalProcesses: number;
  totalThreads: number;
}

export interface MetricCatalogEntry {
  name: string;
  unit: string;
  scopes: string[];
  hasSubEntities: boolean;
  subEntityLabel?: string;
  description: string;
}

export interface CatalogResponse {
  metrics: MetricCatalogEntry[];
}

export interface AggregatedDataPointNew {
  timestamp: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  p95?: number | null;
  sum?: number | null;
  last?: number | null;
}

export interface MetricSummary {
  min: number;
  max: number;
  avg: number;
  p95?: number | null;
  sum?: number | null;
}

export interface AggregatedMetricsResponseNew {
  scope: string;
  entityId: string;
  from: string;
  to: string;
  bucket: string;
  series: Record<string, AggregatedDataPointNew[]>;
  summary: Record<string, MetricSummary>;
}

export interface AggregatedMetricsParams {
  scope: string;
  entityId?: string;
  entityIds?: string[];
  from: string;
  to: string;
  bucket: string;
  metrics: string[];
  subEntity?: string;
}

export const metricsService = {
  async getLiveMetrics(): Promise<Record<string, ProcessMetricsSnapshot>> {
    const res = await apiClient.get("/api/metrics/live");
    return res.data;
  },

  async getSystemMetrics(): Promise<SystemMetricsSnapshot> {
    const res = await apiClient.get("/api/metrics/system");
    return res.data;
  },

  async getSystemMetricsHistory(
    from?: Date,
    to?: Date,
    limit?: number
  ): Promise<SystemMetricsHistory[]> {
    const params = new URLSearchParams();
    if (from) params.append("from", from.toISOString());
    if (to) params.append("to", to.toISOString());
    if (limit) params.append("limit", limit.toString());

    const res = await apiClient.get(`/api/metrics/system/history?${params.toString()}`);
    return res.data;
  },

  async getServiceLiveMetrics(serviceId: string): Promise<ProcessMetricsSnapshot> {
    const res = await apiClient.get(`/api/metrics/live/${serviceId}`);
    return res.data;
  },

  async getHistoricalMetrics(
    serviceId: string,
    from?: Date,
    to?: Date,
    limit?: number
  ): Promise<MetricsHistoryResponse> {
    const params = new URLSearchParams();
    if (from) params.append("from", from.toISOString());
    if (to) params.append("to", to.toISOString());
    if (limit) params.append("limit", limit.toString());

    const res = await apiClient.get(`/api/metrics/history/${serviceId}?${params.toString()}`);
    return res.data;
  },

  async getAggregatedMetrics(
    serviceId: string,
    intervalSeconds?: number,
    from?: Date,
    to?: Date,
    limit?: number
  ): Promise<AggregatedMetricsResponse> {
    const params = new URLSearchParams();
    if (intervalSeconds) params.append("intervalSeconds", intervalSeconds.toString());
    if (from) params.append("from", from.toISOString());
    if (to) params.append("to", to.toISOString());
    if (limit) params.append("limit", limit.toString());

    const res = await apiClient.get(`/api/metrics/aggregated/${serviceId}?${params.toString()}`);
    return res.data;
  },

  async getPeakMetrics(
    serviceId: string,
    from?: Date,
    to?: Date
  ): Promise<PeakMetricsResponse> {
    const params = new URLSearchParams();
    if (from) params.append("from", from.toISOString());
    if (to) params.append("to", to.toISOString());

    const res = await apiClient.get(`/api/metrics/peaks/${serviceId}?${params.toString()}`);
    return res.data;
  },

  async getAllServicesSummary(): Promise<ServiceMetricsSummary[]> {
    const res = await apiClient.get("/api/metrics/summary");
    return res.data;
  },

  async getSystemProcesses(sortBy?: string, limit?: number): Promise<SystemProcessInfo[]> {
    const params = new URLSearchParams();
    if (sortBy) params.append("sortBy", sortBy);
    if (limit) params.append("limit", limit.toString());
    const res = await apiClient.get(`/api/metrics/processes?${params.toString()}`);
    return res.data;
  },

  async killProcess(pid: number): Promise<{ status: string; pid: string }> {
    const res = await apiClient.delete(`/api/metrics/processes/${pid}`);
    return res.data;
  },

  async getMetricsCatalog(): Promise<CatalogResponse> {
    const res = await apiClient.get("/api/metrics/catalog");
    return res.data;
  },

  async getAggregatedMetricsNew(params: AggregatedMetricsParams): Promise<AggregatedMetricsResponseNew> {
    const searchParams = new URLSearchParams();
    searchParams.append("scope", params.scope);
    if (params.entityId) searchParams.append("entityId", params.entityId);
    if (params.entityIds && params.entityIds.length > 0) {
      searchParams.append("entityIds", params.entityIds.join(","));
    }
    searchParams.append("from", params.from);
    searchParams.append("to", params.to);
    searchParams.append("bucket", params.bucket);
    searchParams.append("metrics", params.metrics.join(","));
    if (params.subEntity) searchParams.append("subEntity", params.subEntity);

    const res = await apiClient.get(`/api/metrics/aggregated?${searchParams.toString()}`);
    return res.data;
  },
};

// Utility functions
export function formatBytes(bytes: number): string {
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export function formatBytesPerSecond(bytesPerSec: number): string {
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  if (bytesPerSec === 0) return "0 B/s";
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
  return `${(bytesPerSec / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export function formatDuration(durationStr: string): string {
  // Parse .NET TimeSpan format: "HH:MM:SS.fffffff" or "d.HH:MM:SS.fffffff"
  const parts = durationStr.split(":");
  if (parts.length < 3) return durationStr;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseFloat(parts[2]);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${Math.floor(seconds)}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${Math.floor(seconds)}s`;
  } else {
    return `${Math.floor(seconds)}s`;
  }
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
