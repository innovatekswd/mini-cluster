using System;
using System.Collections.Generic;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    /// <summary>
    /// Restart policy for a service when it exits
    /// </summary>
    public enum RestartPolicy
    {
        /// <summary>Never restart on exit</summary>
        Never = 0,
        /// <summary>Restart only on non-zero exit code</summary>
        OnFailure = 1,
        /// <summary>Always restart (except manual stop)</summary>
        Always = 2,
        /// <summary>Restart unless explicitly stopped by user</summary>
        UnlessStopped = 3
    }

    /// <summary>
    /// Type of health check probe
    /// </summary>
    public enum HealthCheckType
    {
        /// <summary>No health check configured</summary>
        None = 0,
        /// <summary>HTTP GET request, expects 2xx response</summary>
        Http = 1,
        /// <summary>TCP connection test to a port</summary>
        Tcp = 2,
        /// <summary>Execute a command, check exit code</summary>
        Exec = 3
    }

    /// <summary>
    /// Base class with common service properties (for import/export scenarios)
    /// </summary>
    public class ServiceBase
    {
        public string Name { get; set; } = string.Empty;
        
        /// <summary>
        /// URL-friendly identifier derived from Name. Lowercase, alphanumeric with hyphens.
        /// Used for routing and API paths instead of encoded names. Must be unique within an app.
        /// </summary>
        public required string Slug { get; set; }
        
        public string ExecutablePath { get; set; } = string.Empty;
        public string? Arguments { get; set; }
        public Dictionary<string, string> EnvironmentVariables { get; set; } = new();
        public bool AutoStart { get; set; } = false;
        public string? WorkingDirectory { get; set; }

        /// <summary>
        /// URL to access the service directly (e.g., http://localhost:3000)
        /// </summary>
        public string? AccessLink { get; set; }

        /// <summary>
        /// Flag to indicate this service is managed externally (not started by Control Center)
        /// </summary>
        public bool IsExternal { get; set; } = false;

        public bool UseShellExecute { get; set; }
        public bool CreateNoWindow { get; set; }
        
        /// <summary>
        /// Output capture mode: 0 = Auto, 1 = Always capture, 2 = Never capture
        /// </summary>
        public int CaptureOutput { get; set; } = 0;
    }
    
    /// <summary>
    /// A service is a single runnable process managed by Control Center
    /// </summary>
    public class Service : ServiceBase
    {
        public Guid Id { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;
        
        /// <summary>
        /// Optional description of what this service does
        /// </summary>
        public string? Description { get; set; }
        
        /// <summary>
        /// Display order in the UI
        /// </summary>
        public int OrderIndex { get; set; } = 0;
        
        /// <summary>
        /// Optional App ID for grouping services into apps
        /// </summary>
        public Guid? AppId { get; set; }
        
        /// <summary>
        /// Navigation property to the parent App
        /// </summary>
        public App? App { get; set; }
        
        /// <summary>
        /// Optional Machine ID — which machine this service runs on.
        /// Null means local (the machine running this MiniCluster instance).
        /// </summary>
        public Guid? MachineId { get; set; }

        /// <summary>
        /// Service type: Process (native), Docker, or Podman.
        /// Default is Process (native OS process).
        /// </summary>
        public ServiceType ServiceType { get; set; } = ServiceType.Process;

        /// <summary>
        /// Container configuration (only used when ServiceType is Docker or Podman)
        /// </summary>
        public ContainerConfig? ContainerConfig { get; set; }

        // ── Restart Policy ──────────────────────────────────────────────

        /// <summary>
        /// Restart policy: Never, OnFailure, Always, UnlessStopped
        /// </summary>
        public RestartPolicy RestartPolicy { get; set; } = RestartPolicy.Never;

        /// <summary>
        /// Max restart attempts within the restart window before entering cooldown
        /// </summary>
        public int MaxRestarts { get; set; } = 5;

        /// <summary>
        /// Time window (seconds) for counting restart attempts
        /// </summary>
        public int RestartWindowSeconds { get; set; } = 300;

        /// <summary>
        /// Initial delay (seconds) before first restart attempt
        /// </summary>
        public int RestartDelaySeconds { get; set; } = 3;

        /// <summary>
        /// Maximum delay (seconds) when using exponential backoff
        /// </summary>
        public int MaxRestartDelaySeconds { get; set; } = 300;

        /// <summary>
        /// Use exponential backoff with jitter for restart delays
        /// </summary>
        public bool UseExponentialBackoff { get; set; } = true;

        // ── Health Check ────────────────────────────────────────────────

        /// <summary>
        /// Type of health check probe: None, Http, Tcp, Exec
        /// </summary>
        public HealthCheckType HealthCheckType { get; set; } = HealthCheckType.None;

        /// <summary>
        /// Health check endpoint URL for HTTP probes (e.g., http://localhost:3000/health)
        /// or host:port for TCP probes (e.g., localhost:5432)
        /// or command for Exec probes (e.g., "curl -f http://localhost/health")
        /// </summary>
        public string? HealthCheckTarget { get; set; }

        /// <summary>
        /// Interval in seconds between health check probes
        /// </summary>
        public int HealthCheckIntervalSeconds { get; set; } = 30;

        /// <summary>
        /// Timeout in seconds for each health check probe
        /// </summary>
        public int HealthCheckTimeoutSeconds { get; set; } = 5;

        /// <summary>
        /// Number of consecutive failures before marking unhealthy
        /// </summary>
        public int HealthCheckFailureThreshold { get; set; } = 3;

        /// <summary>
        /// Grace period in seconds after start before health checks begin
        /// </summary>
        public int HealthCheckGracePeriodSeconds { get; set; } = 10;
    }
}
