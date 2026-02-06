using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    public class Environment
    {
        public Guid Id { get; set; }
        public required string Name { get; set; }
        public required string Slug { get; set; }
        public string? Description { get; set; }

        // Dictionary-based variable storage (from branch)
        public Dictionary<string, string> Variables { get; set; } = new();

        public bool IsActive { get; set; }
    }
}
