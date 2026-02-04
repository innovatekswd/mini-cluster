using System;
using System.Collections.Generic;

namespace Innovatek.Parallel.MiniCluster.Core.Entities
{
    public class ProxyRoute
    {
        public int Id { get; set; }

        // Basic Info
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Icon { get; set; }
        public string TargetUrl { get; set; } = string.Empty;

        // Path Prefix Mode
        public bool EnablePathPrefix { get; set; }
        public string? PathPrefix { get; set; }
        public bool RewriteUrls { get; set; } = true;
        public bool RewriteWebSocket { get; set; }

        // Subdomain Mode
        public bool EnableSubdomain { get; set; } = true;
        public string? Subdomain { get; set; }

        // Port Mode
        public bool EnablePort { get; set; }
        public int? ProxyPort { get; set; }

        // Iframe Mode
        public bool EnableIframe { get; set; }
        public bool StripXFrameOptions { get; set; } = true;

        // Security
        public bool RequireAuth { get; set; } = true;
        public string? AllowedRoles { get; set; }
        public string? ApiKey { get; set; } // Optional API key for authentication

        // Advanced Options
        public bool PreserveHostHeader { get; set; }
        public int TimeoutSeconds { get; set; } = 30;
        public string? CustomHeaders { get; set; } // JSON serialized Dictionary<string, string>

        // Health Status
        public bool IsHealthy { get; set; } = true;
        public DateTime? LastHealthCheck { get; set; }

        // Metadata
        public bool IsEnabled { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
