using System.ComponentModel.DataAnnotations;
using Innovatek.Parallel.MiniCluster.Api.Validation;

namespace Innovatek.Parallel.MiniCluster.Api.Dtos;

/// <summary>
/// DTO for creating a new service
/// </summary>
public class CreateServiceDto
{
    [Required(ErrorMessage = "Name is required")]
    [StringLength(200, MinimumLength = 1, ErrorMessage = "Name must be between 1 and 200 characters")]
    public string Name { get; set; } = default!;

    [Required(ErrorMessage = "Executable path is required")]
    [StringLength(500, MinimumLength = 1, ErrorMessage = "Executable path must be between 1 and 500 characters")]
    public string ExecutablePath { get; set; } = default!;

    [StringLength(2000, ErrorMessage = "Arguments cannot exceed 2000 characters")]
    public string? Arguments { get; set; }

    public Dictionary<string, string> EnvironmentVariables { get; set; } = new();

    public bool AutoStart { get; set; } = false;

    [StringLength(500, ErrorMessage = "Working directory cannot exceed 500 characters")]
    public string? WorkingDirectory { get; set; }

    [OptionalUrl(ErrorMessage = "Access link must be a valid HTTP or HTTPS URL")]
    [StringLength(500, ErrorMessage = "Access link cannot exceed 500 characters")]
    public string? AccessLink { get; set; }

    public bool IsExternal { get; set; } = false;

    public bool UseShellExecute { get; set; } = false;

    public bool CreateNoWindow { get; set; } = true;

    /// <summary>
    /// Output capture mode: 0 = Auto, 1 = Always capture, 2 = Never capture
    /// </summary>
    public int CaptureOutput { get; set; } = 0;

    [StringLength(1000, ErrorMessage = "Description cannot exceed 1000 characters")]
    public string? Description { get; set; }

    public int OrderIndex { get; set; } = 0;

    /// <summary>
    /// Optional App ID to assign the service to
    /// </summary>
    public Guid? AppId { get; set; }

    // ── Restart Policy ──────────────────────────────────────────────

    /// <summary>Restart policy: Never (0), OnFailure (1), Always (2), UnlessStopped (3)</summary>
    public int RestartPolicy { get; set; } = 0;

    public int MaxRestarts { get; set; } = 5;
    public int RestartWindowSeconds { get; set; } = 300;
    public int RestartDelaySeconds { get; set; } = 3;
    public int MaxRestartDelaySeconds { get; set; } = 300;
    public bool UseExponentialBackoff { get; set; } = true;

    // ── Health Check ────────────────────────────────────────────────

    /// <summary>Health check type: None (0), Http (1), Tcp (2), Exec (3)</summary>
    public int HealthCheckType { get; set; } = 0;

    [StringLength(500, ErrorMessage = "Health check target cannot exceed 500 characters")]
    public string? HealthCheckTarget { get; set; }

    public int HealthCheckIntervalSeconds { get; set; } = 30;
    public int HealthCheckTimeoutSeconds { get; set; } = 5;
    public int HealthCheckFailureThreshold { get; set; } = 3;
    public int HealthCheckGracePeriodSeconds { get; set; } = 10;
}
