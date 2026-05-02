using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Abstracts metric retrieval so the evaluator can be tested without a real metrics collector.
/// </summary>
public interface IAlertMetricsProvider
{
    /// <summary>
    /// Returns the current value for <paramref name="metric"/>, scoped to the optional service.
    /// Returns null when the metric cannot be read (service not running, etc.).
    /// </summary>
    double? GetCurrentValue(AlertMetric metric, Guid? serviceId);
}

/// <summary>
/// Reads live values from <see cref="IProcessMetricsService"/> — the in-memory snapshot
/// kept by <see cref="ProcessMetricsCollectionService"/>.
/// </summary>
public class LiveMetricsProvider : IAlertMetricsProvider
{
    private readonly IProcessMetricsService _metrics;

    public LiveMetricsProvider(IProcessMetricsService metrics)
    {
        _metrics = metrics;
    }

    public double? GetCurrentValue(AlertMetric metric, Guid? serviceId)
    {
        return metric switch
        {
            AlertMetric.SystemCpuPercent    => _metrics.GetSystemMetrics().CpuUsagePercent,
            AlertMetric.SystemMemoryPercent => _metrics.GetSystemMetrics().MemoryUsagePercent,
            AlertMetric.SystemDiskPercent   => GetMaxDiskPercent(),

            AlertMetric.ProcessCpuPercent   => serviceId is null ? null :
                                               _metrics.GetCurrentMetrics(serviceId.Value)?.CpuUsagePercent,

            AlertMetric.ProcessMemoryMb     => serviceId is null ? null :
                                               ToMb(_metrics.GetCurrentMetrics(serviceId.Value)?.WorkingSetMemory),

            AlertMetric.ProcessThreadCount  => serviceId is null ? null :
                                               (double?)_metrics.GetCurrentMetrics(serviceId.Value)?.ThreadCount,

            AlertMetric.ProcessRestartCount => null, // restart count comes from service state — evaluated via external data
            AlertMetric.ProcessNotResponding => serviceId is null ? null :
                                               _metrics.GetCurrentMetrics(serviceId.Value) is { IsResponding: false } ? 1.0 : 0.0,

            _ => null
        };
    }

    private double GetMaxDiskPercent()
    {
        var disks = _metrics.GetSystemMetrics().Disks;
        if (disks is null || disks.Count == 0) return 0;
        return disks.Max(d => d.UsagePercent);
    }

    private static double? ToMb(long? bytes) => bytes is null ? null : bytes.Value / (1024.0 * 1024.0);
}
