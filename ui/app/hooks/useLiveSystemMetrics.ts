import { useState, useEffect, useCallback, useRef } from "react";
import { useSignalRConnection, useSignalRConnected } from "~/context/SignalRConnectionContext";
import { metricsService, type SystemMetricsSnapshot } from "~/services/metricsService";

const MAX_HISTORY_POINTS = 60;

export interface LiveSystemMetrics {
  current: SystemMetricsSnapshot | null;
  cpuHistory: number[];
  memoryHistory: number[];
  diskHistory: number[];
  networkSendHistory: number[];
  networkReceiveHistory: number[];
  timestamps: string[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook that uses SignalR for real-time system metrics updates.
 * This provides truly live charts that update as soon as new data arrives from the server.
 */
export function useLiveSystemMetrics(): LiveSystemMetrics {
  const connection = useSignalRConnection();
  const isConnected = useSignalRConnected();

  const [current, setCurrent] = useState<SystemMetricsSnapshot | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [diskHistory, setDiskHistory] = useState<number[]>([]);
  const [networkSendHistory, setNetworkSendHistory] = useState<number[]>([]);
  const [networkReceiveHistory, setNetworkReceiveHistory] = useState<number[]>([]);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  // Load initial historical data via REST API
  const loadHistoricalData = useCallback(async () => {
    try {
      const from = new Date(Date.now() - 6 * 60 * 1000); // Last 6 minutes
      const historyData = await metricsService.getSystemMetricsHistory(from, new Date(), MAX_HISTORY_POINTS);

      if (!mountedRef.current) return;

      if (Array.isArray(historyData) && historyData.length > 0) {
        setCpuHistory(historyData.map(d => d.cpuUsagePercent));
        setMemoryHistory(historyData.map(d => d.memoryUsagePercent));
        setDiskHistory(historyData.map(d => d.diskUsagePercent));
        setNetworkSendHistory(historyData.map(d => d.networkSendRate / (1024 * 1024)));
        setNetworkReceiveHistory(historyData.map(d => d.networkReceiveRate / (1024 * 1024)));
        setTimestamps(historyData.map(d => d.timestamp));
      }

      initializedRef.current = true;
    } catch (err) {
      console.warn("Failed to load historical metrics, starting fresh:", err);
      initializedRef.current = true;
    }
  }, []);

  // Add value to history array, maintaining max length
  const addToHistory = useCallback((arr: number[], value: number): number[] => {
    const next = [...arr, value];
    return next.length > MAX_HISTORY_POINTS ? next.slice(-MAX_HISTORY_POINTS) : next;
  }, []);

  const addTimestamp = useCallback((arr: string[], value: string): string[] => {
    const next = [...arr, value];
    return next.length > MAX_HISTORY_POINTS ? next.slice(-MAX_HISTORY_POINTS) : next;
  }, []);

  // Subscribe to SignalR SystemMetrics events
  useEffect(() => {
    mountedRef.current = true;

    // Load historical data first
    loadHistoricalData().then(() => {
      if (!mountedRef.current) return;
      setIsLoading(false);
    });

    return () => {
      mountedRef.current = false;
    };
  }, [loadHistoricalData]);

  // SignalR subscription
  useEffect(() => {
    if (!connection || !isConnected) return;

    // Join system metrics group
    connection.invoke("JoinSystemMetrics").catch(console.error);

    const handleSystemMetrics = (metrics: SystemMetricsSnapshot) => {
      if (!mountedRef.current || !initializedRef.current) return;

      setCurrent(metrics);
      setError(null);

      // Update live chart history
      setCpuHistory(prev => addToHistory(prev, metrics.cpuUsagePercent));
      setMemoryHistory(prev => addToHistory(prev, metrics.memoryUsagePercent));

      const diskPercent = metrics.disks[0]?.usagePercent ?? 0;
      setDiskHistory(prev => addToHistory(prev, diskPercent));

      const netInMB = (metrics.totalNetworkReceiveRate || 0) / (1024 * 1024);
      const netOutMB = (metrics.totalNetworkSendRate || 0) / (1024 * 1024);
      setNetworkSendHistory(prev => addToHistory(prev, netOutMB));
      setNetworkReceiveHistory(prev => addToHistory(prev, netInMB));

      setTimestamps(prev => addTimestamp(prev, metrics.timestamp));
    };

    connection.on("SystemMetrics", handleSystemMetrics);

    return () => {
      connection.off("SystemMetrics", handleSystemMetrics);
      if (connection.state === "Connected") {
        connection.invoke("LeaveSystemMetrics").catch(console.error);
      }
    };
  }, [connection, isConnected, addToHistory, addTimestamp]);

  return {
    current,
    cpuHistory,
    memoryHistory,
    diskHistory,
    networkSendHistory,
    networkReceiveHistory,
    timestamps,
    isLoading,
    error,
  };
}
