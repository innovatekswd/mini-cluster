namespace Innovatek.Parallel.MiniCluster.Core.Entities;


public class ServiceFile
{
    public Guid Id { get; set; }
    public Guid ServiceId { get; set; } // Foreign key to Service
    public required string Name { get; set; } // User-friendly name for the file
    public required string FilePath { get; set; } // File path with variables (resolve at access time)
    public DateTime CreatedAt { get; set; }
    public DateTime ModifiedAt { get; set; }
}
