using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    public class ServiceSession
    {
        [Key]
        public Guid SessionId { get; set; } = Guid.NewGuid();

        // Reference to the service
        public Guid ServiceId { get; set; }

        // When the session started and ended
        public DateTime StartTimestamp { get; set; } = DateTime.UtcNow;
        public DateTime? EndTimestamp { get; set; }

        // Indicator if the session was auto-started
        public bool AutoStart { get; set; }

        // Exit reason or exit code if applicable
        public string? ExitReason { get; set; }
        public int? ExitCode { get; set; }

        // Working directory from where the service was launched
        public string? WorkingDirectory { get; set; }

        // Environment variables snapshot, stored as JSON
        public string? EnvironmentSnapshot { get; set; }

        // Command line arguments passed at startup
        public string? CommandLineArguments { get; set; }

        // Navigation property (each session may have many logs)
        public virtual ICollection<SessionLogEntry> LogEntries { get; set; } = new List<SessionLogEntry>();
    }
}
