namespace Innovatek.Parallel.MiniCluster.Api.Dtos;

/// <summary>
/// Response DTO for service data
/// </summary>
public class ServiceResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = string.Empty;
    public string ExecutablePath { get; set; } = default!;
    public string? Arguments { get; set; }
    public Dictionary<string, string> EnvironmentVariables { get; set; } = new();
    public bool AutoStart { get; set; }
    public string? WorkingDirectory { get; set; }
    public string? AccessLink { get; set; }
    public bool IsExternal { get; set; }
    public bool UseShellExecute { get; set; }
    public bool CreateNoWindow { get; set; }
    public int CaptureOutput { get; set; }
    public string? Description { get; set; }
    public int OrderIndex { get; set; }
    public Guid? AppId { get; set; }
    
    /// <summary>
    /// Runtime status of the service (stopped, starting, running, stopping, failed)
    /// </summary>
    public string Status { get; set; } = "stopped";
    
    public DateTime CreatedAt { get; set; }
    public DateTime ModifiedAt { get; set; }
}
