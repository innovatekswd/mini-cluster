using System;
using System.Collections.Generic;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    /// <summary>
    /// How a version was created
    /// </summary>
    public enum VersionSource
    {
        Manual = 0,
        ConfigChange = 1,
        GitPush = 2,
        GitTag = 3,
        Api = 4,
        Rollback = 5
    }

    /// <summary>
    /// Current deployment status of a version
    /// </summary>
    public enum DeploymentStatus
    {
        Pending = 0,
        Deploying = 1,
        Active = 2,
        RolledBack = 3,
        Failed = 4,
        Superseded = 5
    }

    /// <summary>
    /// Deployment strategy for a service
    /// </summary>
    public enum DeploymentStrategy
    {
        /// <summary>Stop old, start new</summary>
        Immediate = 0,
        /// <summary>Phase 2: run both, switch traffic</summary>
        BlueGreen = 1,
        /// <summary>Phase 2+: gradual traffic shift</summary>
        Canary = 2
    }

    /// <summary>
    /// A snapshot of a Service's configuration at a point in time.
    /// Every time a service's config changes, a version is created.
    /// </summary>
    public class ServiceVersion
    {
        public int Id { get; set; }
        public Guid ServiceId { get; set; }
        public Service Service { get; set; } = null!;

        // Version identification
        public string Version { get; set; } = string.Empty;
        public int SequenceNumber { get; set; }
        public string? Label { get; set; }

        // Configuration snapshot — JSON of versioned Service fields
        public string ConfigSnapshot { get; set; } = string.Empty;
        public string? ConfigDiff { get; set; }

        // Source
        public VersionSource Source { get; set; } = VersionSource.Manual;
        public string? GitCommit { get; set; }
        public string? GitBranch { get; set; }
        public string? GitMessage { get; set; }

        // Deployment history
        public DeploymentStatus DeploymentStatus { get; set; } = DeploymentStatus.Pending;
        public DateTime? DeployedAt { get; set; }
        public DateTime? RolledBackAt { get; set; }
        public string? DeploymentNotes { get; set; }

        // Audit
        public Guid? DeployedBy { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Per-service deployment configuration preferences
    /// </summary>
    public class DeploymentConfig
    {
        public int Id { get; set; }
        public Guid ServiceId { get; set; }
        public Service? Service { get; set; }

        public DeploymentStrategy Strategy { get; set; } = DeploymentStrategy.Immediate;
        public bool AutoRollbackOnFailure { get; set; } = true;
        public int RollbackTimeoutSeconds { get; set; } = 300;
        public bool WaitForHealthy { get; set; } = true;
        public int HealthCheckTimeoutSeconds { get; set; } = 120;
        public int MaxVersionsToKeep { get; set; } = 10;
        public bool AutoVersionOnSave { get; set; } = true;
    }

    /// <summary>
    /// Captures the current version of every service in an app at a point in time
    /// </summary>
    public class AppSnapshot
    {
        public int Id { get; set; }
        public Guid AppId { get; set; }
        public App App { get; set; } = null!;

        public string Version { get; set; } = string.Empty;
        public string? Label { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public Guid? CreatedBy { get; set; }

        public ICollection<AppSnapshotEntry> Entries { get; set; } = new List<AppSnapshotEntry>();
    }

    /// <summary>
    /// Maps a service to a specific version within an app snapshot
    /// </summary>
    public class AppSnapshotEntry
    {
        public int Id { get; set; }
        public int AppSnapshotId { get; set; }
        public AppSnapshot? AppSnapshot { get; set; }
        public Guid ServiceId { get; set; }
        public int ServiceVersionId { get; set; }
        public ServiceVersion? ServiceVersion { get; set; }
    }
}
