using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Dtos;

// ============ Phase5 Service Type Enum (for future multi-machine architecture) ============

public enum Phase5ServiceType
{
    Process = 0,
    Container = 1,
    Script = 2
}

// ============ Machine DTOs ============

public record MachineDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Host { get; init; }
    public int Port { get; init; }
    public string ConnectionType { get; init; } = "local";
    public string? SshUsername { get; init; }
    public string Status { get; init; } = "unknown";
    public DateTime? LastSeen { get; init; }
    public string? Metadata { get; init; }
    public int OrderIndex { get; init; }
    public bool IsLocal { get; init; }
    
    // Cluster / Agent fields
    public string? AgentEndpoint { get; init; }
    public string? AgentVersion { get; init; }
    public string? Labels { get; init; }
    public int? CpuCores { get; init; }
    public long? TotalMemoryBytes { get; init; }
    public long? TotalDiskBytes { get; init; }
    
    public DateTime CreatedAt { get; init; }
    public DateTime ModifiedAt { get; init; }
    
    // Computed/aggregated
    public int ServiceCount { get; init; }
    public int RunningServiceCount { get; init; }
}

public record CreateMachineDto
{
    public string Name { get; init; } = string.Empty;
    public string? Host { get; init; }
    public int Port { get; init; } = 22;
    public string ConnectionType { get; init; } = "local";
    public string? SshUsername { get; init; }
    public string? SshKeyPath { get; init; }
    public string? SshPassword { get; init; }
    public int OrderIndex { get; init; } = 0;
    
    // Cluster / Agent fields
    public string? AgentEndpoint { get; init; }
    public string? AgentApiKey { get; init; }
    public string? Labels { get; init; }
}

public record UpdateMachineDto
{
    public string? Name { get; init; }
    public string? Host { get; init; }
    public int? Port { get; init; }
    public string? ConnectionType { get; init; }
    public string? SshUsername { get; init; }
    public string? SshKeyPath { get; init; }
    public string? SshPassword { get; init; }
    public int? OrderIndex { get; init; }
    
    // Cluster / Agent fields
    public string? AgentEndpoint { get; init; }
    public string? AgentApiKey { get; init; }
    public string? Labels { get; init; }
}

public record MachineWithServicesDto : MachineDto
{
    public List<Phase5ServiceDto> Services { get; init; } = new();
}

public record MachineMetricsDto
{
    public Guid MachineId { get; init; }
    public double CpuUsagePercent { get; init; }
    public long MemoryUsedBytes { get; init; }
    public long MemoryTotalBytes { get; init; }
    public long DiskUsedBytes { get; init; }
    public long DiskTotalBytes { get; init; }
    public DateTime Timestamp { get; init; }
}

// ============ Service DTOs (Phase5 - Multi-machine architecture) ============

public record Phase5ServiceDto
{
    public Guid Id { get; init; }
    public Guid AppId { get; init; }
    public string? AppName { get; init; }
    public Guid MachineId { get; init; }
    public string? MachineName { get; init; }
    public string Name { get; init; } = string.Empty;
    public Phase5ServiceType Type { get; init; }
    
    // Process config
    public string? ExecutablePath { get; init; }
    public string? Arguments { get; init; }
    public string? WorkingDirectory { get; init; }
    public bool UseShellExecute { get; init; }
    public bool CreateNoWindow { get; init; }
    public int CaptureOutput { get; init; }
    
    // Container config
    public string? Image { get; init; }
    public string? ContainerName { get; init; }
    public string? Ports { get; init; }
    public string? Volumes { get; init; }
    public string? Network { get; init; }
    public string? DockerOptions { get; init; }
    
    // Common
    public Dictionary<string, string> EnvironmentVariables { get; init; } = new();
    public string Status { get; init; } = "stopped";
    public int? ProcessId { get; init; }
    public string? ContainerId { get; init; }
    public bool AutoStart { get; init; }
    public bool RestartOnFailure { get; init; }
    public int MaxRestartAttempts { get; init; }
    public int OrderIndex { get; init; }
    public int StartOrder { get; init; }
    public string? AccessLink { get; init; }
    public bool IsExternal { get; init; }
    public bool InheritEnvFromApp { get; init; }
    
    public DateTime CreatedAt { get; init; }
    public DateTime ModifiedAt { get; init; }
}

public record CreatePhase5ServiceDto
{
    public Guid AppId { get; init; }
    public Guid MachineId { get; init; }
    public string Name { get; init; } = string.Empty;
    public Phase5ServiceType Type { get; init; } = Phase5ServiceType.Process;
    
    // Process config
    public string? ExecutablePath { get; init; }
    public string? Arguments { get; init; }
    public string? WorkingDirectory { get; init; }
    public bool UseShellExecute { get; init; } = false;
    public bool CreateNoWindow { get; init; } = true;
    public int CaptureOutput { get; init; } = 0;
    
    // Container config
    public string? Image { get; init; }
    public string? ContainerName { get; init; }
    public string? Ports { get; init; }
    public string? Volumes { get; init; }
    public string? Network { get; init; }
    public string? DockerOptions { get; init; }
    
    // Common
    public Dictionary<string, string>? EnvironmentVariables { get; init; }
    public bool AutoStart { get; init; } = true;
    public bool RestartOnFailure { get; init; } = false;
    public int MaxRestartAttempts { get; init; } = 3;
    public int OrderIndex { get; init; } = 0;
    public int StartOrder { get; init; } = 0;
    public string? AccessLink { get; init; }
    public bool IsExternal { get; init; } = false;
    public bool InheritEnvFromApp { get; init; } = true;
}

public record UpdatePhase5ServiceDto
{
    public Guid? MachineId { get; init; }
    public string? Name { get; init; }
    public Phase5ServiceType? Type { get; init; }
    
    // Process config
    public string? ExecutablePath { get; init; }
    public string? Arguments { get; init; }
    public string? WorkingDirectory { get; init; }
    public bool? UseShellExecute { get; init; }
    public bool? CreateNoWindow { get; init; }
    public int? CaptureOutput { get; init; }
    
    // Container config
    public string? Image { get; init; }
    public string? ContainerName { get; init; }
    public string? Ports { get; init; }
    public string? Volumes { get; init; }
    public string? Network { get; init; }
    public string? DockerOptions { get; init; }
    
    // Common
    public Dictionary<string, string>? EnvironmentVariables { get; init; }
    public bool? AutoStart { get; init; }
    public bool? RestartOnFailure { get; init; }
    public int? MaxRestartAttempts { get; init; }
    public int? OrderIndex { get; init; }
    public int? StartOrder { get; init; }
    public string? AccessLink { get; init; }
    public bool? IsExternal { get; init; }
    public bool? InheritEnvFromApp { get; init; }
}

// ============ ServiceGroup DTOs ============

public record ServiceGroupDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? Icon { get; init; }
    public string? Color { get; init; }
    public Guid? ParentGroupId { get; init; }
    public int OrderIndex { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime ModifiedAt { get; init; }
    
    // Computed
    public int ServiceCount { get; init; }
    public List<ServiceGroupDto>? ChildGroups { get; init; }
}

public record CreateServiceGroupDto
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? Icon { get; init; }
    public string? Color { get; init; }
    public Guid? ParentGroupId { get; init; }
    public int OrderIndex { get; init; } = 0;
}

public record UpdateServiceGroupDto
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public string? Icon { get; init; }
    public string? Color { get; init; }
    public Guid? ParentGroupId { get; init; }
    public int? OrderIndex { get; init; }
}

public record GroupVariableDto
{
    public Guid Id { get; init; }
    public Guid GroupId { get; init; }
    public string Key { get; init; } = string.Empty;
    public string? Value { get; init; }
    public bool IsSecret { get; init; }
}

public record CreateGroupVariableDto
{
    public string Key { get; init; } = string.Empty;
    public string? Value { get; init; }
    public bool IsSecret { get; init; } = false;
}

public record UpdateGroupVariableDto
{
    public string? Key { get; init; }
    public string? Value { get; init; }
    public bool? IsSecret { get; init; }
}

// ============ Service Hierarchy DTOs ============

public record ServiceTreeDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public bool IsComposite { get; init; }
    public string Status { get; init; } = "stopped";
    public int ServiceCount { get; init; }
    public int ChildCount { get; init; }
    public List<ServiceTreeDto> Children { get; init; } = new();
}

// ============ Cascade Operation Result DTOs ============

public record ServiceStartResultDto
{
    public int TotalStarted { get; init; }
    public int TotalFailed { get; init; }
    public List<ServiceStartResultItem> Results { get; init; } = new();
}

public record ServiceStartResultItem
{
    public Guid ServiceId { get; init; }
    public string? ServiceName { get; init; }
    public bool Success { get; init; }
    public string? Error { get; init; }
}

public record ServiceStopResultDto
{
    public int TotalStopped { get; init; }
    public int TotalFailed { get; init; }
    public List<ServiceStopResultItem> Results { get; init; } = new();
}

public record ServiceStopResultItem
{
    public Guid ServiceId { get; init; }
    public string? ServiceName { get; init; }
    public bool Success { get; init; }
    public string? Error { get; init; }
}
