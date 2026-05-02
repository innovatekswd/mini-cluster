using System;
using System.Collections.Generic;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    // ── Enums ────────────────────────────────────────────────────────────────

    public enum AlertMetric
    {
        // System-wide
        SystemCpuPercent = 0,
        SystemMemoryPercent = 1,
        SystemDiskPercent = 2,

        // Per-service
        ProcessCpuPercent = 10,
        ProcessMemoryMb = 11,
        ProcessThreadCount = 12,
        ProcessRestartCount = 13,
        ProcessNotResponding = 14,
    }

    public enum AlertOperator
    {
        GreaterThan = 0,
        GreaterThanOrEqual = 1,
        LessThan = 2,
        LessThanOrEqual = 3,
        Equals = 4,
        NotEquals = 5,
    }

    public enum AlertSeverity
    {
        Info = 0,
        Warning = 1,
        Critical = 2,
    }

    public enum AlertEventType
    {
        Triggered = 0,
        Resolved = 1,
        Acknowledged = 2,
    }

    public enum NotificationChannelType
    {
        Webhook = 0,
        Email = 1,
        SignalR = 2,
    }

    // ── Entities ─────────────────────────────────────────────────────────────

    /// <summary>
    /// A threshold-based alerting rule evaluated against live metrics.
    /// </summary>
    public class AlertRule
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }

        // Scope: null = system-wide
        public Guid? ServiceId { get; set; }
        public Guid? AppId { get; set; }

        // Condition
        public AlertMetric Metric { get; set; }
        public AlertOperator Operator { get; set; }
        public double Threshold { get; set; }
        public int DurationSeconds { get; set; } = 0;

        // Behavior
        public bool IsEnabled { get; set; } = true;
        public int CooldownMinutes { get; set; } = 5;
        public AlertSeverity Severity { get; set; } = AlertSeverity.Warning;

        // "all" or comma-separated NotificationChannel IDs
        public string NotifyChannels { get; set; } = "all";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastTriggeredAt { get; set; }
        public int TriggerCount { get; set; } = 0;
    }

    /// <summary>
    /// Recorded event each time an alert rule fires, resolves, or is acknowledged.
    /// </summary>
    public class AlertEvent
    {
        public long Id { get; set; }
        public int AlertRuleId { get; set; }
        public AlertRule AlertRule { get; set; } = null!;

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public AlertEventType EventType { get; set; }
        public double Value { get; set; }
        public double Threshold { get; set; }
        public string? Message { get; set; }
        // JSON — per-channel delivery results
        public string? NotificationResults { get; set; }
    }

    /// <summary>
    /// A configured notification endpoint (webhook, email, or SignalR push).
    /// </summary>
    public class NotificationChannel
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public NotificationChannelType Type { get; set; }
        public bool IsEnabled { get; set; } = true;

        // Webhook
        public string? WebhookUrl { get; set; }
        public string? WebhookHeaders { get; set; }  // JSON
        public string? WebhookTemplate { get; set; } // JSON body template with {{placeholders}}

        // Email
        public string? EmailTo { get; set; }         // comma-separated
        public string? EmailSubjectTemplate { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
