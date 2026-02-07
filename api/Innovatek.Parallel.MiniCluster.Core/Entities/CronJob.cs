using System;
using System.Collections.Generic;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    /// <summary>
    /// Target type for a cron job
    /// </summary>
    public enum CronTarget
    {
        /// <summary>Target an App (all its services)</summary>
        App = 0,
        /// <summary>Target a single Service</summary>
        Service = 1,
        /// <summary>Target a ServiceGroup (all assigned services)</summary>
        Group = 2,
        /// <summary>Run a shell script via ScriptPath</summary>
        Script = 3
    }

    /// <summary>
    /// Action to perform when a cron job fires
    /// </summary>
    public enum CronAction
    {
        /// <summary>Start and let run</summary>
        Start = 0,
        /// <summary>Start, wait for exit</summary>
        Run = 1,
        /// <summary>Stop then start</summary>
        Restart = 2,
        /// <summary>Stop if running</summary>
        Stop = 3,
        /// <summary>Run ScriptPath directly</summary>
        Script = 4
    }

    /// <summary>
    /// Policy for handling missed schedule executions
    /// </summary>
    public enum CronMissedPolicy
    {
        /// <summary>Don't run missed schedules</summary>
        Skip = 0,
        /// <summary>Run once if missed</summary>
        RunOnce = 1,
        /// <summary>Run all missed (catch up)</summary>
        RunAll = 2
    }

    /// <summary>
    /// Status of a cron job run
    /// </summary>
    public enum CronRunStatus
    {
        Unknown = 0,
        Running = 1,
        Success = 2,
        Failed = 3,
        Timeout = 4,
        Skipped = 5
    }

    /// <summary>
    /// A scheduled job that runs services on cron schedules
    /// </summary>
    public class CronJob
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }

        // Target — exactly one of these is set based on TargetType
        public CronTarget TargetType { get; set; }
        public Guid? AppId { get; set; }
        public Guid? ServiceId { get; set; }
        public Guid? GroupId { get; set; }
        public string? ScriptPath { get; set; }

        // Schedule
        public string CronExpression { get; set; } = string.Empty;
        public string? Timezone { get; set; }

        // Behavior
        public CronAction Action { get; set; } = CronAction.Start;
        public bool WaitForCompletion { get; set; } = true;
        public int TimeoutSeconds { get; set; } = 3600;
        public CronMissedPolicy MissedPolicy { get; set; } = CronMissedPolicy.RunOnce;

        // Chain
        public Guid? DependsOnJobId { get; set; }
        public CronJob? DependsOnJob { get; set; }

        // State
        public bool IsEnabled { get; set; } = true;
        public DateTime? LastRun { get; set; }
        public DateTime? NextRun { get; set; }
        public CronRunStatus LastRunStatus { get; set; }
        public string? LastRunError { get; set; }
        public int TotalRuns { get; set; }
        public int FailedRuns { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public App? App { get; set; }
        public Service? Service { get; set; }
        public ServiceGroup? Group { get; set; }
        public ICollection<CronJobRun> Runs { get; set; } = new List<CronJobRun>();
    }

    /// <summary>
    /// Record of a single cron job execution
    /// </summary>
    public class CronJobRun
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid JobId { get; set; }
        public CronJob Job { get; set; } = null!;

        public DateTime ScheduledFor { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }

        public CronRunStatus Status { get; set; }
        public int? ExitCode { get; set; }
        public string? Output { get; set; }
        public string? Error { get; set; }
    }
}
