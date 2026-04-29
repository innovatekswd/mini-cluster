using Innovatek.Parallel.MiniCluster.Api.Services;
using Microsoft.AspNetCore.SignalR;

namespace Innovatek.Parallel.MiniCluster.Api.Hubs;

public class LogHub : Hub
{
    private readonly ILogRingBufferService _ringBuffer;

    public LogHub(ILogRingBufferService ringBuffer)
    {
        _ringBuffer = ringBuffer;
    }

    // Join per-app group for logs/metrics — replays buffered logs so early output is never missed
    public async Task JoinAppGroup(string appId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, appId);

        // Replay buffered session logs so the client doesn't miss early output
        if (Guid.TryParse(appId, out var serviceId))
        {
            var recentLogs = _ringBuffer.GetRecent(serviceId, 200);
            if (recentLogs.Count > 0)
            {
                var entries = recentLogs.Select(l => new
                {
                    ServiceId = l.SessionId.ToString(), // will be overridden below
                    l.SessionId,
                    Type = l.LogType,
                    l.Timestamp,
                    l.Line,
                }).Select(l => new
                {
                    ServiceId = appId,
                    l.SessionId,
                    l.Type,
                    l.Timestamp,
                    l.Line,
                }).ToList();

                await Clients.Caller.SendAsync("ReplayLogs", entries);
            }
        }
    }

    public Task LeaveAppGroup(string appId)
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, appId);
    }

    // Join system metrics group for overall system monitoring
    public Task JoinSystemMetrics()
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, "system-metrics");
    }

    public Task LeaveSystemMetrics()
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, "system-metrics");
    }

    // Join all metrics group (for task manager view)
    public Task JoinAllMetrics()
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, "metrics");
    }

    public Task LeaveAllMetrics()
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, "metrics");
    }
}
