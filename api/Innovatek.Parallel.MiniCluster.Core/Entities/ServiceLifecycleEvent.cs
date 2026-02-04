namespace Innovatek.Parallel.MiniCluster.Core.Entities;

public enum ServiceLifecycleEventType
{
    Started,
    Stopped,
    Restarted,
    Failed
}

public class ServiceLifecycleEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ServiceId { get; set; }
    public ServiceLifecycleEventType EventType { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? TriggeredBy { get; set; } // e.g. "manual", "auto"
    public int? ExitCode { get; set; } // If available
}
