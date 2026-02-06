using Microsoft.AspNetCore.SignalR;
using Innovatek.Parallel.MiniCluster.Api.Hubs;
using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Sends cluster notifications via SignalR to connected UI clients.
/// v1 implementation — future versions may add webhooks, email, Slack, etc.
/// </summary>
public class ClusterNotificationService : IClusterNotificationService
{
    private readonly IHubContext<LogHub> _hubContext;
    private readonly ILogger<ClusterNotificationService> _logger;

    public ClusterNotificationService(
        IHubContext<LogHub> hubContext,
        ILogger<ClusterNotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task NotifyNodeOfflineAsync(Machine node, CancellationToken ct = default)
    {
        _logger.LogWarning(
            "CLUSTER: Node {Name} ({Host}) went offline. Last seen: {LastSeen}",
            node.Name, node.Host, node.LastSeen);

        await _hubContext.Clients.All.SendAsync("ClusterNotification", new
        {
            type = "node_offline",
            severity = "warning",
            nodeId = node.Id,
            nodeName = node.Name,
            nodeHost = node.Host,
            lastSeen = node.LastSeen,
            timestamp = DateTime.UtcNow,
            message = $"Node '{node.Name}' is offline (last seen: {FormatTimeAgo(node.LastSeen)})"
        }, ct);
    }

    public async Task NotifyNodeRecoveredAsync(Machine node, CancellationToken ct = default)
    {
        _logger.LogInformation(
            "CLUSTER: Node {Name} ({Host}) recovered and is back online.",
            node.Name, node.Host);

        await _hubContext.Clients.All.SendAsync("ClusterNotification", new
        {
            type = "node_recovered",
            severity = "info",
            nodeId = node.Id,
            nodeName = node.Name,
            nodeHost = node.Host,
            timestamp = DateTime.UtcNow,
            message = $"Node '{node.Name}' is back online"
        }, ct);
    }

    public async Task NotifyConfigDriftAsync(Machine node, string appName, CancellationToken ct = default)
    {
        _logger.LogWarning(
            "CLUSTER: Config drift detected on node {Name} for app '{AppName}'",
            node.Name, appName);

        await _hubContext.Clients.All.SendAsync("ClusterNotification", new
        {
            type = "config_drift",
            severity = "warning",
            nodeId = node.Id,
            nodeName = node.Name,
            appName,
            timestamp = DateTime.UtcNow,
            message = $"Config drift detected on node '{node.Name}' for app '{appName}'"
        }, ct);
    }

    private static string FormatTimeAgo(DateTime? time)
    {
        if (!time.HasValue) return "never";
        var ago = DateTime.UtcNow - time.Value;
        if (ago.TotalSeconds < 60) return $"{(int)ago.TotalSeconds}s ago";
        if (ago.TotalMinutes < 60) return $"{(int)ago.TotalMinutes}m ago";
        return $"{(int)ago.TotalHours}h ago";
    }
}
