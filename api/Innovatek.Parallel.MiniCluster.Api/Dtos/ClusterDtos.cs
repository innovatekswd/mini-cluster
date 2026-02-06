namespace Innovatek.Parallel.MiniCluster.Api.Dtos;

// ============ Cluster Registration DTOs ============

/// <summary>
/// Sent by an agent when it registers with the controller.
/// </summary>
public record AgentRegistrationDto
{
    /// <summary>Agent display name.</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>Agent's reachable endpoint (e.g., "https://192.168.1.10:5147").</summary>
    public string Endpoint { get; init; } = string.Empty;

    /// <summary>System information collected from the agent.</summary>
    public AgentSystemInfoDto SystemInfo { get; init; } = new();

    /// <summary>Labels for targeting.</summary>
    public Dictionary<string, string> Labels { get; init; } = new();
}

/// <summary>
/// System info collected on the agent during registration and heartbeats.
/// </summary>
public record AgentSystemInfoDto
{
    public string? Os { get; init; }
    public string? Architecture { get; init; }
    public string? Framework { get; init; }
    public string? Hostname { get; init; }
    public string? AgentVersion { get; init; }
    public int CpuCores { get; init; }
    public long TotalMemoryBytes { get; init; }
    public long TotalDiskBytes { get; init; }
}

/// <summary>
/// Returned to the agent after successful registration.
/// </summary>
public record AgentRegistrationResultDto
{
    public Guid MachineId { get; init; }
    public string ControllerVersion { get; init; } = string.Empty;
}

// ============ Heartbeat DTOs ============

/// <summary>
/// Sent periodically by an agent to the controller.
/// </summary>
public record HeartbeatDto
{
    public Guid MachineId { get; init; }
    public string Status { get; init; } = "online";
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
    public HeartbeatMetricsDto? Metrics { get; init; }
    public List<HeartbeatAppSummary> Apps { get; init; } = new();
}

/// <summary>
/// Basic system metrics included in heartbeats.
/// </summary>
public record HeartbeatMetricsDto
{
    public double CpuUsagePercent { get; init; }
    public long MemoryUsedBytes { get; init; }
    public long MemoryTotalBytes { get; init; }
    public long DiskUsedBytes { get; init; }
    public long DiskTotalBytes { get; init; }
}

/// <summary>
/// Summary of an app running on the agent, included in heartbeats.
/// </summary>
public record HeartbeatAppSummary
{
    public Guid AppId { get; init; }
    public string Name { get; init; } = string.Empty;
    public int ServiceCount { get; init; }
    public int RunningServiceCount { get; init; }

    /// <summary>
    /// SHA256 hash of the app's configuration for drift detection.
    /// </summary>
    public string? ConfigHash { get; init; }
}

/// <summary>
/// Acknowledgement returned to agent after heartbeat.
/// </summary>
public record HeartbeatAckDto
{
    public bool Accepted { get; init; } = true;
    public DateTime ServerTime { get; init; } = DateTime.UtcNow;

    /// <summary>
    /// Commands queued for the agent (deploy, restart, etc.) — Phase 2+
    /// </summary>
    public List<PendingCommandDto> PendingCommands { get; init; } = new();
}

/// <summary>
/// A command queued by the controller for the agent to execute.
/// Placeholder for Phase 2 remote execution.
/// </summary>
public record PendingCommandDto
{
    public Guid CommandId { get; init; }
    public string Type { get; init; } = string.Empty; // "deploy", "restart", "stop", etc.
    public string? Payload { get; init; }
    public DateTime QueuedAt { get; init; }
}

// ============ Cluster Status DTOs ============

/// <summary>
/// Overview of the entire cluster.
/// </summary>
public record ClusterStatusDto
{
    public int TotalNodes { get; init; }
    public int OnlineNodes { get; init; }
    public int OfflineNodes { get; init; }
    public int DegradedNodes { get; init; }
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
    public string ControllerVersion { get; init; } = string.Empty;
    public List<ClusterNodeSummaryDto> Nodes { get; init; } = new();
}

/// <summary>
/// Summary of a single node for cluster overview.
/// </summary>
public record ClusterNodeSummaryDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Host { get; init; }
    public string Status { get; init; } = "unknown";
    public bool IsLocal { get; init; }
    public string ConnectionType { get; init; } = "local";
    public DateTime? LastSeen { get; init; }
    public string? AgentVersion { get; init; }
    public int? CpuCores { get; init; }
    public long? TotalMemoryBytes { get; init; }
    public int ServiceCount { get; init; }
    public int RunningServiceCount { get; init; }
    public Dictionary<string, string>? Labels { get; init; }
}
