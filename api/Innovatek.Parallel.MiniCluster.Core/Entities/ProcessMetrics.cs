using System;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    /// <summary>
    /// Raw process metrics collected at regular intervals
    /// </summary>
    public class ProcessMetrics
    {
        public long Id { get; set; }
        public Guid ServiceId { get; set; }
        public Guid? SessionId { get; set; }
        
        // Timestamp rounded to collection interval (no fractions)
        public DateTime Timestamp { get; set; }
        
        // Memory metrics (in bytes)
        public long WorkingSetMemory { get; set; }
        public long PrivateMemory { get; set; }
        public long VirtualMemory { get; set; }
        public long PeakWorkingSetMemory { get; set; }
        
        // CPU metrics
        public double CpuUsagePercent { get; set; }
        public TimeSpan TotalProcessorTime { get; set; }
        public TimeSpan UserProcessorTime { get; set; }
        
        // Thread and handle counts
        public int ThreadCount { get; set; }
        public int HandleCount { get; set; }
        
        // Network metrics (bytes sent/received since process start)
        public long NetworkBytesSent { get; set; }
        public long NetworkBytesReceived { get; set; }
        
        // Network rate (bytes per second) - calculated delta
        public long NetworkSendRate { get; set; }
        public long NetworkReceiveRate { get; set; }
        
        // Disk I/O metrics (bytes read/written since process start)
        public long DiskBytesRead { get; set; }
        public long DiskBytesWritten { get; set; }
        
        // Disk I/O rate (bytes per second) - calculated delta
        public long DiskReadRate { get; set; }
        public long DiskWriteRate { get; set; }
        
        // Disk I/O operation counts
        public long DiskReadOperations { get; set; }
        public long DiskWriteOperations { get; set; }
        
        // GPU usage (if available, 0-100%)
        public double GpuUsagePercent { get; set; }
        
        // Process status
        public bool IsResponding { get; set; } = true;
        public int? ProcessId { get; set; }
        
        // Process priority
        public string? Priority { get; set; }
    }

    /// <summary>
    /// Aggregated metrics (averages) at configurable intervals
    /// </summary>
    public class ProcessMetricsAggregated
    {
        public long Id { get; set; }
        public Guid ServiceId { get; set; }
        
        // Timestamp rounded to aggregation interval (e.g., minute boundary)
        public DateTime Timestamp { get; set; }
        
        // Aggregation interval in seconds (1, 5, 10, 20, 30, 60, 300, etc.)
        public int IntervalSeconds { get; set; }
        
        // Number of samples aggregated
        public int SampleCount { get; set; }
        
        // Memory metrics (averages in bytes)
        public long AvgWorkingSetMemory { get; set; }
        public long MaxWorkingSetMemory { get; set; }
        public long MinWorkingSetMemory { get; set; }
        
        public long AvgPrivateMemory { get; set; }
        public long MaxPrivateMemory { get; set; }
        
        // CPU metrics
        public double AvgCpuUsagePercent { get; set; }
        public double MaxCpuUsagePercent { get; set; }
        public double MinCpuUsagePercent { get; set; }
        
        // Thread counts
        public double AvgThreadCount { get; set; }
        public int MaxThreadCount { get; set; }
        
        // Handle counts  
        public double AvgHandleCount { get; set; }
        public int MaxHandleCount { get; set; }
        
        // Network metrics (totals for the interval)
        public long TotalNetworkBytesSent { get; set; }
        public long TotalNetworkBytesReceived { get; set; }
        
        // Disk I/O metrics (totals for the interval)
        public long TotalDiskBytesRead { get; set; }
        public long TotalDiskBytesWritten { get; set; }
    }

    /// <summary>
    /// System-wide metrics snapshot
    /// </summary>
    public class SystemMetrics
    {
        public long Id { get; set; }
        public DateTime Timestamp { get; set; }
        
        // CPU
        public double CpuUsagePercent { get; set; }
        public int ProcessorCount { get; set; }
        
        // Memory
        public long TotalPhysicalMemory { get; set; }
        public long AvailablePhysicalMemory { get; set; }
        public long UsedPhysicalMemory { get; set; }
        public double MemoryUsagePercent { get; set; }
        
        // Disk
        public long TotalDiskSpace { get; set; }
        public long AvailableDiskSpace { get; set; }
        public long UsedDiskSpace { get; set; }
        public double DiskUsagePercent { get; set; }
        
        // Network (system-wide)
        public long NetworkBytesSent { get; set; }
        public long NetworkBytesReceived { get; set; }
        public long NetworkSendRate { get; set; }
        public long NetworkReceiveRate { get; set; }
        
        // Process counts
        public int TotalProcesses { get; set; }
        public int TotalThreads { get; set; }
        
        // Uptime
        public TimeSpan SystemUptime { get; set; }
    }
}
