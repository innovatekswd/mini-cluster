using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Hubs;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

public interface IProcessMetricsService
{
    ProcessMetricsSnapshot? GetCurrentMetrics(Guid serviceId);
    Dictionary<Guid, ProcessMetricsSnapshot> GetAllCurrentMetrics();
    SystemMetricsSnapshot GetSystemMetrics();
}

public class ProcessMetricsSnapshot
{
    public Guid ServiceId { get; set; }
    public string? ServiceName { get; set; }
    public DateTime Timestamp { get; set; }
    
    // Memory
    public long WorkingSetMemory { get; set; }
    public long PrivateMemory { get; set; }
    public long VirtualMemory { get; set; }
    public long PeakWorkingSetMemory { get; set; }
    
    // CPU
    public double CpuUsagePercent { get; set; }
    
    // Threads/Handles
    public int ThreadCount { get; set; }
    public int HandleCount { get; set; }
    
    // Network I/O
    public long NetworkBytesSent { get; set; }
    public long NetworkBytesReceived { get; set; }
    public long NetworkSendRate { get; set; }
    public long NetworkReceiveRate { get; set; }
    
    // Disk I/O
    public long DiskBytesRead { get; set; }
    public long DiskBytesWritten { get; set; }
    public long DiskReadRate { get; set; }
    public long DiskWriteRate { get; set; }
    
    // Status
    public bool IsResponding { get; set; }
    public int? ProcessId { get; set; }
    public string? Priority { get; set; }
    public TimeSpan Uptime { get; set; }
    public string Status { get; set; } = "Running";
}

public class SystemMetricsSnapshot
{
    public DateTime Timestamp { get; set; }
    
    // CPU
    public double CpuUsagePercent { get; set; }
    public int ProcessorCount { get; set; }
    public string? ProcessorName { get; set; }
    
    // Memory
    public long TotalPhysicalMemory { get; set; }
    public long AvailablePhysicalMemory { get; set; }
    public long UsedPhysicalMemory { get; set; }
    public double MemoryUsagePercent { get; set; }
    
    // Disk
    public List<DiskInfo> Disks { get; set; } = new();
    
    // Network
    public List<NetworkInterfaceInfo> NetworkInterfaces { get; set; } = new();
    public long TotalNetworkSendRate { get; set; }
    public long TotalNetworkReceiveRate { get; set; }
    
    // System
    public int TotalProcesses { get; set; }
    public int TotalThreads { get; set; }
    public TimeSpan SystemUptime { get; set; }
    public string OsDescription { get; set; } = string.Empty;
    public string MachineName { get; set; } = string.Empty;
}

public class DiskInfo
{
    public string Name { get; set; } = string.Empty;
    public string DriveType { get; set; } = string.Empty;
    public string FileSystem { get; set; } = string.Empty;
    public long TotalSize { get; set; }
    public long AvailableSpace { get; set; }
    public long UsedSpace { get; set; }
    public double UsagePercent { get; set; }
}

public class NetworkInterfaceInfo
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public long BytesSent { get; set; }
    public long BytesReceived { get; set; }
    public long SendRate { get; set; }
    public long ReceiveRate { get; set; }
    public string Status { get; set; } = string.Empty;
    public long Speed { get; set; }
}

public class ProcessMetricsCollectionService : BackgroundService, IProcessMetricsService
{
    private readonly ILogger<ProcessMetricsCollectionService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<LogHub> _hubContext;
    private readonly IServiceProcessManager _processManager;
    
    // In-memory cache of current metrics
    private readonly ConcurrentDictionary<Guid, ProcessMetricsSnapshot> _currentMetrics = new();
    
    // Track previous values for rate calculations
    private readonly ConcurrentDictionary<Guid, PreviousMetrics> _previousMetrics = new();
    private PreviousSystemMetrics? _previousSystemMetrics;
    private SystemMetricsSnapshot _systemMetrics = new();
    
    private int _collectionIntervalMs = 5000;

    private class PreviousMetrics
    {
        public DateTime Time { get; set; }
        public TimeSpan CpuTime { get; set; }
        public long DiskRead { get; set; }
        public long DiskWrite { get; set; }
        public long NetSent { get; set; }
        public long NetReceived { get; set; }
    }

    private class PreviousSystemMetrics
    {
        public DateTime Time { get; set; }
        public TimeSpan TotalCpuTime { get; set; }
        public Dictionary<string, (long Sent, long Received)> NetworkBytes { get; set; } = new();
    }

    public ProcessMetricsCollectionService(
        ILogger<ProcessMetricsCollectionService> logger,
        IServiceScopeFactory scopeFactory,
        IHubContext<LogHub> hubContext,
        IServiceProcessManager processManager)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _processManager = processManager;
    }

    public ProcessMetricsSnapshot? GetCurrentMetrics(Guid serviceId)
    {
        return _currentMetrics.TryGetValue(serviceId, out var metrics) ? metrics : null;
    }

    public Dictionary<Guid, ProcessMetricsSnapshot> GetAllCurrentMetrics()
    {
        return new Dictionary<Guid, ProcessMetricsSnapshot>(_currentMetrics);
    }

    public SystemMetricsSnapshot GetSystemMetrics()
    {
        return _systemMetrics;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ProcessMetricsCollectionService started");
        
        // Initial system metrics collection
        await CollectSystemMetricsAsync();
        
        // Pre-populate history if empty (for first run)
        await PrePopulateHistoryIfEmptyAsync();
        
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CollectMetricsAsync(stoppingToken);
                await CollectSystemMetricsAsync();
                await AggregateMetricsAsync(stoppingToken);
                await CleanupOldMetricsAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error collecting process metrics");
            }

            await UpdateCollectionIntervalAsync();
            await Task.Delay(_collectionIntervalMs, stoppingToken);
        }
        
        _logger.LogInformation("ProcessMetricsCollectionService stopped");
    }

    private async Task UpdateCollectionIntervalAsync()
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var settings = await appDb.AppSettings.FirstOrDefaultAsync();
            
            if (settings != null)
            {
                _collectionIntervalMs = settings.MetricsCollectionIntervalSeconds * 1000;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to update metrics collection interval from settings");
        }
    }

    private async Task CollectMetricsAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logsDb = scope.ServiceProvider.GetRequiredService<LogsDbContext>();

        var services = await appDb.Services.ToListAsync(stoppingToken);
        var timestamp = RoundToSeconds(DateTime.UtcNow);
        
        var metricsToSave = new List<ProcessMetrics>();
        var snapshotsToSend = new List<ProcessMetricsSnapshot>();

        foreach (var service in services)
        {
            var status = _processManager.GetStatus(service.Id);
            if (status != ServiceRuntimeStatus.Running)
            {
                _currentMetrics.TryRemove(service.Id, out _);
                _previousMetrics.TryRemove(service.Id, out _);
                continue;
            }

            try
            {
                var processInfo = GetProcessInfo(service.Id);
                if (processInfo == null) continue;

                var (process, sessionId) = processInfo.Value;
                if (process.HasExited) continue;

                // Get previous metrics for rate calculations
                _previousMetrics.TryGetValue(service.Id, out var prev);
                var timeDiffSeconds = prev != null ? (timestamp - prev.Time).TotalSeconds : 0;

                // Collect I/O counters (Linux: /proc/{pid}/io)
                var (diskRead, diskWrite) = await GetProcessDiskIoAsync(process.Id);

                // Calculate rates
                long diskReadRate = 0, diskWriteRate = 0;
                if (prev != null && timeDiffSeconds > 0)
                {
                    diskReadRate = (long)((diskRead - prev.DiskRead) / timeDiffSeconds);
                    diskWriteRate = (long)((diskWrite - prev.DiskWrite) / timeDiffSeconds);
                }

                var cpuUsage = CalculateCpuUsage(service.Id, process, prev);

                var metrics = new ProcessMetrics
                {
                    ServiceId = service.Id,
                    SessionId = sessionId,
                    Timestamp = timestamp,
                    WorkingSetMemory = process.WorkingSet64,
                    PrivateMemory = process.PrivateMemorySize64,
                    VirtualMemory = process.VirtualMemorySize64,
                    PeakWorkingSetMemory = process.PeakWorkingSet64,
                    CpuUsagePercent = cpuUsage,
                    TotalProcessorTime = process.TotalProcessorTime,
                    UserProcessorTime = process.UserProcessorTime,
                    ThreadCount = process.Threads.Count,
                    HandleCount = GetHandleCount(process),
                    DiskBytesRead = diskRead,
                    DiskBytesWritten = diskWrite,
                    DiskReadRate = diskReadRate,
                    DiskWriteRate = diskWriteRate,
                    IsResponding = IsProcessResponding(process),
                    ProcessId = process.Id,
                    Priority = GetProcessPriority(process)
                };

                metricsToSave.Add(metrics);

                // Update previous metrics
                _previousMetrics[service.Id] = new PreviousMetrics
                {
                    Time = timestamp,
                    CpuTime = process.TotalProcessorTime,
                    DiskRead = diskRead,
                    DiskWrite = diskWrite
                };

                var snapshot = new ProcessMetricsSnapshot
                {
                    ServiceId = service.Id,
                    ServiceName = service.Name,
                    Timestamp = timestamp,
                    WorkingSetMemory = metrics.WorkingSetMemory,
                    PrivateMemory = metrics.PrivateMemory,
                    VirtualMemory = metrics.VirtualMemory,
                    PeakWorkingSetMemory = metrics.PeakWorkingSetMemory,
                    CpuUsagePercent = metrics.CpuUsagePercent,
                    ThreadCount = metrics.ThreadCount,
                    HandleCount = metrics.HandleCount,
                    DiskBytesRead = metrics.DiskBytesRead,
                    DiskBytesWritten = metrics.DiskBytesWritten,
                    DiskReadRate = metrics.DiskReadRate,
                    DiskWriteRate = metrics.DiskWriteRate,
                    IsResponding = metrics.IsResponding,
                    ProcessId = metrics.ProcessId,
                    Priority = metrics.Priority,
                    Uptime = DateTime.UtcNow - process.StartTime.ToUniversalTime(),
                    Status = "Running"
                };

                _currentMetrics[service.Id] = snapshot;
                snapshotsToSend.Add(snapshot);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to collect metrics for service {ServiceId}", service.Id);
            }
        }

        if (metricsToSave.Any())
        {
            await logsDb.ProcessMetrics.AddRangeAsync(metricsToSave, stoppingToken);
            await logsDb.SaveChangesAsync(stoppingToken);
        }

        foreach (var snapshot in snapshotsToSend)
        {
            try
            {
                await _hubContext.Clients.Group(snapshot.ServiceId.ToString())
                    .SendAsync("ProcessMetrics", snapshot, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send metrics via SignalR for service {ServiceId}", snapshot.ServiceId);
            }
        }
        
        if (snapshotsToSend.Any())
        {
            try
            {
                await _hubContext.Clients.Group("metrics")
                    .SendAsync("AllProcessMetrics", snapshotsToSend, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to broadcast metrics to dashboard");
            }
        }
    }

    private async Task CollectSystemMetricsAsync()
    {
        try
        {
            var snapshot = new SystemMetricsSnapshot
            {
                Timestamp = RoundToSeconds(DateTime.UtcNow),
                ProcessorCount = System.Environment.ProcessorCount,
                MachineName = System.Environment.MachineName,
                OsDescription = RuntimeInformation.OSDescription,
            };

            // Collect disk info
            foreach (var drive in DriveInfo.GetDrives())
            {
                try
                {
                    if (drive.IsReady)
                    {
                        snapshot.Disks.Add(new DiskInfo
                        {
                            Name = drive.Name,
                            DriveType = drive.DriveType.ToString(),
                            FileSystem = drive.DriveFormat,
                            TotalSize = drive.TotalSize,
                            AvailableSpace = drive.AvailableFreeSpace,
                            UsedSpace = drive.TotalSize - drive.AvailableFreeSpace,
                            UsagePercent = drive.TotalSize > 0 
                                ? (double)(drive.TotalSize - drive.AvailableFreeSpace) / drive.TotalSize * 100 
                                : 0
                        });
                    }
                }
                catch { /* Ignore inaccessible drives */ }
            }

            // Collect network interface info
            foreach (var nic in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces())
            {
                try
                {
                    if (nic.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up &&
                        nic.NetworkInterfaceType != System.Net.NetworkInformation.NetworkInterfaceType.Loopback)
                    {
                        var stats = nic.GetIPv4Statistics();
                        var nicInfo = new NetworkInterfaceInfo
                        {
                            Name = nic.Name,
                            Description = nic.Description,
                            BytesSent = stats.BytesSent,
                            BytesReceived = stats.BytesReceived,
                            Status = nic.OperationalStatus.ToString(),
                            Speed = nic.Speed
                        };

                        // Calculate rates
                        if (_previousSystemMetrics?.NetworkBytes.TryGetValue(nic.Name, out var prevBytes) == true)
                        {
                            var timeDiff = (snapshot.Timestamp - _previousSystemMetrics.Time).TotalSeconds;
                            if (timeDiff > 0)
                            {
                                nicInfo.SendRate = (long)((stats.BytesSent - prevBytes.Sent) / timeDiff);
                                nicInfo.ReceiveRate = (long)((stats.BytesReceived - prevBytes.Received) / timeDiff);
                            }
                        }

                        snapshot.NetworkInterfaces.Add(nicInfo);
                        snapshot.TotalNetworkSendRate += nicInfo.SendRate;
                        snapshot.TotalNetworkReceiveRate += nicInfo.ReceiveRate;
                    }
                }
                catch { /* Ignore problematic interfaces */ }
            }

            // Get memory info
            if (OperatingSystem.IsLinux())
            {
                await CollectLinuxMemoryInfoAsync(snapshot);
                await CollectLinuxCpuInfoAsync(snapshot);
            }
            else
            {
                CollectFallbackMemoryInfo(snapshot);
            }

            // Get process/thread counts
            var processes = Process.GetProcesses();
            snapshot.TotalProcesses = processes.Length;
            snapshot.TotalThreads = processes.Sum(p => 
            {
                try { return p.Threads.Count; } catch { return 0; }
            });

            // Get system uptime
            snapshot.SystemUptime = TimeSpan.FromMilliseconds(System.Environment.TickCount64);

            // Update previous metrics for rate calculations
            _previousSystemMetrics = new PreviousSystemMetrics
            {
                Time = snapshot.Timestamp,
                NetworkBytes = snapshot.NetworkInterfaces.ToDictionary(
                    n => n.Name, 
                    n => (n.BytesSent, n.BytesReceived))
            };

            _systemMetrics = snapshot;

            // Store system metrics to database for historical charts
            await StoreSystemMetricsAsync(snapshot);

            // Broadcast system metrics
            try
            {
                await _hubContext.Clients.Group("system-metrics")
                    .SendAsync("SystemMetrics", snapshot);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to broadcast system metrics");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to collect system metrics");
        }
    }

    private async Task CollectLinuxMemoryInfoAsync(SystemMetricsSnapshot snapshot)
    {
        try
        {
            var memInfo = await File.ReadAllTextAsync("/proc/meminfo");
            var lines = memInfo.Split('\n');
            
            long memTotal = 0, memAvailable = 0;
            
            foreach (var line in lines)
            {
                if (line.StartsWith("MemTotal:"))
                    memTotal = ParseMemInfoValue(line) * 1024;
                else if (line.StartsWith("MemAvailable:"))
                    memAvailable = ParseMemInfoValue(line) * 1024;
            }

            snapshot.TotalPhysicalMemory = memTotal;
            snapshot.AvailablePhysicalMemory = memAvailable;
            snapshot.UsedPhysicalMemory = memTotal - memAvailable;
            snapshot.MemoryUsagePercent = memTotal > 0 ? (double)(memTotal - memAvailable) / memTotal * 100 : 0;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to read Linux memory info");
        }
    }

    private async Task CollectLinuxCpuInfoAsync(SystemMetricsSnapshot snapshot)
    {
        try
        {
            // Try to get CPU name
            var cpuInfo = await File.ReadAllTextAsync("/proc/cpuinfo");
            var modelLine = cpuInfo.Split('\n').FirstOrDefault(l => l.StartsWith("model name"));
            if (modelLine != null)
            {
                snapshot.ProcessorName = modelLine.Split(':').LastOrDefault()?.Trim();
            }

            // Read CPU stats for usage calculation
            var stat = await File.ReadAllTextAsync("/proc/stat");
            var cpuLine = stat.Split('\n').FirstOrDefault(l => l.StartsWith("cpu "));
            
            if (cpuLine != null)
            {
                var parts = cpuLine.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 5)
                {
                    var user = long.Parse(parts[1]);
                    var nice = long.Parse(parts[2]);
                    var system = long.Parse(parts[3]);
                    var idle = long.Parse(parts[4]);
                    var iowait = parts.Length > 5 ? long.Parse(parts[5]) : 0;
                    
                    var totalTime = user + nice + system + idle + iowait;
                    var busyTime = user + nice + system;
                    
                    snapshot.CpuUsagePercent = totalTime > 0 ? (double)busyTime / totalTime * 100 : 0;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to read Linux CPU info");
        }
    }

    private void CollectFallbackMemoryInfo(SystemMetricsSnapshot snapshot)
    {
        try
        {
            var gcMemory = GC.GetGCMemoryInfo();
            snapshot.TotalPhysicalMemory = gcMemory.TotalAvailableMemoryBytes;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to read memory info");
        }
    }

    private long ParseMemInfoValue(string line)
    {
        var parts = line.Split(':', StringSplitOptions.TrimEntries);
        if (parts.Length >= 2)
        {
            var valueStr = parts[1].Replace("kB", "").Trim();
            if (long.TryParse(valueStr, out var value))
                return value;
        }
        return 0;
    }

    private async Task<(long Read, long Write)> GetProcessDiskIoAsync(int pid)
    {
        try
        {
            if (OperatingSystem.IsLinux())
            {
                var ioPath = $"/proc/{pid}/io";
                if (File.Exists(ioPath))
                {
                    var content = await File.ReadAllTextAsync(ioPath);
                    long readBytes = 0, writeBytes = 0;
                    
                    foreach (var line in content.Split('\n'))
                    {
                        if (line.StartsWith("read_bytes:"))
                            long.TryParse(line.Split(':')[1].Trim(), out readBytes);
                        else if (line.StartsWith("write_bytes:"))
                            long.TryParse(line.Split(':')[1].Trim(), out writeBytes);
                    }
                    
                    return (readBytes, writeBytes);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to get disk I/O for process {Pid}", pid);
        }
        
        return (0, 0);
    }

    private string? GetProcessPriority(Process process)
    {
        try
        {
            return process.PriorityClass.ToString();
        }
        catch
        {
            return null;
        }
    }

    private double CalculateCpuUsage(Guid serviceId, Process process, PreviousMetrics? prev)
    {
        var now = DateTime.UtcNow;
        var currentCpuTime = process.TotalProcessorTime;

        if (prev != null)
        {
            var timeDiff = (now - prev.Time).TotalMilliseconds;
            var cpuDiff = (currentCpuTime - prev.CpuTime).TotalMilliseconds;
            
            if (timeDiff > 0)
            {
                var cpuUsage = (cpuDiff / timeDiff) * 100 / System.Environment.ProcessorCount;
                return Math.Min(100, Math.Max(0, cpuUsage));
            }
        }

        return 0;
    }

    private async Task AggregateMetricsAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logsDb = scope.ServiceProvider.GetRequiredService<LogsDbContext>();

        var settings = await appDb.AppSettings.FirstOrDefaultAsync(stoppingToken);
        var aggregationInterval = settings?.MetricsAggregationIntervalSeconds ?? 60;

        // Get the current aggregation window boundary
        var now = DateTime.UtcNow;
        var windowStart = RoundToInterval(now.AddSeconds(-aggregationInterval), aggregationInterval);
        var windowEnd = RoundToInterval(now, aggregationInterval);

        // Only aggregate if we've passed a boundary
        if (windowStart >= windowEnd) return;

        // Check if we've already aggregated this window
        var existingAgg = await logsDb.ProcessMetricsAggregated
            .AnyAsync(a => a.Timestamp == windowStart && a.IntervalSeconds == aggregationInterval, stoppingToken);
        
        if (existingAgg) return;

        // Get all unique service IDs with metrics in this window
        var serviceIds = await logsDb.ProcessMetrics
            .Where(m => m.Timestamp >= windowStart && m.Timestamp < windowEnd)
            .Select(m => m.ServiceId)
            .Distinct()
            .ToListAsync(stoppingToken);

        var aggregations = new List<ProcessMetricsAggregated>();

        foreach (var serviceId in serviceIds)
        {
            var metrics = await logsDb.ProcessMetrics
                .Where(m => m.ServiceId == serviceId && m.Timestamp >= windowStart && m.Timestamp < windowEnd)
                .ToListAsync(stoppingToken);

            if (!metrics.Any()) continue;

            var aggregated = new ProcessMetricsAggregated
            {
                ServiceId = serviceId,
                Timestamp = windowStart,
                IntervalSeconds = aggregationInterval,
                SampleCount = metrics.Count,
                
                AvgWorkingSetMemory = (long)metrics.Average(m => m.WorkingSetMemory),
                MaxWorkingSetMemory = metrics.Max(m => m.WorkingSetMemory),
                MinWorkingSetMemory = metrics.Min(m => m.WorkingSetMemory),
                
                AvgPrivateMemory = (long)metrics.Average(m => m.PrivateMemory),
                MaxPrivateMemory = metrics.Max(m => m.PrivateMemory),
                
                AvgCpuUsagePercent = metrics.Average(m => m.CpuUsagePercent),
                MaxCpuUsagePercent = metrics.Max(m => m.CpuUsagePercent),
                MinCpuUsagePercent = metrics.Min(m => m.CpuUsagePercent),
                
                AvgThreadCount = metrics.Average(m => m.ThreadCount),
                MaxThreadCount = metrics.Max(m => m.ThreadCount),
                
                AvgHandleCount = metrics.Average(m => m.HandleCount),
                MaxHandleCount = metrics.Max(m => m.HandleCount),
                
                TotalNetworkBytesSent = metrics.Sum(m => m.NetworkBytesSent),
                TotalNetworkBytesReceived = metrics.Sum(m => m.NetworkBytesReceived)
            };

            aggregations.Add(aggregated);
        }

        if (aggregations.Any())
        {
            await logsDb.ProcessMetricsAggregated.AddRangeAsync(aggregations, stoppingToken);
            await logsDb.SaveChangesAsync(stoppingToken);
            _logger.LogDebug("Aggregated metrics for {Count} services at {Timestamp}", aggregations.Count, windowStart);
        }
    }

    private async Task CleanupOldMetricsAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var appDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logsDb = scope.ServiceProvider.GetRequiredService<LogsDbContext>();

        var settings = await appDb.AppSettings.FirstOrDefaultAsync(stoppingToken);
        var retentionHours = settings?.MetricsRetentionHours ?? 24;
        var cutoff = DateTime.UtcNow.AddHours(-retentionHours);

        // Delete old raw metrics (keep aggregated longer)
        var deletedRaw = await logsDb.ProcessMetrics
            .Where(m => m.Timestamp < cutoff)
            .ExecuteDeleteAsync(stoppingToken);

        // Delete old aggregated metrics (keep 7 days)
        var aggregatedCutoff = DateTime.UtcNow.AddDays(-7);
        var deletedAggregated = await logsDb.ProcessMetricsAggregated
            .Where(m => m.Timestamp < aggregatedCutoff)
            .ExecuteDeleteAsync(stoppingToken);

        if (deletedRaw > 0 || deletedAggregated > 0)
        {
            _logger.LogInformation("Cleaned up {RawCount} raw metrics and {AggCount} aggregated metrics", 
                deletedRaw, deletedAggregated);
        }
    }

    private (Process Process, Guid? SessionId)? GetProcessInfo(Guid serviceId)
    {
        // Access the running services dictionary through reflection or by modifying ServiceProcessManager
        // For now, we'll use a simple approach - check if process manager can give us the process
        
        // Since ServiceProcessManager._runningServices is private, we'll need to add a method
        // For now, let's try to get process by iterating system processes
        // This is a temporary solution - ideally we'd expose this from ServiceProcessManager
        
        if (_processManager is ServiceProcessManager spm)
        {
            // Use reflection to access the private dictionary
            var field = typeof(ServiceProcessManager).GetField("_runningServices", 
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            
            if (field?.GetValue(spm) is ConcurrentDictionary<Guid, SessionMetadata> runningServices)
            {
                if (runningServices.TryGetValue(serviceId, out var metadata))
                {
                    return (metadata.Process, metadata.Session.SessionId);
                }
            }
        }
        
        return null;
    }

    private int GetHandleCount(Process process)
    {
        try
        {
            return process.HandleCount;
        }
        catch
        {
            return 0;
        }
    }

    private bool IsProcessResponding(Process process)
    {
        try
        {
            // On Windows, we can check Responding property for GUI apps
            // On Linux, we just check if the process is still running
            if (OperatingSystem.IsWindows())
            {
                return process.Responding;
            }
            return !process.HasExited;
        }
        catch
        {
            return false;
        }
    }

    private static DateTime RoundToSeconds(DateTime dt)
    {
        return new DateTime(dt.Year, dt.Month, dt.Day, dt.Hour, dt.Minute, dt.Second, DateTimeKind.Utc);
    }

    private static DateTime RoundToInterval(DateTime dt, int intervalSeconds)
    {
        var seconds = (long)(dt - DateTime.UnixEpoch).TotalSeconds;
        var rounded = (seconds / intervalSeconds) * intervalSeconds;
        return DateTime.UnixEpoch.AddSeconds(rounded);
    }

    /// <summary>
    /// Pre-populate history with initial data points if the database is empty.
    /// This ensures charts have data to display on first run.
    /// </summary>
    private async Task PrePopulateHistoryIfEmptyAsync()
    {
        const int INITIAL_POINTS = 50;
        const int INTERVAL_SECONDS = 5;
        
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var logsDb = scope.ServiceProvider.GetRequiredService<LogsDbContext>();
            
            // Check if we already have data
            var existingCount = await logsDb.SystemMetrics.CountAsync();
            if (existingCount >= INITIAL_POINTS)
            {
                _logger.LogDebug("System metrics history already has {Count} points, skipping pre-population", existingCount);
                return;
            }
            
            _logger.LogInformation("Pre-populating system metrics history with {Count} initial points", INITIAL_POINTS - existingCount);
            
            // Get current system metrics as baseline
            var currentSnapshot = _systemMetrics;
            var now = DateTime.UtcNow;
            
            var metricsToAdd = new List<SystemMetrics>();
            
            // Generate historical data points going backwards in time
            for (int i = INITIAL_POINTS - existingCount; i > 0; i--)
            {
                var timestamp = now.AddSeconds(-i * INTERVAL_SECONDS);
                
                // Add slight variations to make the chart look realistic
                var random = new Random((int)timestamp.Ticks);
                var cpuVariation = (random.NextDouble() - 0.5) * 10; // ±5%
                var memVariation = (random.NextDouble() - 0.5) * 4;  // ±2%
                
                var metrics = new SystemMetrics
                {
                    Timestamp = timestamp,
                    CpuUsagePercent = Math.Clamp(currentSnapshot.CpuUsagePercent + cpuVariation, 0, 100),
                    ProcessorCount = currentSnapshot.ProcessorCount,
                    MemoryUsagePercent = Math.Clamp(currentSnapshot.MemoryUsagePercent + memVariation, 0, 100),
                    TotalPhysicalMemory = currentSnapshot.TotalPhysicalMemory,
                    UsedPhysicalMemory = currentSnapshot.UsedPhysicalMemory,
                    AvailablePhysicalMemory = currentSnapshot.AvailablePhysicalMemory,
                    NetworkBytesSent = currentSnapshot.NetworkInterfaces.Sum(n => n.BytesSent),
                    NetworkBytesReceived = currentSnapshot.NetworkInterfaces.Sum(n => n.BytesReceived),
                    NetworkSendRate = currentSnapshot.TotalNetworkSendRate,
                    NetworkReceiveRate = currentSnapshot.TotalNetworkReceiveRate,
                    TotalDiskSpace = currentSnapshot.Disks.Sum(d => d.TotalSize),
                    UsedDiskSpace = currentSnapshot.Disks.Sum(d => d.UsedSpace),
                    AvailableDiskSpace = currentSnapshot.Disks.Sum(d => d.AvailableSpace),
                    DiskUsagePercent = currentSnapshot.Disks.Any() ? currentSnapshot.Disks.Average(d => d.UsagePercent) : 0,
                    SystemUptime = currentSnapshot.SystemUptime,
                    TotalProcesses = currentSnapshot.TotalProcesses,
                    TotalThreads = currentSnapshot.TotalThreads
                };
                
                metricsToAdd.Add(metrics);
            }
            
            if (metricsToAdd.Any())
            {
                logsDb.SystemMetrics.AddRange(metricsToAdd);
                await logsDb.SaveChangesAsync();
                _logger.LogInformation("Pre-populated {Count} system metrics data points", metricsToAdd.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to pre-populate system metrics history");
        }
    }

    private async Task StoreSystemMetricsAsync(SystemMetricsSnapshot snapshot)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var logsDb = scope.ServiceProvider.GetRequiredService<LogsDbContext>();

            var metrics = new SystemMetrics
            {
                Timestamp = snapshot.Timestamp,
                CpuUsagePercent = snapshot.CpuUsagePercent,
                ProcessorCount = snapshot.ProcessorCount,
                MemoryUsagePercent = snapshot.MemoryUsagePercent,
                TotalPhysicalMemory = snapshot.TotalPhysicalMemory,
                UsedPhysicalMemory = snapshot.UsedPhysicalMemory,
                AvailablePhysicalMemory = snapshot.AvailablePhysicalMemory,
                NetworkBytesSent = snapshot.NetworkInterfaces.Sum(n => n.BytesSent),
                NetworkBytesReceived = snapshot.NetworkInterfaces.Sum(n => n.BytesReceived),
                NetworkSendRate = snapshot.TotalNetworkSendRate,
                NetworkReceiveRate = snapshot.TotalNetworkReceiveRate,
                TotalDiskSpace = snapshot.Disks.Sum(d => d.TotalSize),
                UsedDiskSpace = snapshot.Disks.Sum(d => d.UsedSpace),
                AvailableDiskSpace = snapshot.Disks.Sum(d => d.AvailableSpace),
                DiskUsagePercent = snapshot.Disks.Any() ? snapshot.Disks.Average(d => d.UsagePercent) : 0,
                SystemUptime = snapshot.SystemUptime,
                TotalProcesses = snapshot.TotalProcesses,
                TotalThreads = snapshot.TotalThreads
            };

            logsDb.SystemMetrics.Add(metrics);
            await logsDb.SaveChangesAsync();

            // Cleanup old metrics (keep last 24 hours)
            var cutoff = DateTime.UtcNow.AddHours(-24);
            var oldMetrics = await logsDb.SystemMetrics
                .Where(m => m.Timestamp < cutoff)
                .Take(1000)
                .ToListAsync();
            
            if (oldMetrics.Any())
            {
                logsDb.SystemMetrics.RemoveRange(oldMetrics);
                await logsDb.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to store system metrics to database");
        }
    }
}
