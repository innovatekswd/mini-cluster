using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Dtos;

public class ConfigExportDto
{
    public string Version { get; set; } = "1.0";
    public DateTime ExportedAt { get; set; }
    public string ExportedBy { get; set; } = "MiniCluster";
    public List<Core.Entities.Environment> Environments { get; set; } = new();
    public List<Service> Services { get; set; } = new();
    public ExportMetadata Metadata { get; set; } = new();
}

public class ExportMetadata
{
    public int TotalServices { get; set; }
    public int TotalEnvironments { get; set; }
}
