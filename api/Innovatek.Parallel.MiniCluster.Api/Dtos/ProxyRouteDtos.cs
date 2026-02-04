using System.ComponentModel.DataAnnotations;

namespace Innovatek.Parallel.MiniCluster.Api.Dtos;

// Create/Update DTO
public class CreateProxyRouteDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }

    [StringLength(50)]
    public string? Icon { get; set; }

    [Required]
    [Url]
    public string TargetUrl { get; set; } = string.Empty;

    // Path Prefix Mode
    public bool EnablePathPrefix { get; set; }

    [StringLength(50)]
    [RegularExpression(@"^[a-z0-9-]+$", ErrorMessage = "Path prefix must be lowercase alphanumeric with dashes only")]
    public string? PathPrefix { get; set; }

    public bool RewriteUrls { get; set; } = true;
    public bool RewriteWebSocket { get; set; }

    // Subdomain Mode
    public bool EnableSubdomain { get; set; } = true;

    [StringLength(50)]
    [RegularExpression(@"^[a-z0-9-]+$", ErrorMessage = "Subdomain must be lowercase alphanumeric with dashes only")]
    public string? Subdomain { get; set; }

    // Port Mode
    public bool EnablePort { get; set; }

    [Range(1024, 65535)]
    public int? ProxyPort { get; set; }

    // Iframe Mode
    public bool EnableIframe { get; set; }
    public bool StripXFrameOptions { get; set; } = true;

    // Security
    public bool RequireAuth { get; set; } = true;
    public List<string>? AllowedRoles { get; set; }

    // Advanced
    [Range(1, 300)]
    public int TimeoutSeconds { get; set; } = 30;

    public bool PreserveHostHeader { get; set; }
    public Dictionary<string, string>? CustomHeaders { get; set; }
}

// Response DTO
public class ProxyRouteDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string TargetUrl { get; set; } = string.Empty;

    // Access Methods
    public PathPrefixConfigDto? PathPrefix { get; set; }
    public SubdomainConfigDto? Subdomain { get; set; }
    public PortConfigDto? Port { get; set; }
    public IframeConfigDto? Iframe { get; set; }

    // Security
    public bool RequireAuth { get; set; }
    public List<string>? AllowedRoles { get; set; }

    // Status
    public bool IsEnabled { get; set; }
    public bool IsHealthy { get; set; }
    public DateTime? LastHealthCheck { get; set; }

    // Metadata
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Generated URLs
    public ProxyUrlsDto? Urls { get; set; }
}

public class PathPrefixConfigDto
{
    public bool Enabled { get; set; }
    public string? Prefix { get; set; }
    public bool RewriteUrls { get; set; }
    public bool RewriteWebSocket { get; set; }
    public string? Url { get; set; }
}

public class SubdomainConfigDto
{
    public bool Enabled { get; set; }
    public string? Subdomain { get; set; }
    public string? Url { get; set; }
}

public class PortConfigDto
{
    public bool Enabled { get; set; }
    public int? Port { get; set; }
    public string? Url { get; set; }
}

public class IframeConfigDto
{
    public bool Enabled { get; set; }
    public bool StripXFrameOptions { get; set; }
    public string? EmbedUrl { get; set; }
}

public class ProxyUrlsDto
{
    public string? PathPrefix { get; set; }
    public string? Subdomain { get; set; }
    public string? Port { get; set; }
    public string? Iframe { get; set; }
    public string? Recommended { get; set; }
}

// Proxy Settings DTOs
public class ProxySettingsDto
{
    public string BaseDomainType { get; set; } = "nip.io";
    public string? CustomBaseDomain { get; set; }
    public int PortRangeStart { get; set; }
    public int PortRangeEnd { get; set; }
    public bool DefaultRequireAuth { get; set; }
    public string? ServerIp { get; set; }
    public string? DetectedServerIp { get; set; }
    public List<int> UsedPorts { get; set; } = new();
}

public class UpdateProxySettingsDto
{
    [RegularExpression(@"^(nip\.io|sslip\.io|custom)$")]
    public string BaseDomainType { get; set; } = "nip.io";

    [StringLength(200)]
    public string? CustomBaseDomain { get; set; }

    [Range(1024, 65535)]
    public int PortRangeStart { get; set; } = 5001;

    [Range(1024, 65535)]
    public int PortRangeEnd { get; set; } = 5099;

    public bool DefaultRequireAuth { get; set; } = true;

    [StringLength(50)]
    public string? ServerIp { get; set; }
}

// Health check response
public class ProxyHealthCheckDto
{
    public bool IsHealthy { get; set; }
    public int? StatusCode { get; set; }
    public long ResponseTimeMs { get; set; }
    public string? Message { get; set; }
    public string? Error { get; set; }
}
