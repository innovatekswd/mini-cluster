using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Sends cluster notifications (node offline, node recovered, drift detected).
/// v1 sends notifications via SignalR to connected UI clients.
/// </summary>
public interface IClusterNotificationService
{
    /// <summary>
    /// Notify that a node has gone offline.
    /// </summary>
    Task NotifyNodeOfflineAsync(Machine node, CancellationToken ct = default);

    /// <summary>
    /// Notify that a previously offline node has recovered.
    /// </summary>
    Task NotifyNodeRecoveredAsync(Machine node, CancellationToken ct = default);

    /// <summary>
    /// Notify that config drift was detected on a node.
    /// </summary>
    Task NotifyConfigDriftAsync(Machine node, string appName, CancellationToken ct = default);
}
