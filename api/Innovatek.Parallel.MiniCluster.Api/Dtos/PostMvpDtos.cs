using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Dtos;

// ═══════════════════════════════════════════════════════════════
// Cron Scheduling DTOs (Feature 011)
// ═══════════════════════════════════════════════════════════════

public class CreateCronJobDto
{
    [Required, StringLength(200)]
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    [Required]
    public CronTarget TargetType { get; set; }
    public Guid? AppId { get; set; }
    public Guid? ServiceId { get; set; }
    public Guid? GroupId { get; set; }
    public string? ScriptPath { get; set; }

    [Required]
    public string CronExpression { get; set; } = string.Empty;
    public string? Timezone { get; set; }

    public CronAction Action { get; set; } = CronAction.Start;
    public bool WaitForCompletion { get; set; } = true;
    public int TimeoutSeconds { get; set; } = 3600;
    public CronMissedPolicy MissedPolicy { get; set; } = CronMissedPolicy.RunOnce;
    public Guid? DependsOnJobId { get; set; }
}

public class UpdateCronJobDto
{
    [StringLength(200)]
    public string? Name { get; set; }
    public string? Description { get; set; }

    public CronTarget? TargetType { get; set; }
    public Guid? AppId { get; set; }
    public Guid? ServiceId { get; set; }
    public Guid? GroupId { get; set; }
    public string? ScriptPath { get; set; }

    public string? CronExpression { get; set; }
    public string? Timezone { get; set; }

    public CronAction? Action { get; set; }
    public bool? WaitForCompletion { get; set; }
    public int? TimeoutSeconds { get; set; }
    public CronMissedPolicy? MissedPolicy { get; set; }
    public Guid? DependsOnJobId { get; set; }
}

public class CronJobResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    public CronTarget TargetType { get; set; }
    public string? TargetName { get; set; }
    public Guid? AppId { get; set; }
    public Guid? ServiceId { get; set; }
    public Guid? GroupId { get; set; }
    public string? ScriptPath { get; set; }

    public string CronExpression { get; set; } = string.Empty;
    public string? Timezone { get; set; }
    public CronAction Action { get; set; }
    public bool WaitForCompletion { get; set; }
    public int TimeoutSeconds { get; set; }
    public CronMissedPolicy MissedPolicy { get; set; }

    public bool IsEnabled { get; set; }
    public DateTime? LastRun { get; set; }
    public DateTime? NextRun { get; set; }
    public CronRunStatus LastRunStatus { get; set; }
    public string? LastRunError { get; set; }
    public int TotalRuns { get; set; }
    public int FailedRuns { get; set; }

    public Guid? DependsOnJobId { get; set; }
    public string? DependsOnJobName { get; set; }
}

public class CronJobRunResponseDto
{
    public Guid Id { get; set; }
    public Guid JobId { get; set; }
    public DateTime ScheduledFor { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public CronRunStatus Status { get; set; }
    public int? ExitCode { get; set; }
    public string? Output { get; set; }
    public string? Error { get; set; }
    public double? DurationSeconds { get; set; }
}

// ═══════════════════════════════════════════════════════════════
// Container Support DTOs (Feature 006)
// ═══════════════════════════════════════════════════════════════

public class ContainerConfigDto
{
    public int Id { get; set; }
    public Guid ServiceId { get; set; }
    public string Image { get; set; } = string.Empty;
    public string? Tag { get; set; }
    public string? Registry { get; set; }
    public string? ContainerName { get; set; }
    public string? Hostname { get; set; }
    public string? NetworkMode { get; set; }
    public bool Privileged { get; set; }
    public string? User { get; set; }
    public long? MemoryLimitBytes { get; set; }
    public double? CpuLimit { get; set; }
    public List<PortMappingDto>? PortMappings { get; set; }
    public List<VolumeMountDto>? VolumeMounts { get; set; }
    public Dictionary<string, string>? Labels { get; set; }
    public int RestartPolicy { get; set; }
    public string? ContainerId { get; set; }
    public string? ImageId { get; set; }
}

public class CreateContainerConfigDto
{
    [Required]
    public string Image { get; set; } = string.Empty;
    public string? Tag { get; set; } = "latest";
    public string? Registry { get; set; }
    public string? ContainerName { get; set; }
    public string? Hostname { get; set; }
    public string? NetworkMode { get; set; }
    public bool Privileged { get; set; }
    public string? User { get; set; }
    public long? MemoryLimitBytes { get; set; }
    public double? CpuLimit { get; set; }
    public List<PortMappingDto>? PortMappings { get; set; }
    public List<VolumeMountDto>? VolumeMounts { get; set; }
    public Dictionary<string, string>? Labels { get; set; }
    public int RestartPolicy { get; set; }
}

public class PortMappingDto
{
    public int Host { get; set; }
    public int Container { get; set; }
    public string Protocol { get; set; } = "tcp";
}

public class VolumeMountDto
{
    public string Host { get; set; } = string.Empty;
    public string Container { get; set; } = string.Empty;
    public bool ReadOnly { get; set; }
}

// ═══════════════════════════════════════════════════════════════
// Service Versioning DTOs (Feature 007)
// ═══════════════════════════════════════════════════════════════

public class CreateVersionDto
{
    public string? Version { get; set; }
    public string? Label { get; set; }
    public VersionSource Source { get; set; } = VersionSource.Manual;
    public string? GitCommit { get; set; }
    public string? Notes { get; set; }
}

public class ServiceVersionResponseDto
{
    public int Id { get; set; }
    public Guid ServiceId { get; set; }
    public string Version { get; set; } = string.Empty;
    public int SequenceNumber { get; set; }
    public string? Label { get; set; }
    public VersionSource Source { get; set; }
    public DeploymentStatus DeploymentStatus { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DeployedAt { get; set; }
    public string? GitCommit { get; set; }
    public string? ConfigDiff { get; set; }
    public string? DeploymentNotes { get; set; }
}

public class DeploymentResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? PreviousVersion { get; set; }
    public string? NewVersion { get; set; }
}

public class DeploymentConfigDto
{
    public int Id { get; set; }
    public Guid ServiceId { get; set; }
    public int Strategy { get; set; }
    public bool AutoRollbackOnFailure { get; set; }
    public int RollbackTimeoutSeconds { get; set; }
    public bool WaitForHealthy { get; set; }
    public int HealthCheckTimeoutSeconds { get; set; }
    public int MaxVersionsToKeep { get; set; }
    public bool AutoVersionOnSave { get; set; }
}

public class UpdateDeploymentConfigDto
{
    public int? Strategy { get; set; }
    public bool? AutoRollbackOnFailure { get; set; }
    public int? RollbackTimeoutSeconds { get; set; }
    public bool? WaitForHealthy { get; set; }
    public int? HealthCheckTimeoutSeconds { get; set; }
    public int? MaxVersionsToKeep { get; set; }
    public bool? AutoVersionOnSave { get; set; }
}

public class CreateAppSnapshotDto
{
    public string? Version { get; set; }
    public string? Label { get; set; }
}

public class AppSnapshotResponseDto
{
    public int Id { get; set; }
    public Guid AppId { get; set; }
    public string Version { get; set; } = string.Empty;
    public string? Label { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public List<AppSnapshotEntryDto> Entries { get; set; } = new();
}

public class AppSnapshotEntryDto
{
    public Guid ServiceId { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public int ServiceVersionId { get; set; }
    public string ServiceVersion { get; set; } = string.Empty;
}

// ═══════════════════════════════════════════════════════════════
// Hierarchical Apps DTOs (Feature 008)
// ═══════════════════════════════════════════════════════════════

public class AppTreeNodeDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Slug { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public Guid? ParentAppId { get; set; }
    public int SortOrder { get; set; }

    public int TotalServices { get; set; }
    public int RunningServices { get; set; }
    public int StoppedServices { get; set; }
    public int ErrorServices { get; set; }

    public List<ServiceSummaryDto> Services { get; set; } = new();
    public List<AppTreeNodeDto> Children { get; set; } = new();
}

public class ServiceSummaryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public class MoveAppDto
{
    public Guid? NewParentAppId { get; set; }
}

public class ReorderChildrenDto
{
    public List<Guid> OrderedChildIds { get; set; } = new();
}
