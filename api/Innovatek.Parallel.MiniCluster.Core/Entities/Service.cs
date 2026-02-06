using System;
using System.Collections.Generic;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    /// <summary>
    /// Base class with common service properties (for import/export scenarios)
    /// </summary>
    public class ServiceBase
    {
        public string Name { get; set; } = string.Empty;
        
        /// <summary>
        /// URL-friendly identifier derived from Name. Lowercase, alphanumeric with hyphens.
        /// Used for routing and API paths instead of encoded names. Must be unique within an app.
        /// </summary>
        public required string Slug { get; set; }
        
        public string ExecutablePath { get; set; } = string.Empty;
        public string? Arguments { get; set; }
        public Dictionary<string, string> EnvironmentVariables { get; set; } = new();
        public bool AutoStart { get; set; } = false;
        public string? WorkingDirectory { get; set; }

        /// <summary>
        /// URL to access the service directly (e.g., http://localhost:3000)
        /// </summary>
        public string? AccessLink { get; set; }

        /// <summary>
        /// Flag to indicate this service is managed externally (not started by Control Center)
        /// </summary>
        public bool IsExternal { get; set; } = false;

        public bool UseShellExecute { get; set; }
        public bool CreateNoWindow { get; set; }
        
        /// <summary>
        /// Output capture mode: 0 = Auto, 1 = Always capture, 2 = Never capture
        /// </summary>
        public int CaptureOutput { get; set; } = 0;
    }
    
    /// <summary>
    /// A service is a single runnable process managed by Control Center
    /// </summary>
    public class Service : ServiceBase
    {
        public Guid Id { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;
        
        /// <summary>
        /// Optional description of what this service does
        /// </summary>
        public string? Description { get; set; }
        
        /// <summary>
        /// Display order in the UI
        /// </summary>
        public int OrderIndex { get; set; } = 0;
        
        /// <summary>
        /// Optional App ID for grouping services into apps
        /// </summary>
        public Guid? AppId { get; set; }
        
        /// <summary>
        /// Navigation property to the parent App
        /// </summary>
        public App? App { get; set; }
        
        /// <summary>
        /// Optional Machine ID — which machine this service runs on.
        /// Null means local (the machine running this MiniCluster instance).
        /// </summary>
        public Guid? MachineId { get; set; }
    }
}
