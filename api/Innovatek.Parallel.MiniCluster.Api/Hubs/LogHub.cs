using Microsoft.AspNetCore.SignalR;

namespace Innovatek.Parallel.MiniCluster.Api.Hubs;

public class LogHub : Hub
{
    // Join per-app group for logs/metrics
    public Task JoinAppGroup(string appId)
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, appId);
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
