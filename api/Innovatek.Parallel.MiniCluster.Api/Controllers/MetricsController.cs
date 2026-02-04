using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class MetricsController : ControllerBase
{
    private readonly LogsDbContext _logsDb;
    private readonly IProcessMetricsService _metricsService;
    private readonly IIdentifierResolver _resolver;
    private readonly ILogger<MetricsController> _logger;

    public MetricsController(
        LogsDbContext logsDb, 
        IProcessMetricsService metricsService,
        IIdentifierResolver resolver,
        ILogger<MetricsController> logger)
    {
        _logsDb = logsDb;
        _metricsService = metricsService;
        _resolver = resolver;
        _logger = logger;
    }

    /// <summary>
    /// Get live (real-time) metrics for all running apps
    /// </summary>
    [HttpGet("live")]
    public ActionResult<Dictionary<Guid, ProcessMetricsSnapshot>> GetLiveMetrics()
    {
        var metrics = _metricsService.GetAllCurrentMetrics();
        return Ok(metrics);
    }

    /// <summary>
    /// Get current system metrics (CPU, memory, disk, network)
    /// </summary>
    [HttpGet("system")]
    public ActionResult<SystemMetricsSnapshot> GetSystemMetrics()
    {
        var metrics = _metricsService.GetSystemMetrics();
        return Ok(metrics);
    }

    /// <summary>
    /// Get all running system processes
    /// </summary>
    [HttpGet("processes")]
    public ActionResult<List<SystemProcessInfo>> GetSystemProcesses(
        [FromQuery] string? sortBy = "memory",
        [FromQuery] int limit = 50)
    {
        try
        {
            var processes = Process.GetProcesses()
                .Select(p =>
                {
                    try
                    {
                        return new SystemProcessInfo
                        {
                            ProcessId = p.Id,
                            ProcessName = p.ProcessName,
                            WorkingSetMemory = p.WorkingSet64,
                            ThreadCount = p.Threads.Count,
                            StartTime = TryGetStartTime(p),
                            IsResponding = TryGetResponding(p)
                        };
                    }
                    catch
                    {
                        return null;
                    }
                })
                .Where(p => p != null)
                .Cast<SystemProcessInfo>();

            // Sort and limit
            processes = sortBy?.ToLower() switch
            {
                "cpu" => processes.OrderByDescending(p => p.ThreadCount),
                "name" => processes.OrderBy(p => p.ProcessName),
                "pid" => processes.OrderBy(p => p.ProcessId),
                _ => processes.OrderByDescending(p => p.WorkingSetMemory)
            };

            return Ok(processes.Take(limit).ToList());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting system processes");
            return StatusCode(500, new { message = "Failed to get system processes" });
        }
    }

    private static DateTime? TryGetStartTime(Process p)
    {
        try { return p.StartTime; }
        catch { return null; }
    }

    private static bool TryGetResponding(Process p)
    {
        try { return p.Responding; }
        catch { return true; }
    }

    /// <summary>
    /// Get live metrics for a specific service
    /// </summary>
    [HttpGet("live/{identifier}")]
    public async Task<ActionResult<ProcessMetricsSnapshot>> GetLiveServiceMetrics(string identifier)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        var metrics = _metricsService.GetCurrentMetrics(result.Value);
        
        if (metrics == null)
        {
            return NotFound(new { message = "No metrics available for this service. It may not be running." });
        }
        
        return Ok(metrics);
    }

    /// <summary>
    /// Get historical raw metrics for a service
    /// </summary>
    [HttpGet("history/{identifier}")]
    public async Task<ActionResult<MetricsHistoryResponse>> GetHistoricalMetrics(
        string identifier,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int limit = 1000)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        var fromDate = from ?? DateTime.UtcNow.AddHours(-1);
        var toDate = to ?? DateTime.UtcNow;
        
        var metrics = await _logsDb.ProcessMetrics
            .Where(m => m.ServiceId == result.Value && m.Timestamp >= fromDate && m.Timestamp <= toDate)
            .OrderByDescending(m => m.Timestamp)
            .Take(limit)
            .Select(m => new MetricsDataPoint
            {
                Timestamp = m.Timestamp,
                WorkingSetMemory = m.WorkingSetMemory,
                PrivateMemory = m.PrivateMemory,
                CpuUsagePercent = m.CpuUsagePercent,
                ThreadCount = m.ThreadCount,
                HandleCount = m.HandleCount,
                IsResponding = m.IsResponding,
                DiskBytesRead = m.DiskBytesRead,
                DiskBytesWritten = m.DiskBytesWritten,
                DiskReadRate = m.DiskReadRate,
                DiskWriteRate = m.DiskWriteRate
            })
            .ToListAsync();

        // Reverse to get chronological order
        metrics.Reverse();

        return Ok(new MetricsHistoryResponse
        {
            ServiceId = result.Value,
            From = fromDate,
            To = toDate,
            DataPoints = metrics,
            TotalCount = metrics.Count
        });
    }

    /// <summary>
    /// Get aggregated metrics for a service (averages over time intervals)
    /// </summary>
    [HttpGet("aggregated/{identifier}")]
    public async Task<ActionResult<AggregatedMetricsResponse>> GetAggregatedMetrics(
        string identifier,
        [FromQuery] int intervalSeconds = 60,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int limit = 500)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        var fromDate = from ?? DateTime.UtcNow.AddHours(-24);
        var toDate = to ?? DateTime.UtcNow;
        
        var metrics = await _logsDb.ProcessMetricsAggregated
            .Where(m => m.ServiceId == result.Value 
                && m.IntervalSeconds == intervalSeconds 
                && m.Timestamp >= fromDate 
                && m.Timestamp <= toDate)
            .OrderByDescending(m => m.Timestamp)
            .Take(limit)
            .ToListAsync();

        metrics.Reverse();

        return Ok(new AggregatedMetricsResponse
        {
            ServiceId = result.Value,
            IntervalSeconds = intervalSeconds,
            From = fromDate,
            To = toDate,
            DataPoints = metrics.Select(m => new AggregatedDataPoint
            {
                Timestamp = m.Timestamp,
                SampleCount = m.SampleCount,
                AvgWorkingSetMemory = m.AvgWorkingSetMemory,
                MaxWorkingSetMemory = m.MaxWorkingSetMemory,
                MinWorkingSetMemory = m.MinWorkingSetMemory,
                AvgCpuUsagePercent = m.AvgCpuUsagePercent,
                MaxCpuUsagePercent = m.MaxCpuUsagePercent,
                MinCpuUsagePercent = m.MinCpuUsagePercent,
                AvgThreadCount = m.AvgThreadCount,
                MaxThreadCount = m.MaxThreadCount
            }).ToList(),
            TotalCount = metrics.Count
        });
    }

    /// <summary>
    /// Get peak metrics for a service within a time range
    /// </summary>
    [HttpGet("peaks/{identifier}")]
    public async Task<ActionResult<PeakMetricsResponse>> GetPeakMetrics(
        string identifier,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        var fromDate = from ?? DateTime.UtcNow.AddHours(-24);
        var toDate = to ?? DateTime.UtcNow;

        var metrics = await _logsDb.ProcessMetrics
            .Where(m => m.ServiceId == result.Value && m.Timestamp >= fromDate && m.Timestamp <= toDate)
            .ToListAsync();

        if (!metrics.Any())
        {
            return Ok(new PeakMetricsResponse { ServiceId = result.Value, From = fromDate, To = toDate });
        }

        // Find peaks
        var peakMemory = metrics.OrderByDescending(m => m.WorkingSetMemory).First();
        var peakCpu = metrics.OrderByDescending(m => m.CpuUsagePercent).First();
        var peakThreads = metrics.OrderByDescending(m => m.ThreadCount).First();

        return Ok(new PeakMetricsResponse
        {
            ServiceId = result.Value,
            From = fromDate,
            To = toDate,
            PeakMemory = new PeakDataPoint
            {
                Timestamp = peakMemory.Timestamp,
                Value = peakMemory.WorkingSetMemory,
                FormattedValue = FormatBytes(peakMemory.WorkingSetMemory)
            },
            PeakCpu = new PeakDataPoint
            {
                Timestamp = peakCpu.Timestamp,
                Value = peakCpu.CpuUsagePercent,
                FormattedValue = $"{peakCpu.CpuUsagePercent:F1}%"
            },
            PeakThreads = new PeakDataPoint
            {
                Timestamp = peakThreads.Timestamp,
                Value = peakThreads.ThreadCount,
                FormattedValue = peakThreads.ThreadCount.ToString()
            },
            AverageMemory = (long)metrics.Average(m => m.WorkingSetMemory),
            AverageCpu = metrics.Average(m => m.CpuUsagePercent),
            TotalSamples = metrics.Count
        });
    }

    /// <summary>
    /// Get metrics summary for all services
    /// </summary>
    [HttpGet("summary")]
    public async Task<ActionResult<List<ServiceMetricsSummary>>> GetAllServicesSummary()
    {
        var currentMetrics = _metricsService.GetAllCurrentMetrics();
        var summaries = new List<ServiceMetricsSummary>();

        foreach (var (serviceId, snapshot) in currentMetrics)
        {
            // Get 1-hour history for trends
            var hourAgo = DateTime.UtcNow.AddHours(-1);
            var historicalMetrics = await _logsDb.ProcessMetrics
                .Where(m => m.ServiceId == serviceId && m.Timestamp >= hourAgo)
                .OrderByDescending(m => m.Timestamp)
                .Take(100)
                .ToListAsync();

            var summary = new ServiceMetricsSummary
            {
                ServiceId = serviceId,
                Current = snapshot,
                AvgMemoryLastHour = historicalMetrics.Any() 
                    ? (long)historicalMetrics.Average(m => m.WorkingSetMemory) 
                    : snapshot.WorkingSetMemory,
                AvgCpuLastHour = historicalMetrics.Any() 
                    ? historicalMetrics.Average(m => m.CpuUsagePercent) 
                    : snapshot.CpuUsagePercent,
                PeakMemoryLastHour = historicalMetrics.Any() 
                    ? historicalMetrics.Max(m => m.WorkingSetMemory) 
                    : snapshot.WorkingSetMemory,
                PeakCpuLastHour = historicalMetrics.Any() 
                    ? historicalMetrics.Max(m => m.CpuUsagePercent) 
                    : snapshot.CpuUsagePercent,
                SamplesLastHour = historicalMetrics.Count
            };

            summaries.Add(summary);
        }

        return Ok(summaries);
    }

    private static string FormatBytes(long bytes)
    {
        string[] sizes = { "B", "KB", "MB", "GB", "TB" };
        int order = 0;
        double len = bytes;
        while (len >= 1024 && order < sizes.Length - 1)
        {
            order++;
            len /= 1024;
        }
        return $"{len:0.##} {sizes[order]}";
    }
}

// DTOs
public class MetricsHistoryResponse
{
    public Guid ServiceId { get; set; }
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public List<MetricsDataPoint> DataPoints { get; set; } = new();
    public int TotalCount { get; set; }
}

public class MetricsDataPoint
{
    public DateTime Timestamp { get; set; }
    public long WorkingSetMemory { get; set; }
    public long PrivateMemory { get; set; }
    public double CpuUsagePercent { get; set; }
    public int ThreadCount { get; set; }
    public int HandleCount { get; set; }
    public bool IsResponding { get; set; }
    public long DiskBytesRead { get; set; }
    public long DiskBytesWritten { get; set; }
    public long DiskReadRate { get; set; }
    public long DiskWriteRate { get; set; }
}

public class AggregatedMetricsResponse
{
    public Guid ServiceId { get; set; }
    public int IntervalSeconds { get; set; }
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public List<AggregatedDataPoint> DataPoints { get; set; } = new();
    public int TotalCount { get; set; }
}

public class AggregatedDataPoint
{
    public DateTime Timestamp { get; set; }
    public int SampleCount { get; set; }
    public long AvgWorkingSetMemory { get; set; }
    public long MaxWorkingSetMemory { get; set; }
    public long MinWorkingSetMemory { get; set; }
    public double AvgCpuUsagePercent { get; set; }
    public double MaxCpuUsagePercent { get; set; }
    public double MinCpuUsagePercent { get; set; }
    public double AvgThreadCount { get; set; }
    public int MaxThreadCount { get; set; }
}

public class PeakMetricsResponse
{
    public Guid ServiceId { get; set; }
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public PeakDataPoint? PeakMemory { get; set; }
    public PeakDataPoint? PeakCpu { get; set; }
    public PeakDataPoint? PeakThreads { get; set; }
    public long AverageMemory { get; set; }
    public double AverageCpu { get; set; }
    public int TotalSamples { get; set; }
}

public class PeakDataPoint
{
    public DateTime Timestamp { get; set; }
    public double Value { get; set; }
    public string FormattedValue { get; set; } = string.Empty;
}

public class ServiceMetricsSummary
{
    public Guid ServiceId { get; set; }
    public ProcessMetricsSnapshot? Current { get; set; }
    public long AvgMemoryLastHour { get; set; }
    public double AvgCpuLastHour { get; set; }
    public long PeakMemoryLastHour { get; set; }
    public double PeakCpuLastHour { get; set; }
    public int SamplesLastHour { get; set; }
}

public class SystemProcessInfo
{
    public int ProcessId { get; set; }
    public string ProcessName { get; set; } = string.Empty;
    public long WorkingSetMemory { get; set; }
    public int ThreadCount { get; set; }
    public DateTime? StartTime { get; set; }
    public bool IsResponding { get; set; }
}
