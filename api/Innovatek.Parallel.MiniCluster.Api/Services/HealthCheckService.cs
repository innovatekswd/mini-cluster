using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net.Sockets;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Models;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Provides access to health state for services. Used by controllers and other services.
/// </summary>
public interface IHealthCheckService
{
    /// <summary>Get the current health state of a service</summary>
    ServiceHealthState? GetHealthState(Guid serviceId);

    /// <summary>Get health states for all monitored services</summary>
    Dictionary<Guid, ServiceHealthState> GetAllHealthStates();
}

/// <summary>
/// Background service that runs health check probes against configured services.
/// Supports HTTP, TCP, and Exec probe types.
/// </summary>
public class HealthCheckService : BackgroundService, IHealthCheckService
{
    private readonly ILogger<HealthCheckService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ConcurrentDictionary<Guid, ServiceHealthState> _healthStates = new();
    private readonly HttpClient _httpClient;
    private readonly TimeSpan _pollInterval = TimeSpan.FromSeconds(5); // How often to check if probes need to run

    public HealthCheckService(
        ILogger<HealthCheckService> logger,
        IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        _httpClient = new HttpClient();
    }

    public ServiceHealthState? GetHealthState(Guid serviceId)
    {
        return _healthStates.TryGetValue(serviceId, out var state) ? state : null;
    }

    public Dictionary<Guid, ServiceHealthState> GetAllHealthStates()
    {
        return new Dictionary<Guid, ServiceHealthState>(_healthStates);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Health check service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunHealthChecks(stoppingToken);
                await Task.Delay(_pollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in health check service loop");
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }

        _logger.LogInformation("Health check service stopped");
    }

    private async Task RunHealthChecks(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var processManager = scope.ServiceProvider.GetRequiredService<IServiceProcessManager>();

        // Get all services with health checks configured
        var services = await db.Services
            .AsNoTracking()
            .Where(s => s.HealthCheckType != HealthCheckType.None && !string.IsNullOrEmpty(s.HealthCheckTarget))
            .ToListAsync(ct);

        var runningStatuses = processManager.GetAllStatuses();

        foreach (var service in services)
        {
            if (ct.IsCancellationRequested) break;

            // Only check health for running services
            if (!runningStatuses.TryGetValue(service.Id, out var status) || status != ServiceRuntimeStatus.Running)
            {
                // Remove health state for non-running services
                _healthStates.TryRemove(service.Id, out _);
                continue;
            }

            var state = _healthStates.GetOrAdd(service.Id, _ => new ServiceHealthState
            {
                ServiceId = service.Id,
                IsHealthy = true // Assume healthy until proven otherwise
            });

            // Check if it's time to run a probe (respect interval)
            if (state.LastCheckAt.HasValue)
            {
                var elapsed = DateTime.UtcNow - state.LastCheckAt.Value;
                if (elapsed.TotalSeconds < service.HealthCheckIntervalSeconds)
                    continue;
            }

            // Check grace period after service start
            var serviceStarted = state.LastCheckAt == null; // First check
            if (serviceStarted)
            {
                // Use a grace period from service config
                // We don't track exact start time here, so the first check is always after the poll interval
                // This is close enough for MVP
            }

            try
            {
                var result = await ExecuteProbe(service, ct);
                UpdateHealthState(state, result, service);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Exception executing health probe for service '{ServiceName}'", service.Name);
                UpdateHealthState(state, new HealthCheckResult
                {
                    ServiceId = service.Id,
                    IsHealthy = false,
                    Message = $"Probe exception: {ex.Message}",
                    CheckType = service.HealthCheckType
                }, service);
            }
        }

        // Clean up health states for services that no longer exist
        var serviceIds = services.Select(s => s.Id).ToHashSet();
        foreach (var staleId in _healthStates.Keys.Where(id => !serviceIds.Contains(id)).ToList())
        {
            _healthStates.TryRemove(staleId, out _);
        }
    }

    private async Task<HealthCheckResult> ExecuteProbe(Service service, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();

        return service.HealthCheckType switch
        {
            HealthCheckType.Http => await ExecuteHttpProbe(service, sw, ct),
            HealthCheckType.Tcp => await ExecuteTcpProbe(service, sw, ct),
            HealthCheckType.Exec => await ExecuteExecProbe(service, sw, ct),
            _ => new HealthCheckResult
            {
                ServiceId = service.Id,
                IsHealthy = true,
                Message = "No health check configured",
                CheckType = service.HealthCheckType
            }
        };
    }

    private async Task<HealthCheckResult> ExecuteHttpProbe(Service service, Stopwatch sw, CancellationToken ct)
    {
        try
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(service.HealthCheckTimeoutSeconds));

            var response = await _httpClient.GetAsync(service.HealthCheckTarget, timeoutCts.Token);
            sw.Stop();

            return new HealthCheckResult
            {
                ServiceId = service.Id,
                IsHealthy = response.IsSuccessStatusCode,
                Message = $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}",
                ResponseTimeMs = (int)sw.ElapsedMilliseconds,
                CheckType = HealthCheckType.Http
            };
        }
        catch (TaskCanceledException)
        {
            sw.Stop();
            return new HealthCheckResult
            {
                ServiceId = service.Id,
                IsHealthy = false,
                Message = $"HTTP probe timed out after {service.HealthCheckTimeoutSeconds}s",
                ResponseTimeMs = (int)sw.ElapsedMilliseconds,
                CheckType = HealthCheckType.Http
            };
        }
        catch (HttpRequestException ex)
        {
            sw.Stop();
            return new HealthCheckResult
            {
                ServiceId = service.Id,
                IsHealthy = false,
                Message = $"HTTP probe failed: {ex.Message}",
                ResponseTimeMs = (int)sw.ElapsedMilliseconds,
                CheckType = HealthCheckType.Http
            };
        }
    }

    private async Task<HealthCheckResult> ExecuteTcpProbe(Service service, Stopwatch sw, CancellationToken ct)
    {
        try
        {
            // Parse host:port from target
            var parts = service.HealthCheckTarget!.Split(':', 2);
            var host = parts.Length > 1 ? parts[0] : "localhost";
            if (!int.TryParse(parts.Length > 1 ? parts[1] : parts[0], out var port))
            {
                return new HealthCheckResult
                {
                    ServiceId = service.Id,
                    IsHealthy = false,
                    Message = $"Invalid TCP target format: '{service.HealthCheckTarget}'. Expected 'host:port' or 'port'.",
                    CheckType = HealthCheckType.Tcp
                };
            }

            using var client = new TcpClient();
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(service.HealthCheckTimeoutSeconds));

            await client.ConnectAsync(host, port, timeoutCts.Token);
            sw.Stop();

            return new HealthCheckResult
            {
                ServiceId = service.Id,
                IsHealthy = true,
                Message = $"TCP connection to {host}:{port} succeeded",
                ResponseTimeMs = (int)sw.ElapsedMilliseconds,
                CheckType = HealthCheckType.Tcp
            };
        }
        catch (Exception ex) when (ex is SocketException or TaskCanceledException or OperationCanceledException)
        {
            sw.Stop();
            return new HealthCheckResult
            {
                ServiceId = service.Id,
                IsHealthy = false,
                Message = $"TCP probe failed: {ex.Message}",
                ResponseTimeMs = (int)sw.ElapsedMilliseconds,
                CheckType = HealthCheckType.Tcp
            };
        }
    }

    private async Task<HealthCheckResult> ExecuteExecProbe(Service service, Stopwatch sw, CancellationToken ct)
    {
        try
        {
            // Parse the command - split first word as executable, rest as arguments
            var command = service.HealthCheckTarget!.Trim();
            string fileName;
            string arguments;

            if (OperatingSystem.IsWindows())
            {
                fileName = "cmd.exe";
                arguments = $"/c {command}";
            }
            else
            {
                fileName = "/bin/sh";
                arguments = $"-c \"{command.Replace("\"", "\\\"")}\"";
            }

            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    Arguments = arguments,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                },
                EnableRaisingEvents = true
            };

            process.Start();

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(service.HealthCheckTimeoutSeconds));

            await process.WaitForExitAsync(timeoutCts.Token);
            sw.Stop();

            return new HealthCheckResult
            {
                ServiceId = service.Id,
                IsHealthy = process.ExitCode == 0,
                Message = process.ExitCode == 0
                    ? "Exec probe succeeded (exit code 0)"
                    : $"Exec probe failed (exit code {process.ExitCode})",
                ResponseTimeMs = (int)sw.ElapsedMilliseconds,
                CheckType = HealthCheckType.Exec
            };
        }
        catch (Exception ex) when (ex is TaskCanceledException or OperationCanceledException)
        {
            sw.Stop();
            return new HealthCheckResult
            {
                ServiceId = service.Id,
                IsHealthy = false,
                Message = $"Exec probe timed out after {service.HealthCheckTimeoutSeconds}s",
                ResponseTimeMs = (int)sw.ElapsedMilliseconds,
                CheckType = HealthCheckType.Exec
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new HealthCheckResult
            {
                ServiceId = service.Id,
                IsHealthy = false,
                Message = $"Exec probe failed: {ex.Message}",
                ResponseTimeMs = (int)sw.ElapsedMilliseconds,
                CheckType = HealthCheckType.Exec
            };
        }
    }

    private void UpdateHealthState(ServiceHealthState state, HealthCheckResult result, Service service)
    {
        state.LastCheckAt = DateTime.UtcNow;

        if (result.IsHealthy)
        {
            if (!state.IsHealthy)
            {
                _logger.LogInformation("Service '{ServiceName}' recovered — healthy again", service.Name);
            }

            state.IsHealthy = true;
            state.ConsecutiveFailures = 0;
            state.LastHealthyAt = DateTime.UtcNow;
            state.MarkedUnhealthyAt = null;
            state.LastError = null;
        }
        else
        {
            state.ConsecutiveFailures++;
            state.LastError = result.Message;

            if (state.ConsecutiveFailures >= service.HealthCheckFailureThreshold && state.IsHealthy)
            {
                state.IsHealthy = false;
                state.MarkedUnhealthyAt = DateTime.UtcNow;
                _logger.LogWarning(
                    "Service '{ServiceName}' marked UNHEALTHY after {Failures} consecutive failures: {Error}",
                    service.Name, state.ConsecutiveFailures, result.Message);
            }
            else if (!state.IsHealthy)
            {
                _logger.LogDebug(
                    "Service '{ServiceName}' still unhealthy ({Failures} failures): {Error}",
                    service.Name, state.ConsecutiveFailures, result.Message);
            }
            else
            {
                _logger.LogDebug(
                    "Service '{ServiceName}' health check failed ({Failures}/{Threshold}): {Error}",
                    service.Name, state.ConsecutiveFailures, service.HealthCheckFailureThreshold, result.Message);
            }
        }
    }

    public override void Dispose()
    {
        _httpClient.Dispose();
        base.Dispose();
    }
}
