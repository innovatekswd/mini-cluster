using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Innovatek.Parallel.MiniCluster.Api.Configuration;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Background service that runs when MiniCluster is in agent mode.
/// Registers with the controller on startup and sends periodic heartbeats.
/// </summary>
public class AgentRegistrationService : BackgroundService
{
    private readonly AgentOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IServiceProvider _serviceProvider;
    private readonly IServiceProcessManager _processManager;
    private readonly ILogger<AgentRegistrationService> _logger;
    private Guid? _machineId;

    public AgentRegistrationService(
        IOptions<AgentOptions> options,
        IHttpClientFactory httpClientFactory,
        IServiceProvider serviceProvider,
        IServiceProcessManager processManager,
        ILogger<AgentRegistrationService> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _serviceProvider = serviceProvider;
        _processManager = processManager;
        _logger = logger;
    }

    /// <summary>
    /// Whether this instance is currently registered with a controller.
    /// </summary>
    public bool IsRegistered => _machineId.HasValue;

    /// <summary>
    /// The machine ID assigned by the controller after registration.
    /// </summary>
    public Guid? MachineId => _machineId;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!_options.Enabled)
        {
            _logger.LogDebug("Agent mode is disabled. Skipping registration.");
            return;
        }

        if (string.IsNullOrWhiteSpace(_options.ControllerUrl))
        {
            _logger.LogError("Agent mode is enabled but ControllerUrl is not set. Cannot register.");
            return;
        }

        _logger.LogInformation(
            "Agent mode enabled. Registering with controller at {ControllerUrl}",
            _options.ControllerUrl);

        // Retry registration with exponential backoff
        await RegisterWithRetryAsync(ct);

        if (!_machineId.HasValue)
        {
            _logger.LogError("Failed to register with controller. Agent will continue in standalone mode.");
            return;
        }

        _logger.LogInformation(
            "Registered with controller as machine {MachineId}. Starting heartbeat every {Interval}s.",
            _machineId, _options.HeartbeatIntervalSeconds);

        // Heartbeat loop
        using var timer = new PeriodicTimer(
            TimeSpan.FromSeconds(_options.HeartbeatIntervalSeconds));

        while (await timer.WaitForNextTickAsync(ct))
        {
            await SendHeartbeatAsync(ct);
        }
    }

    private async Task RegisterWithRetryAsync(CancellationToken ct)
    {
        var delays = new[] { 1, 2, 5, 10, 30 }; // seconds

        for (var attempt = 0; attempt <= delays.Length; attempt++)
        {
            try
            {
                _machineId = await RegisterAsync(ct);
                return;
            }
            catch (Exception ex)
            {
                if (attempt < delays.Length)
                {
                    var delay = delays[attempt];
                    _logger.LogWarning(ex,
                        "Registration attempt {Attempt} failed. Retrying in {Delay}s...",
                        attempt + 1, delay);
                    await Task.Delay(TimeSpan.FromSeconds(delay), ct);
                }
                else
                {
                    _logger.LogError(ex,
                        "All registration attempts failed after {Attempts} tries.",
                        delays.Length + 1);
                }
            }
        }
    }

    private async Task<Guid> RegisterAsync(CancellationToken ct)
    {
        var client = CreateClient();
        var systemInfo = CollectSystemInfo();

        var registration = new AgentRegistrationDto
        {
            Name = _options.Name ?? Environment.MachineName,
            Endpoint = GetSelfEndpoint(),
            SystemInfo = systemInfo,
            Labels = _options.Labels
        };

        var response = await client.PostAsJsonAsync("/api/cluster/register", registration, ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<AgentRegistrationResultDto>(
            cancellationToken: ct);

        return result!.MachineId;
    }

    private async Task SendHeartbeatAsync(CancellationToken ct)
    {
        try
        {
            var client = CreateClient();
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var apps = await db.Apps
                .Include(a => a.Services)
                .ToListAsync(ct);

            var heartbeat = new HeartbeatDto
            {
                MachineId = _machineId!.Value,
                Status = "online",
                Timestamp = DateTime.UtcNow,
                Metrics = CollectMetrics(),
                Apps = apps.Select(a => new HeartbeatAppSummary
                {
                    AppId = a.Id,
                    Name = a.Name,
                    ServiceCount = a.Services.Count,
                    RunningServiceCount = a.Services.Count(s =>
                        _processManager.GetStatus(s.Id) == ServiceRuntimeStatus.Running),
                    ConfigHash = ConfigHasher.ComputeAppHash(a)
                }).ToList()
            };

            var response = await client.PostAsJsonAsync("/api/cluster/heartbeat", heartbeat, ct);
            response.EnsureSuccessStatusCode();

            var ack = await response.Content.ReadFromJsonAsync<HeartbeatAckDto>(
                cancellationToken: ct);

            if (ack?.PendingCommands.Count > 0)
            {
                _logger.LogInformation(
                    "Received {Count} pending commands from controller (Phase 2+)",
                    ack.PendingCommands.Count);
                // Phase 2 will process commands here
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Failed to send heartbeat to controller at {Url}. " +
                "Will retry in {Interval}s. Agent continues operating independently.",
                _options.ControllerUrl, _options.HeartbeatIntervalSeconds);
        }
    }

    private HttpClient CreateClient()
    {
        var client = _httpClientFactory.CreateClient("Controller");
        client.BaseAddress = new Uri(_options.ControllerUrl.TrimEnd('/'));
        client.DefaultRequestHeaders.Add("X-Agent-Api-Key", _options.ApiKey);
        client.Timeout = TimeSpan.FromSeconds(10);
        return client;
    }

    private string GetSelfEndpoint()
    {
        if (!string.IsNullOrWhiteSpace(_options.AdvertiseEndpoint))
            return _options.AdvertiseEndpoint;

        // Default: assume same port as bound, use hostname
        var hostname = Environment.MachineName;
        return $"http://{hostname}:5147";
    }

    private static AgentSystemInfoDto CollectSystemInfo()
    {
        return new AgentSystemInfoDto
        {
            Os = RuntimeInformation.OSDescription,
            Architecture = RuntimeInformation.OSArchitecture.ToString(),
            Framework = RuntimeInformation.FrameworkDescription,
            Hostname = Environment.MachineName,
            AgentVersion = GetVersion(),
            CpuCores = Environment.ProcessorCount,
            TotalMemoryBytes = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes,
            TotalDiskBytes = 0 // Populated on heartbeats with actual values
        };
    }

    private static HeartbeatMetricsDto CollectMetrics()
    {
        var gcInfo = GC.GetGCMemoryInfo();
        return new HeartbeatMetricsDto
        {
            CpuUsagePercent = 0, // Platform-specific; can enhance later
            MemoryUsedBytes = GC.GetTotalMemory(false),
            MemoryTotalBytes = gcInfo.TotalAvailableMemoryBytes,
            DiskUsedBytes = 0,
            DiskTotalBytes = 0
        };
    }

    private static string GetVersion()
    {
        var assembly = System.Reflection.Assembly.GetExecutingAssembly();
        var version = assembly.GetName().Version;
        return version?.ToString() ?? "0.0.0";
    }
}
