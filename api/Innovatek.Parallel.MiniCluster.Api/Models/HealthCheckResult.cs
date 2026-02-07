using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Models;

/// <summary>
/// Result of a single health check probe execution
/// </summary>
public class HealthCheckResult
{
    public Guid ServiceId { get; set; }
    public bool IsHealthy { get; set; }
    public string? Message { get; set; }
    public int ResponseTimeMs { get; set; }
    public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
    public HealthCheckType CheckType { get; set; }
}

/// <summary>
/// Tracks the health state of a service over time, including consecutive failure counting
/// </summary>
public class ServiceHealthState
{
    public Guid ServiceId { get; set; }
    public bool IsHealthy { get; set; } = true;
    public int ConsecutiveFailures { get; set; }
    public DateTime? LastCheckAt { get; set; }
    public DateTime? LastHealthyAt { get; set; }
    public DateTime? MarkedUnhealthyAt { get; set; }
    public string? LastError { get; set; }
}

/// <summary>
/// Tracks the restart state of a service, including backoff calculation
/// </summary>
public class ServiceRestartState
{
    public Guid ServiceId { get; set; }
    public int RestartCount { get; set; }
    public DateTime WindowStart { get; set; } = DateTime.UtcNow;
    public DateTime? LastRestartAttempt { get; set; }
    public DateTime? CooldownUntil { get; set; }
    public bool IsInCooldown => CooldownUntil.HasValue && DateTime.UtcNow < CooldownUntil.Value;
    
    /// <summary>
    /// Whether the service was manually stopped (prevents auto-restart for UnlessStopped policy)
    /// </summary>
    public bool ManuallyStopped { get; set; }

    /// <summary>
    /// Calculate the next restart delay with optional exponential backoff and jitter
    /// </summary>
    public int GetNextDelaySeconds(int baseDelay, int maxDelay, bool useExponentialBackoff)
    {
        if (!useExponentialBackoff)
            return baseDelay;

        // Exponential backoff: base * 2^(attempt-1), capped at max
        var exponentialDelay = baseDelay * Math.Pow(2, Math.Max(0, RestartCount - 1));
        var cappedDelay = Math.Min(exponentialDelay, maxDelay);

        // Add jitter: ±25% randomness to prevent thundering herd
        var jitter = cappedDelay * 0.25 * (Random.Shared.NextDouble() * 2 - 1);
        var finalDelay = Math.Max(1, (int)(cappedDelay + jitter));

        return Math.Min(finalDelay, maxDelay);
    }
}
