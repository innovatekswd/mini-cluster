using System;
using System.Collections.Generic;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    /// <summary>
    /// Represents a logical group for organizing services (e.g., Production, Staging, Databases)
    /// Services can belong to multiple groups (many-to-many relationship)
    /// </summary>
    public class ServiceGroup
    {
        public Guid Id { get; set; }
        
        /// <summary>
        /// Group name (e.g., "Production", "Databases", "Web Servers")
        /// </summary>
        public string Name { get; set; } = string.Empty;
        
        /// <summary>
        /// Optional description
        /// </summary>
        public string? Description { get; set; }
        
        /// <summary>
        /// Icon (emoji or icon name)
        /// </summary>
        public string? Icon { get; set; }
        
        /// <summary>
        /// Color for UI display (hex)
        /// </summary>
        public string? Color { get; set; }
        
        /// <summary>
        /// Parent group ID for hierarchical groups (optional)
        /// </summary>
        public Guid? ParentGroupId { get; set; }
        
        /// <summary>
        /// Display order
        /// </summary>
        public int OrderIndex { get; set; } = 0;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;
        
        // Navigation properties
        public ServiceGroup? ParentGroup { get; set; }
        public ICollection<ServiceGroup> ChildGroups { get; set; } = new List<ServiceGroup>();
        public ICollection<ServiceGroupAssignment> ServiceAssignments { get; set; } = new List<ServiceGroupAssignment>();
    }
    
    /// <summary>
    /// Join table for Service-Group many-to-many relationship
    /// </summary>
    public class ServiceGroupAssignment
    {
        public Guid ServiceId { get; set; }
        public Guid GroupId { get; set; }
        
        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
        
        // Navigation properties
        public Service? Service { get; set; }
        public ServiceGroup? Group { get; set; }
    }
    
    /// <summary>
    /// Variables defined at the group level, inherited by services in the group
    /// </summary>
    public class GroupVariable
    {
        public Guid Id { get; set; }
        
        public Guid GroupId { get; set; }
        
        /// <summary>
        /// Variable key (e.g., "NODE_ENV")
        /// </summary>
        public string Key { get; set; } = string.Empty;
        
        /// <summary>
        /// Variable value (e.g., "production")
        /// </summary>
        public string? Value { get; set; }
        
        /// <summary>
        /// Whether this is a secret (should be masked in UI)
        /// </summary>
        public bool IsSecret { get; set; } = false;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;
        
        // Navigation property
        public ServiceGroup? Group { get; set; }
    }
}
