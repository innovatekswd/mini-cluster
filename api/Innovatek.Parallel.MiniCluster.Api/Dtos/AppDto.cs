namespace Innovatek.Parallel.MiniCluster.Api.Dtos;

/// <summary>
/// DTO for Application entity (not to be confused with Service/ControlledApp)
/// </summary>
public record ApplicationDto
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public string Slug { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? Icon { get; init; }
    public string? Color { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime ModifiedAt { get; init; }
    public int SortOrder { get; init; }
}

public record ApplicationWithStatsDto : ApplicationDto
{
    public int ServiceCount { get; init; }
    public int RunningCount { get; init; }
    public int StoppedCount { get; init; }
}

public record CreateApplicationDto
{
    public required string Name { get; init; }
    public string? Description { get; init; }
    public string? Icon { get; init; }
    public string? Color { get; init; }
}

public record UpdateApplicationDto
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public string? Icon { get; init; }
    public string? Color { get; init; }
}
