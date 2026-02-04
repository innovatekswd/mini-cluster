using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    public class SessionLogEntry
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        // Foreign key to ServiceSession
        [ForeignKey("ServiceSession")]
        public Guid SessionId { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        // The type of log: stdout, stderr, info, etc.
        public string LogType { get; set; } = "stdout";

        // The actual log message
        public string Line { get; set; } = string.Empty;

        // Navigation property
        public virtual ServiceSession ServiceSession { get; set; } = null!;
    }
}
