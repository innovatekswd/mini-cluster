using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    public class ControlledAppBase
    {
        public string Name { get; set; } = string.Empty;
        public string ExecutablePath { get; set; } = string.Empty;
        public string? Arguments { get; set; }
        public Dictionary<string, string> EnvironmentVariables { get; set; } = new();
        public bool AutoStart { get; set; } = false;
        public string? WorkingDirectory { get; set; }

        // New property: AccessLink - URL to access the service directly.
        public string? AccessLink { get; set; }

        // New property: IsExternal - flag to indicate this app is run externally.
        public bool IsExternal { get; set; } = false;

        public bool UseShellExecute { get; set; }
        public bool CreateNoWindow { get; set; }
        // 0 = Auto (capture when UseShellExecute=false), 1 = Always capture, 2 = Never capture
        public int CaptureOutput { get; set; } = 0;
    }
    
    public class ControlledApp : ControlledAppBase
    {
        public Guid Id { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;
        
        // ============ Phase 5: Hierarchy Support ============
        
        /// <summary>
        /// Parent app ID for sub-apps (null = top-level app)
        /// </summary>
        public Guid? ParentAppId { get; set; }
        
        /// <summary>
        /// Whether this app is a composite (contains services or sub-apps)
        /// </summary>
        public bool IsComposite { get; set; } = false;
        
        /// <summary>
        /// Display order within parent or at root level
        /// </summary>
        public int OrderIndex { get; set; } = 0;
        
        /// <summary>
        /// Optional description
        /// </summary>
        public string? Description { get; set; }
        
        /// <summary>
        /// Start mode for cascade operations: 'sequential' or 'parallel'
        /// </summary>
        public string StartMode { get; set; } = "sequential";
        
        // Navigation properties
        public ControlledApp? ParentApp { get; set; }
        public ICollection<ControlledApp> ChildApps { get; set; } = new List<ControlledApp>();
        public ICollection<Service> Services { get; set; } = new List<Service>();
        // Future: App-to-Group assignments when App concept is fully implemented
        // public ICollection<AppGroupAssignment> GroupAssignments { get; set; } = new List<AppGroupAssignment>();
    }
}
