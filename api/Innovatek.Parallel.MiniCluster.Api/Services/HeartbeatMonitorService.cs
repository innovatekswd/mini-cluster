using Microsoft.EntityFrameworkCore;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Background service that runs on the controller node.
/// Periodically checks agent heartbeats and marks nodes offline if they miss heartbeats.
/// Implements v1 offline policy: notification only, no automatic rescheduling.
/// </summary>
public class HeartbeatMonitorService : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan OfflineThreshold = TimeSpan.FromSeconds(90); // 3 missed 30s heartbeats

    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<HeartbeatMonitorService> _logger;

    public HeartbeatMonitorService(
        IServiceProvider serviceProvider,
        ILogger<HeartbeatMonitorService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _logger.LogInformation(
            "Heartbeat monitor started. Checking every {Interval}s, offline threshold: {Threshold}s",
            CheckInterval.TotalSeconds, OfflineThreshold.TotalSeconds);

        // Wait a bit for initial startup before monitoring
        await Task.Delay(TimeSpan.FromSeconds(10), ct);

        using var timer = new PeriodicTimer(CheckInterval);
        while (await timer.WaitForNextTickAsync(ct))
        {
            try
            {
                await CheckNodeHealthAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during heartbeat health check");
            }
        }
    }

    private async Task CheckNodeHealthAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notifier = scope.ServiceProvider.GetRequiredService<IClusterNotificationService>();

        // Only check agent-type machines (not local, not SSH)
        var agentNodes = await db.Machines
            .Where(m => !m.IsLocal && m.ConnectionType == "agent")
            .ToListAsync(ct);

        if (agentNodes.Count == 0) return;

        var now = DateTime.UtcNow;
        var changesDetected = false;

        foreach (var node in agentNodes)
        {
            var timeSinceLastSeen = node.LastSeen.HasValue
                ? now - node.LastSeen.Value
                : TimeSpan.MaxValue;

            if (node.Status == "online" && timeSinceLastSeen > OfflineThreshold)
            {
                // Node was online but missed heartbeats — mark offline
                var previousStatus = node.Status;
                node.Status = "offline";
                node.ModifiedAt = now;
                changesDetected = true;

                _logger.LogWarning(
                    "Node {Name} ({Host}) marked OFFLINE. " +
                    "Last seen: {LastSeen} ({TimeSince}s ago)",
                    node.Name, node.Host, node.LastSeen,
                    (int)timeSinceLastSeen.TotalSeconds);

                // Notification only — no automatic rescheduling in v1
                await notifier.NotifyNodeOfflineAsync(node, ct);
            }
            else if (node.Status == "offline" && timeSinceLastSeen <= OfflineThreshold)
            {
                // Node was offline but heartbeat resumed — it recovered
                node.Status = "online";
                node.ModifiedAt = now;
                changesDetected = true;

                _logger.LogInformation(
                    "Node {Name} ({Host}) recovered — back ONLINE.",
                    node.Name, node.Host);

                await notifier.NotifyNodeRecoveredAsync(node, ct);
            }
        }

        if (changesDetected)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}
