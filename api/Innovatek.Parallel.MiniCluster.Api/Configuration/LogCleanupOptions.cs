using System.ComponentModel.DataAnnotations;

namespace Innovatek.Parallel.MiniCluster.Api.Configuration;

public class LogCleanupOptions
{
    public const string SectionName = "LogCleanup";

    [Range(1, 1440, ErrorMessage = "IntervalMinutes must be between 1 and 1440 (24 hours)")]
    public int IntervalMinutes { get; set; } = 10;

    [Range(1, 8760, ErrorMessage = "RetentionHours must be between 1 and 8760 (1 year)")]
    public int RetentionHours { get; set; } = 24;

    public bool AutoVacuum { get; set; } = true;
}
