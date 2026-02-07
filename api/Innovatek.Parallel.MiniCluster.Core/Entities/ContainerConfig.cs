using System;
using System.Collections.Generic;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    /// <summary>
    /// Type of service: native process or container
    /// </summary>
    public enum ServiceType
    {
        /// <summary>Native OS process (default)</summary>
        Process = 0,
        /// <summary>Docker container</summary>
        Docker = 1,
        /// <summary>Podman container (rootless)</summary>
        Podman = 2
    }

    /// <summary>
    /// Container restart policy
    /// </summary>
    public enum ContainerRestartPolicy
    {
        No = 0,
        OnFailure = 1,
        Always = 2,
        UnlessStopped = 3
    }

    /// <summary>
    /// Container configuration for services running as Docker/Podman containers.
    /// Only used when Service.ServiceType is Docker or Podman.
    /// </summary>
    public class ContainerConfig
    {
        public int Id { get; set; }
        public Guid ServiceId { get; set; }
        public Service Service { get; set; } = null!;

        // Image
        public string Image { get; set; } = string.Empty;
        public string? Tag { get; set; } = "latest";
        public string? Registry { get; set; }

        // Container settings
        public string? ContainerName { get; set; }
        public string? Hostname { get; set; }
        public string? NetworkMode { get; set; }
        public bool Privileged { get; set; }
        public string? User { get; set; }

        // Resource limits
        public long? MemoryLimitBytes { get; set; }
        public double? CpuLimit { get; set; }

        // Port mappings stored as JSON: [{"host":8080,"container":80,"protocol":"tcp"}]
        public string? PortMappings { get; set; }

        // Volume mounts stored as JSON: [{"host":"/data","container":"/app/data","readOnly":false}]
        public string? VolumeMounts { get; set; }

        // Extra container labels stored as JSON
        public string? Labels { get; set; }

        // Container restart policy (separate from service-level restart)
        public ContainerRestartPolicy RestartPolicy { get; set; } = ContainerRestartPolicy.No;

        // Runtime state
        public string? ContainerId { get; set; }
        public string? ImageId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;
    }
}
