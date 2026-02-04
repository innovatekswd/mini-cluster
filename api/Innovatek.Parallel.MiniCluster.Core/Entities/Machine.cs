using System;
using System.Collections.Generic;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    /// <summary>
    /// Represents a physical or virtual machine where services can run.
    /// </summary>
    public class Machine
    {
        public Guid Id { get; set; }
        
        /// <summary>
        /// Display name for the machine (e.g., "prod-vm-1", "localhost")
        /// </summary>
        public string Name { get; set; } = string.Empty;
        
        /// <summary>
        /// IP address or hostname (e.g., "192.168.1.10", "localhost")
        /// </summary>
        public string? Host { get; set; }
        
        /// <summary>
        /// SSH port for remote connections (default: 22)
        /// </summary>
        public int Port { get; set; } = 22;
        
        /// <summary>
        /// Connection type: 'local', 'ssh', 'agent'
        /// </summary>
        public string ConnectionType { get; set; } = "local";
        
        /// <summary>
        /// SSH username for remote connections
        /// </summary>
        public string? SshUsername { get; set; }
        
        /// <summary>
        /// Path to SSH private key for authentication
        /// </summary>
        public string? SshKeyPath { get; set; }
        
        /// <summary>
        /// SSH password (encrypted) - alternative to key auth
        /// </summary>
        public string? SshPassword { get; set; }
        
        /// <summary>
        /// Current status: 'online', 'offline', 'degraded', 'unknown'
        /// </summary>
        public string Status { get; set; } = "unknown";
        
        /// <summary>
        /// Last time the machine was seen/pinged
        /// </summary>
        public DateTime? LastSeen { get; set; }
        
        /// <summary>
        /// JSON metadata: OS info, CPU cores, RAM, etc.
        /// </summary>
        public string? Metadata { get; set; }
        
        /// <summary>
        /// Display order in UI
        /// </summary>
        public int OrderIndex { get; set; } = 0;
        
        /// <summary>
        /// Whether this is the local machine (auto-registered)
        /// </summary>
        public bool IsLocal { get; set; } = false;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;
        
        // Navigation property
        public ICollection<Service> Services { get; set; } = new List<Service>();
    }
}
