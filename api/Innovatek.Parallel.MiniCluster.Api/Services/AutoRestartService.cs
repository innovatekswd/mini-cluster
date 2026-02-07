using System.Collections.Concurrent;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Hubs;
using Innovatek.Parallel.MiniCluster.Api.Models;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Provides access to restart state for services. Used by controllers to expose restart info.
/// </summary>
public interface IAutoRestartService
{
    /// <summary>Get the restart state of a service</summary>
    ServiceRestartState? GetRestartState(Guid serviceId);

    /// <summary>Get restart states for all tracked services</summary>
    Dictionary<Guid, ServiceRestartState> GetAllRestartStates();

    /// <summary>Mark a service as manually stopped (prevents auto-restart for UnlessStopped policy)</summary>
    void MarkManuallyStopped(Guid serviceId);

    /// <summary>Clear the manually stopped flag (e.g., when user starts the service again)</summary>
    void ClearManuallyStopped(Guid serviceId);

    /// <summary>Reset restart tracking for a service (e.g., after a manual start)</summary>
    void ResetRestartState(Guid serviceId);
}

/// <summary>
/// Background service that monitors service exits and performs auto-restart
/// based on configured restart policies with exponential backoff.
/// Also monitors health check state and restarts unhealthy services.
/// </summary>
public class AutoRestartService : BackgroundService, IAutoRestartService
{
    private readonly ILogger<AutoRestartService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ConcurrentDictionary<Guid, ServiceRestartState> _restartStates = new();
    private readonly ConcurrentDictionary<Guid, DateTime> _pendingRestarts = new();
    private readonly TimeSpan _pollInterval = TimeSpan.FromSeconds(3);

    public AutoRestartService(
        ILogger<AutoRestartService> logger,
        IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
    }

    public ServiceRestartState? GetRestartState(Guid serviceId)
    {
        return _restartStates.TryGetValue(serviceId, out var state) ? state : null;
    }

    public Dictionary<Guid, ServiceRestartState> GetAllRestartStates()
    {
        return new Dictionary<Guid, ServiceRestartState>(_restartStates);
    }

    public void MarkManuallyStopped(Guid serviceId)
    {
        var state = _restartStates.GetOrAdd(serviceId, _ => new ServiceRestartState { ServiceId = serviceId });
        state.ManuallyStopped = true;
        // Remove any pending restart
        _pendingRestarts.TryRemove(serviceId, out _);
    }

    public void ClearManuallyStopped(Guid serviceId)
    {
        if (_restartStates.TryGetValue(serviceId, out var state))
        {
            state.ManuallyStopped = false;
        }
    }

    public void ResetRestartState(Guid serviceId)
    {
        _restartStates.TryRemove(serviceId, out _);
        _pendingRestarts.TryRemove(serviceId, out _);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Auto-restart service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckForExitedServices(stoppingToken);
                await CheckPendingRestarts(stoppingToken);
                await CheckUnhealthyServices(stoppingToken);
                await Task.Delay(_pollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in auto-restart service loop");
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }

        _logger.LogInformation("Auto-restart service stopped");
    }

    /// <summary>
    /// Check for services that have exited and decide whether to restart them
    /// </summary>
    private async Task CheckForExitedServices(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var processManager = scope.ServiceProvider.GetRequiredService<IServiceProcessManager>();

        // Get all services with a restart policy
        var services = await db.Services
            .AsNoTracking()
            .Where(s => s.RestartPolicy != RestartPolicy.Never)
            .ToListAsync(ct);

        var allStatuses = processManager.GetAllStatuses();

        foreach (var service in services)
        {
            if (ct.IsCancellationRequested) break;

            // Skip if service is running or already has a pending restart
            if (allStatuses.TryGetValue(service.Id, out var status) && status == ServiceRuntimeStatus.Running)
                continue;

            if (_pendingRestarts.ContainsKey(service.Id))
                continue;

            var state = _restartStates.GetOrAdd(service.Id, _ => new ServiceRestartState { ServiceId = service.Id });

            // Skip if manually stopped
            if (state.ManuallyStopped && service.RestartPolicy == RestartPolicy.UnlessStopped)
                continue;

            // Skip if in cooldown
            if (state.IsInCooldown)
                continue;

            // Check if we need to determine whether this service should restart
            // We only process services that are stopped but have a restart policy
            if (status == ServiceRuntimeStatus.Stopped || !allStatuses.ContainsKey(service.Id))
            {
                // For "OnFailure" policy, we need to check if it actually failed
                // Since we can't easily check exit code from here, we check if it was running before
                // The HandleExitEvent in ServiceProcessManager already recorded the exit
                if (ShouldRestart(service, state))
                {
                    ScheduleRestart(service, state);
                }
            }
        }
    }

    /// <summary>
    /// Execute any pending restarts whose delay has elapsed
    /// </summary>
    private async Task CheckPendingRestarts(CancellationToken ct)
    {
        foreach (var (serviceId, scheduledAt) in _pendingRestarts.ToArray())
        {
            if (ct.IsCancellationRequested) break;

            if (DateTime.UtcNow >= scheduledAt)
            {
                _pendingRestarts.TryRemove(serviceId, out _);
                await ExecuteRestart(serviceId, ct);
            }
        }
    }

    /// <summary>
    /// Check for services marked unhealthy by the health check service and restart them
    /// </summary>
    private async Task CheckUnhealthyServices(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var healthService = scope.ServiceProvider.GetService<IHealthCheckService>();
        if (healthService == null) return;

        var processManager = scope.ServiceProvider.GetRequiredService<IServiceProcessManager>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var unhealthyStates = healthService.GetAllHealthStates()
            .Where(kv => !kv.Value.IsHealthy)
            .ToList();

        foreach (var (serviceId, healthState) in unhealthyStates)
        {
            if (ct.IsCancellationRequested) break;

            // Skip if already has a pending restart
            if (_pendingRestarts.ContainsKey(serviceId)) continue;

            var service = await db.Services.AsNoTracking().FirstOrDefaultAsync(s => s.Id == serviceId, ct);
            if (service == null) continue;

            // Only restart unhealthy services if they have a restart policy that allows it
            if (service.RestartPolicy == RestartPolicy.Never) continue;

            var restartState = _restartStates.GetOrAdd(serviceId, _ => new ServiceRestartState { ServiceId = serviceId });
            if (restartState.IsInCooldown) continue;
            if (restartState.ManuallyStopped) continue;

            _logger.LogWarning(
                "Service '{ServiceName}' is unhealthy — scheduling restart (policy: {Policy})",
                service.Name, service.RestartPolicy);

            // Stop the unhealthy service first, then schedule restart
            await processManager.StopServiceAsync(serviceId);
            ScheduleRestart(service, restartState);
        }
    }

    private bool ShouldRestart(Service service, ServiceRestartState state)
    {
        switch (service.RestartPolicy)
        {
            case RestartPolicy.Never:
                return false;

            case RestartPolicy.OnFailure:
                // For OnFailure, we always attempt restart since we treat a stopped
                // service (that had a restart policy) as a failure scenario.
                // Manual stops set ManuallyStopped flag which is checked elsewhere.
                return !state.ManuallyStopped;

            case RestartPolicy.Always:
                return true;

            case RestartPolicy.UnlessStopped:
                return !state.ManuallyStopped;

            default:
                return false;
        }
    }

    private void ScheduleRestart(Service service, ServiceRestartState state)
    {
        // Check if we've exceeded max restarts in the window
        if (state.WindowStart.AddSeconds(service.RestartWindowSeconds) < DateTime.UtcNow)
        {
            // Window expired — reset the counter
            state.RestartCount = 0;
            state.WindowStart = DateTime.UtcNow;
        }

        if (state.RestartCount >= service.MaxRestarts)
        {
            // Enter cooldown — wait for the full window to expire
            state.CooldownUntil = DateTime.UtcNow.AddSeconds(service.RestartWindowSeconds);
            _logger.LogWarning(
                "Service '{ServiceName}' hit max restarts ({Max} in {Window}s) — cooldown until {Until:HH:mm:ss}",
                service.Name, service.MaxRestarts, service.RestartWindowSeconds, state.CooldownUntil);
            return;
        }

        state.RestartCount++;
        state.LastRestartAttempt = DateTime.UtcNow;

        var delaySeconds = state.GetNextDelaySeconds(
            service.RestartDelaySeconds,
            service.MaxRestartDelaySeconds,
            service.UseExponentialBackoff);

        var restartAt = DateTime.UtcNow.AddSeconds(delaySeconds);
        _pendingRestarts[service.Id] = restartAt;

        _logger.LogInformation(
            "Scheduling restart for '{ServiceName}' in {Delay}s (attempt {Count}/{Max})",
            service.Name, delaySeconds, state.RestartCount, service.MaxRestarts);
    }

    private async Task ExecuteRestart(Guid serviceId, CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var processManager = scope.ServiceProvider.GetRequiredService<IServiceProcessManager>();
            var hub = scope.ServiceProvider.GetRequiredService<IHubContext<LogHub>>();

            _logger.LogInformation("Auto-restarting service {ServiceId}", serviceId);

            var result = await processManager.StartServiceAsync(serviceId, "auto-restart");
            if (result.Success)
            {
                _logger.LogInformation("Service {ServiceId} auto-restarted successfully", serviceId);

                // Notify clients via SignalR
                await hub.Clients.Group(serviceId.ToString()).SendAsync(
                    "StatusUpdated", serviceId,
                    new { status = "Running", triggeredBy = "auto-restart" }, ct);
            }
            else
            {
                _logger.LogWarning(
                    "Auto-restart failed for service {ServiceId}: {Error}",
                    serviceId, result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception during auto-restart of service {ServiceId}", serviceId);
        }
    }
}
