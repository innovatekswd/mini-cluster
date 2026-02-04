using System;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    public class ProxySettings
    {
        public int Id { get; set; } = 1; // Singleton

        // Subdomain Configuration
        public string BaseDomainType { get; set; } = "nip.io"; // "nip.io", "sslip.io", "custom"
        public string? CustomBaseDomain { get; set; }

        // Port Range (for port-based proxies)
        public int PortRangeStart { get; set; } = 5001;
        public int PortRangeEnd { get; set; } = 5099;

        // Security Defaults
        public bool DefaultRequireAuth { get; set; } = true;

        // Server IP (for nip.io URLs)
        public string? ServerIp { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
