namespace Innovatek.Parallel.MiniCluster.Core.Entities;

/// <summary>
/// Represents an application grouping for services.
/// Phase 1: Simple flat structure - apps contain services (no hierarchy yet).
/// </summary>
public class App
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    
    /// <summary>
    /// URL-friendly identifier derived from Name. Lowercase, alphanumeric with hyphens.
    /// Used for routing and API paths instead of encoded names. Must be unique.
    /// </summary>
    public required string Slug { get; set; }
    
    public string? Description { get; set; }
    public string? Icon { get; set; } // Emoji or icon identifier
    public string? Color { get; set; } // Hex color for UI theming
    public DateTime CreatedAt { get; set; }
    public DateTime ModifiedAt { get; set; }
    public int SortOrder { get; set; }

    /// <summary>
    /// Parent App ID for nested app hierarchy.
    /// Null = root-level app. Set to another App's Id to create nesting.
    /// </summary>
    public Guid? ParentAppId { get; set; }
    public App? ParentApp { get; set; }
    
    // Navigation properties
    public ICollection<Service> Services { get; set; } = new List<Service>();
    public ICollection<App> ChildApps { get; set; } = new List<App>();
}
