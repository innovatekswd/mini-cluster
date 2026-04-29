namespace Innovatek.Parallel.MiniCluster.Api.Models;

public class LogSearchRequest
{
    public string? Query { get; set; }
    public string? Type { get; set; } // "stdout", "stderr"
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;
    /// <summary>
    /// "latest" (default) = most recent session, "all" = search across all sessions, or a specific GUID
    /// </summary>
    public string? SessionId { get; set; }
}
