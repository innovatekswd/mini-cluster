namespace Innovatek.Parallel.MiniCluster.Api.Dtos;

public class AppResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
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
    public DateTime CreatedAt { get; set; }
    public DateTime ModifiedAt { get; set; }
    
    // Phase 5: Hierarchy support
    public Guid? ParentAppId { get; set; }
    public bool IsComposite { get; set; }
    public int OrderIndex { get; set; }
    public string? Description { get; set; }
    public string StartMode { get; set; } = "sequential";
    
    // Computed fields for hierarchy view
    public int ServiceCount { get; set; }
    public int RunningServiceCount { get; set; }
    public int ChildCount { get; set; }  // Alias for ChildAppCount
    public int ChildAppCount { get; set; }
    public List<string> GroupNames { get; set; } = new();
    public List<Guid> GroupIds { get; set; } = new();
    public int MachineCount { get; set; }
}

/// <summary>
/// Extended app response with nested children and services
/// </summary>
public class AppWithChildrenDto : AppResponseDto
{
    public List<AppWithChildrenDto> ChildApps { get; set; } = new();
    public List<Phase5ServiceDto> Services { get; set; } = new();
}
