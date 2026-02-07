using System.ComponentModel.DataAnnotations;
using Innovatek.Parallel.MiniCluster.Api.Validation;

namespace Innovatek.Parallel.MiniCluster.Api.Dtos;

/// <summary>
/// DTO for updating a service (all fields optional for partial updates)
/// </summary>
public class UpdateServiceDto
{
    [StringLength(200, MinimumLength = 1, ErrorMessage = "Name must be between 1 and 200 characters")]
    public string? Name { get; set; }

    [StringLength(500, MinimumLength = 1, ErrorMessage = "Executable path must be between 1 and 500 characters")]
    public string? ExecutablePath { get; set; }

    [StringLength(2000, ErrorMessage = "Arguments cannot exceed 2000 characters")]
    public string? Arguments { get; set; }

    public Dictionary<string, string>? EnvironmentVariables { get; set; }

    public bool? AutoStart { get; set; }

    [StringLength(500, ErrorMessage = "Working directory cannot exceed 500 characters")]
    public string? WorkingDirectory { get; set; }

    [OptionalUrl(ErrorMessage = "Access link must be a valid HTTP or HTTPS URL")]
    [StringLength(500, ErrorMessage = "Access link cannot exceed 500 characters")]
    public string? AccessLink { get; set; }

    public bool? IsExternal { get; set; }

    public bool? UseShellExecute { get; set; }

    public bool? CreateNoWindow { get; set; }

    /// <summary>
    /// Output capture mode: 0 = Auto, 1 = Always capture, 2 = Never capture
    /// </summary>
    public int? CaptureOutput { get; set; }

    [StringLength(1000, ErrorMessage = "Description cannot exceed 1000 characters")]
    public string? Description { get; set; }

    public int? OrderIndex { get; set; }

    // ── Restart Policy ──────────────────────────────────────────────

    /// <summary>Restart policy: Never (0), OnFailure (1), Always (2), UnlessStopped (3)</summary>
    public int? RestartPolicy { get; set; }

    public int? MaxRestarts { get; set; }
    public int? RestartWindowSeconds { get; set; }
    public int? RestartDelaySeconds { get; set; }
    public int? MaxRestartDelaySeconds { get; set; }
    public bool? UseExponentialBackoff { get; set; }

    // ── Health Check ────────────────────────────────────────────────

    /// <summary>Health check type: None (0), Http (1), Tcp (2), Exec (3)</summary>
    public int? HealthCheckType { get; set; }

    [StringLength(500, ErrorMessage = "Health check target cannot exceed 500 characters")]
    public string? HealthCheckTarget { get; set; }

    public int? HealthCheckIntervalSeconds { get; set; }
    public int? HealthCheckTimeoutSeconds { get; set; }
    public int? HealthCheckFailureThreshold { get; set; }
    public int? HealthCheckGracePeriodSeconds { get; set; }
}
