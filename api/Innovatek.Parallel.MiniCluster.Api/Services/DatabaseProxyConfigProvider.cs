using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Primitives;
using Yarp.ReverseProxy.Configuration;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

public interface IProxyConfigNotifier
{
    void NotifyConfigChanged();
}

public class DatabaseProxyConfigProvider : IProxyConfigProvider, IProxyConfigNotifier, IDisposable
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DatabaseProxyConfigProvider> _logger;
    private CancellationTokenSource _cts = new();
    private IProxyConfig? _config;
    private bool _disposed;
    private readonly object _lock = new();

    public DatabaseProxyConfigProvider(
        IServiceProvider serviceProvider,
        ILogger<DatabaseProxyConfigProvider> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public IProxyConfig GetConfig()
    {
        if (_config == null)
        {
            _config = BuildConfig();
        }
        return _config;
    }

    public void NotifyConfigChanged()
    {
        lock (_lock)
        {
            if (_disposed) return;
            
            _logger.LogInformation("Proxy config change notification received, reloading...");
            var oldCts = _cts;
            _cts = new CancellationTokenSource();
            _config = BuildConfig();
            
            try { oldCts.Cancel(); } catch { }
            try { oldCts.Dispose(); } catch { }
        }
    }

    private IProxyConfig BuildConfig()
    {
        var routes = new List<RouteConfig>();
        var clusters = new List<ClusterConfig>();

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var proxyRoutes = db.ProxyRoutes.Where(r => r.IsEnabled).ToList();
            var settings = db.ProxySettings.FirstOrDefault() ?? new ProxySettings();

            foreach (var route in proxyRoutes)
            {
                var clusterId = $"cluster-{route.Id}";

                // Create cluster for this route
                clusters.Add(new ClusterConfig
                {
                    ClusterId = clusterId,
                    Destinations = new Dictionary<string, DestinationConfig>
                    {
                        { "destination1", new DestinationConfig { Address = route.TargetUrl } }
                    },
                    HttpRequest = new Yarp.ReverseProxy.Forwarder.ForwarderRequestConfig
                    {
                        ActivityTimeout = TimeSpan.FromSeconds(route.TimeoutSeconds)
                    }
                });

                // Path Prefix Route
                if (route.EnablePathPrefix && !string.IsNullOrEmpty(route.PathPrefix))
                {
                    var transforms = new List<Dictionary<string, string>>
                    {
                        new() { { "PathRemovePrefix", $"/proxy/{route.PathPrefix}" } },
                        new() { { "RequestHeader", "X-Forwarded-Prefix" }, { "Set", $"/proxy/{route.PathPrefix}" } }
                    };

                    // Strip X-Frame-Options for iframe mode
                    if (route.EnableIframe && route.StripXFrameOptions)
                    {
                        transforms.Add(new() { { "ResponseHeaderRemove", "X-Frame-Options" } });
                        transforms.Add(new() { { "ResponseHeaderRemove", "Content-Security-Policy" } });
                    }

                    routes.Add(new RouteConfig
                    {
                        RouteId = $"route-path-{route.Id}",
                        ClusterId = clusterId,
                        Match = new RouteMatch
                        {
                            Path = $"/proxy/{route.PathPrefix}/{{**catch-all}}"
                        },
                        Transforms = transforms,
                        Metadata = new Dictionary<string, string>
                        {
                            { "ProxyRouteId", route.Id.ToString() },
                            { "RequireAuth", route.RequireAuth.ToString() },
                            { "AllowedRoles", route.AllowedRoles ?? "" }
                        }
                    });

                    // Also handle exact path without trailing slash
                    routes.Add(new RouteConfig
                    {
                        RouteId = $"route-path-exact-{route.Id}",
                        ClusterId = clusterId,
                        Match = new RouteMatch
                        {
                            Path = $"/proxy/{route.PathPrefix}"
                        },
                        Transforms = transforms,
                        Metadata = new Dictionary<string, string>
                        {
                            { "ProxyRouteId", route.Id.ToString() },
                            { "RequireAuth", route.RequireAuth.ToString() },
                            { "AllowedRoles", route.AllowedRoles ?? "" }
                        }
                    });
                }

                // Subdomain Route
                if (route.EnableSubdomain && !string.IsNullOrEmpty(route.Subdomain))
                {
                    var transforms = new List<Dictionary<string, string>>();

                    if (route.EnableIframe && route.StripXFrameOptions)
                    {
                        transforms.Add(new() { { "ResponseHeaderRemove", "X-Frame-Options" } });
                        transforms.Add(new() { { "ResponseHeaderRemove", "Content-Security-Policy" } });
                    }

                    // Match subdomain with wildcard for nip.io/sslip.io patterns
                    routes.Add(new RouteConfig
                    {
                        RouteId = $"route-subdomain-{route.Id}",
                        ClusterId = clusterId,
                        Match = new RouteMatch
                        {
                            Hosts = new[] { $"{route.Subdomain}.*" },
                            Path = "{**catch-all}"
                        },
                        Transforms = transforms.Count > 0 ? transforms : null,
                        Metadata = new Dictionary<string, string>
                        {
                            { "ProxyRouteId", route.Id.ToString() },
                            { "RequireAuth", route.RequireAuth.ToString() },
                            { "AllowedRoles", route.AllowedRoles ?? "" }
                        }
                    });
                }
            }

            _logger.LogInformation("Built proxy config with {RouteCount} routes and {ClusterCount} clusters",
                routes.Count, clusters.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error building proxy config from database");
        }

        return new InMemoryProxyConfig(routes, clusters, new CancellationChangeToken(_cts.Token));
    }

    public void Dispose()
    {
        lock (_lock)
        {
            if (_disposed) return;
            _disposed = true;
            
            try { _cts.Cancel(); } catch { }
            try { _cts.Dispose(); } catch { }
        }
    }
}

internal class InMemoryProxyConfig : IProxyConfig
{
    public IReadOnlyList<RouteConfig> Routes { get; }
    public IReadOnlyList<ClusterConfig> Clusters { get; }
    public IChangeToken ChangeToken { get; }

    public InMemoryProxyConfig(
        IReadOnlyList<RouteConfig> routes,
        IReadOnlyList<ClusterConfig> clusters,
        IChangeToken changeToken)
    {
        Routes = routes;
        Clusters = clusters;
        ChangeToken = changeToken;
    }
}
