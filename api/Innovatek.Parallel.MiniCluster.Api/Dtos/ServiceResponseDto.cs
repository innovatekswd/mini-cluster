namespace Innovatek.Parallel.MiniCluster.Api.Dtos;

/// <summary>
/// Response DTO for service data
/// </summary>
public class ServiceResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = string.Empty;
    public string ExecutablePath { get; set; } = default!;
    public string? Arguments { get; set; }
    public Dictionary<string, string> EnvironmentVariables { get; set; } = new();
    public bool AutoStart { get; set; }
    public string? WorkingDirectory { get; set; }
    public string? AccessLink { get; set; }
    public bool IsExternal { get; set; }
    public bool UseShellExecute { get; set; }
    public bool CreateNoWindow { get; set; }
    public int CaptureOutput { get; set; }
    public string? Description { get; set; }
    public int OrderIndex { get; set; }
    public Guid? AppId { get; set; }
    
    /// <summary>
    /// Runtime status of the service (stopped, starting, running, stopping, failed)
    /// </summary>
    public string Status { get; set; } = "stopped";
    
    public DateTime CreatedAt { get; set; }
    public DateTime ModifiedAt { get; set; }

    // ── Restart Policy ──────────────────────────────────────────────
    
    /// <summary>Restart policy: Never (0), OnFailure (1), Always (2), UnlessStopped (3)</summary>
    public int RestartPolicy { get; set; }
    public int MaxRestarts { get; set; }
    public int RestartWindowSeconds { get; set; }
    public int RestartDelaySeconds { get; set; }
    public int MaxRestartDelaySeconds { get; set; }
    public bool UseExponentialBackoff { get; set; }

    // ── Health Check ────────────────────────────────────────────────
    
    /// <summary>Health check type: None (0), Http (1), Tcp (2), Exec (3)</summary>
    public int HealthCheckType { get; set; }
    public string? HealthCheckTarget { get; set; }
    public int HealthCheckIntervalSeconds { get; set; }
    public int HealthCheckTimeoutSeconds { get; set; }
    public int HealthCheckFailureThreshold { get; set; }
    public int HealthCheckGracePeriodSeconds { get; set; }

    // ── Runtime Health State (populated from HealthCheckService) ─────
    
    /// <summary>Current health status: null = no check configured, true = healthy, false = unhealthy</summary>
    public bool? IsHealthy { get; set; }
    public int? ConsecutiveHealthFailures { get; set; }
    public string? LastHealthError { get; set; }
    public DateTime? LastHealthCheckAt { get; set; }

    // ── Runtime Restart State (populated from AutoRestartService) ────
    
    public int? RestartCount { get; set; }
    public bool? IsInCooldown { get; set; }
    public DateTime? CooldownUntil { get; set; }
}
