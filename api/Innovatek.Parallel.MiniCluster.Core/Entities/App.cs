namespace Innovatek.Parallel.MiniCluster.Core.Entities;

/// <summary>
/// Represents an application grouping for services.
/// Phase 1: Simple flat structure - apps contain services (no hierarchy yet).
/// </summary>
public class App
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; } // Emoji or icon identifier
    public string? Color { get; set; } // Hex color for UI theming
    public DateTime CreatedAt { get; set; }
    public DateTime ModifiedAt { get; set; }
    public int SortOrder { get; set; }
    
    // Navigation property
    public ICollection<Service> Services { get; set; } = new List<Service>();
}
