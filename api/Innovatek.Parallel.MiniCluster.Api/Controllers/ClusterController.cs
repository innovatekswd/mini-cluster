using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Api.Helpers;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

/// <summary>
/// Controller-side endpoints for cluster management.
/// - /api/cluster/register    — Agent registration (API key auth)
/// - /api/cluster/heartbeat   — Agent heartbeats (API key auth)
/// - /api/cluster/status      — Cluster overview (JWT auth)
/// - /api/cluster/nodes/*     — Node management (JWT auth)
/// </summary>
[ApiController]
[Route("api/cluster")]
public class ClusterController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IMachineService _machineService;
    private readonly IServiceProcessManager _processManager;
    private readonly IClusterNotificationService _notifier;
    private readonly ILogger<ClusterController> _logger;

    public ClusterController(
        AppDbContext context,
        IMachineService machineService,
        IServiceProcessManager processManager,
        IClusterNotificationService notifier,
        ILogger<ClusterController> logger)
    {
        _context = context;
        _machineService = machineService;
        _processManager = processManager;
        _notifier = notifier;
        _logger = logger;
    }

    // ── Agent-facing endpoints (API key auth via middleware) ──────────

    /// <summary>
    /// Agent registers itself with the controller.
    /// Authenticated via X-Agent-Api-Key header (middleware).
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous] // API key auth handled by middleware, not JWT
    public async Task<ActionResult<AgentRegistrationResultDto>> Register(
        [FromBody] AgentRegistrationDto dto, CancellationToken ct)
    {
        try
        {
            // The middleware already validated the API key and put the Machine in context
            var machine = HttpContext.Items["AgentMachine"] as Machine;

            if (machine == null)
            {
                // First-time registration with a new API key — create the machine
                // This requires the API key to be pre-registered via MachinesController
                _logger.LogWarning(
                    "Registration from unrecognized API key for agent '{Name}'", dto.Name);
                return Unauthorized(new { error = "API key not recognized. Register the machine first via /api/machines." });
            }

            // Update machine with agent info
            machine.Name = dto.Name;
            machine.AgentEndpoint = dto.Endpoint;
            machine.Host = ExtractHost(dto.Endpoint);
            machine.ConnectionType = "agent";
            machine.Status = "online";
            machine.LastSeen = DateTime.UtcNow;
            machine.AgentVersion = dto.SystemInfo.AgentVersion;
            machine.CpuCores = dto.SystemInfo.CpuCores;
            machine.TotalMemoryBytes = dto.SystemInfo.TotalMemoryBytes;
            machine.TotalDiskBytes = dto.SystemInfo.TotalDiskBytes;
            machine.Labels = dto.Labels.Count > 0
                ? JsonSerializer.Serialize(dto.Labels)
                : null;
            machine.Metadata = JsonSerializer.Serialize(new
            {
                os = dto.SystemInfo.Os,
                arch = dto.SystemInfo.Architecture,
                framework = dto.SystemInfo.Framework,
                hostname = dto.SystemInfo.Hostname
            });
            machine.ModifiedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync(ct);

            _logger.LogInformation(
                "Agent '{Name}' registered successfully (Machine: {Id}, Endpoint: {Endpoint})",
                dto.Name, machine.Id, dto.Endpoint);

            return Ok(new AgentRegistrationResultDto
            {
                MachineId = machine.Id,
                ControllerVersion = GetVersion()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during agent registration");
            return StatusCode(500, "Registration failed");
        }
    }

    /// <summary>
    /// Agent sends periodic heartbeat.
    /// Authenticated via X-Agent-Api-Key header (middleware).
    /// </summary>
    [HttpPost("heartbeat")]
    [AllowAnonymous] // API key auth handled by middleware
    public async Task<ActionResult<HeartbeatAckDto>> Heartbeat(
        [FromBody] HeartbeatDto dto, CancellationToken ct)
    {
        try
        {
            var machine = await _context.Machines
                .FirstOrDefaultAsync(m => m.Id == dto.MachineId, ct);

            if (machine == null)
            {
                return NotFound(new { error = $"Machine {dto.MachineId} not found" });
            }

            // Update machine status
            var previousStatus = machine.Status;
            machine.Status = dto.Status;
            machine.LastSeen = DateTime.UtcNow;
            machine.ModifiedAt = DateTime.UtcNow;

            // Update metrics if provided
            if (dto.Metrics != null)
            {
                machine.TotalMemoryBytes = dto.Metrics.MemoryTotalBytes;
            }

            await _context.SaveChangesAsync(ct);

            // If node was offline and is now reporting, it recovered
            if (previousStatus == "offline" && dto.Status == "online")
            {
                await _notifier.NotifyNodeRecoveredAsync(machine, ct);
            }

            // Return ack with any pending commands (Phase 2+)
            return Ok(new HeartbeatAckDto
            {
                Accepted = true,
                ServerTime = DateTime.UtcNow,
                PendingCommands = new List<PendingCommandDto>() // Phase 2
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing heartbeat from machine {MachineId}", dto.MachineId);
            return StatusCode(500, "Heartbeat processing failed");
        }
    }

    // ── Dashboard/UI-facing endpoints (JWT auth) ─────────────────────

    /// <summary>
    /// Get cluster overview with all node statuses.
    /// </summary>
    [HttpGet("status")]
    [Authorize]
    public async Task<ActionResult<ClusterStatusDto>> GetClusterStatus(CancellationToken ct)
    {
        try
        {
            var machines = await _context.Machines
                .Include(m => m.Services)
                .OrderBy(m => m.OrderIndex)
                .ThenBy(m => m.Name)
                .ToListAsync(ct);

            var status = new ClusterStatusDto
            {
                TotalNodes = machines.Count,
                OnlineNodes = machines.Count(m => m.Status == "online"),
                OfflineNodes = machines.Count(m => m.Status == "offline"),
                DegradedNodes = machines.Count(m => m.Status == "degraded"),
                ControllerVersion = GetVersion(),
                Timestamp = DateTime.UtcNow,
                Nodes = machines.Select(m => new ClusterNodeSummaryDto
                {
                    Id = m.Id,
                    Name = m.Name,
                    Host = m.Host,
                    Status = m.Status,
                    IsLocal = m.IsLocal,
                    ConnectionType = m.ConnectionType,
                    LastSeen = m.LastSeen,
                    AgentVersion = m.AgentVersion,
                    CpuCores = m.CpuCores,
                    TotalMemoryBytes = m.TotalMemoryBytes,
                    ServiceCount = m.Services.Count,
                    RunningServiceCount = m.Services.Count(s =>
                        _processManager.GetStatus(s.Id) == ServiceRuntimeStatus.Running),
                    Labels = !string.IsNullOrEmpty(m.Labels)
                        ? JsonSerializer.Deserialize<Dictionary<string, string>>(m.Labels)
                        : null
                }).ToList()
            };

            return Ok(status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving cluster status");
            return StatusCode(500, "Failed to retrieve cluster status");
        }
    }

    /// <summary>
    /// List all cluster nodes.
    /// </summary>
    [HttpGet("nodes")]
    [Authorize]
    public async Task<ActionResult<List<MachineDto>>> GetNodes(CancellationToken ct)
    {
        var machines = await _machineService.GetAllAsync(ct);
        return Ok(machines);
    }

    /// <summary>
    /// Get a specific node's detail including its services.
    /// </summary>
    [HttpGet("nodes/{id:guid}")]
    [Authorize]
    public async Task<ActionResult<MachineWithServicesDto>> GetNode(Guid id, CancellationToken ct)
    {
        var machine = await _machineService.GetWithServicesAsync(id, ct);
        if (machine == null) return NotFound();
        return Ok(machine);
    }

    /// <summary>
    /// Manually ping a node.
    /// </summary>
    [HttpPost("nodes/{id:guid}/ping")]
    [Authorize]
    public async Task<ActionResult<object>> PingNode(Guid id, CancellationToken ct)
    {
        var machine = await _machineService.GetByIdAsync(id, ct);
        if (machine == null) return NotFound();

        var reachable = await _machineService.PingAsync(id, ct);
        return Ok(new { machineId = id, reachable, timestamp = DateTime.UtcNow });
    }

    /// <summary>
    /// Update node labels or configuration.
    /// </summary>
    [HttpPut("nodes/{id:guid}")]
    [Authorize]
    public async Task<ActionResult<MachineDto>> UpdateNode(
        Guid id, [FromBody] UpdateMachineDto dto, CancellationToken ct)
    {
        var machine = await _machineService.UpdateAsync(id, dto, ct);
        if (machine == null) return NotFound();
        return Ok(machine);
    }

    /// <summary>
    /// Remove a node from the cluster.
    /// </summary>
    [HttpDelete("nodes/{id:guid}")]
    [Authorize]
    public async Task<ActionResult> RemoveNode(Guid id, CancellationToken ct)
    {
        try
        {
            var deleted = await _machineService.DeleteAsync(id, ct);
            if (!deleted) return NotFound();
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Generate a new API key for registering an agent.
    /// Returns the plain key (shown once) and stores the hash.
    /// </summary>
    [HttpPost("generate-key")]
    [Authorize]
    public ActionResult<object> GenerateApiKey()
    {
        var plainKey = ConfigHasher.GenerateApiKey();
        var hashedKey = ConfigHasher.HashApiKey(plainKey);

        return Ok(new
        {
            apiKey = plainKey,
            hashedKey,
            note = "Save this API key now — it cannot be retrieved again. Use it with --agent-api-key when starting an agent."
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private static string? ExtractHost(string endpoint)
    {
        try
        {
            var uri = new Uri(endpoint);
            return uri.Host;
        }
        catch
        {
            return endpoint;
        }
    }

    private static string GetVersion()
    {
        var assembly = System.Reflection.Assembly.GetExecutingAssembly();
        var version = assembly.GetName().Version;
        return version?.ToString() ?? "0.0.0";
    }
}
