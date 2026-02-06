using System.Runtime.InteropServices;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Manages machine (cluster node) CRUD and local machine registration.
/// </summary>
public class MachineService : IMachineService
{
    private readonly AppDbContext _context;
    private readonly IMapper _mapper;
    private readonly IServiceProcessManager _processManager;
    private readonly ILogger<MachineService> _logger;

    public MachineService(
        AppDbContext context,
        IMapper mapper,
        IServiceProcessManager processManager,
        ILogger<MachineService> logger)
    {
        _context = context;
        _mapper = mapper;
        _processManager = processManager;
        _logger = logger;
    }

    public async Task<List<MachineDto>> GetAllAsync(CancellationToken ct = default)
    {
        var machines = await _context.Machines
            .Include(m => m.Services)
            .OrderBy(m => m.OrderIndex)
            .ThenBy(m => m.Name)
            .ToListAsync(ct);

        return machines.Select(MapToDto).ToList();
    }

    public async Task<MachineDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var machine = await _context.Machines
            .Include(m => m.Services)
            .FirstOrDefaultAsync(m => m.Id == id, ct);

        return machine == null ? null : MapToDto(machine);
    }

    public async Task<MachineWithServicesDto?> GetWithServicesAsync(Guid id, CancellationToken ct = default)
    {
        var machine = await _context.Machines
            .Include(m => m.Services)
            .FirstOrDefaultAsync(m => m.Id == id, ct);

        if (machine == null) return null;

        var dto = MapToDto(machine);
        return new MachineWithServicesDto
        {
            Id = dto.Id,
            Name = dto.Name,
            Host = dto.Host,
            Port = dto.Port,
            ConnectionType = dto.ConnectionType,
            SshUsername = dto.SshUsername,
            Status = dto.Status,
            LastSeen = dto.LastSeen,
            Metadata = dto.Metadata,
            OrderIndex = dto.OrderIndex,
            IsLocal = dto.IsLocal,
            AgentEndpoint = dto.AgentEndpoint,
            AgentVersion = dto.AgentVersion,
            Labels = dto.Labels,
            CpuCores = dto.CpuCores,
            TotalMemoryBytes = dto.TotalMemoryBytes,
            TotalDiskBytes = dto.TotalDiskBytes,
            CreatedAt = dto.CreatedAt,
            ModifiedAt = dto.ModifiedAt,
            ServiceCount = dto.ServiceCount,
            RunningServiceCount = dto.RunningServiceCount,
            Services = machine.Services.Select(s => new Phase5ServiceDto
            {
                Id = s.Id,
                Name = s.Name,
                Status = _processManager.GetStatus(s.Id).ToString().ToLowerInvariant(),
                AutoStart = s.AutoStart,
                AccessLink = s.AccessLink,
                IsExternal = s.IsExternal,
                OrderIndex = s.OrderIndex,
                CreatedAt = s.CreatedAt,
                ModifiedAt = s.ModifiedAt
            }).ToList()
        };
    }

    public async Task<MachineDto> CreateAsync(CreateMachineDto dto, CancellationToken ct = default)
    {
        var machine = new Machine
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Host = dto.Host,
            Port = dto.Port,
            ConnectionType = dto.ConnectionType,
            SshUsername = dto.SshUsername,
            SshKeyPath = dto.SshKeyPath,
            SshPassword = dto.SshPassword,
            OrderIndex = dto.OrderIndex,
            AgentEndpoint = dto.AgentEndpoint,
            AgentApiKey = dto.AgentApiKey,
            Labels = dto.Labels,
            Status = "unknown",
            CreatedAt = DateTime.UtcNow,
            ModifiedAt = DateTime.UtcNow
        };

        _context.Machines.Add(machine);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Machine registered: {Name} ({ConnectionType}) at {Host}", 
            machine.Name, machine.ConnectionType, machine.Host);

        return MapToDto(machine);
    }

    public async Task<MachineDto?> UpdateAsync(Guid id, UpdateMachineDto dto, CancellationToken ct = default)
    {
        var machine = await _context.Machines
            .Include(m => m.Services)
            .FirstOrDefaultAsync(m => m.Id == id, ct);

        if (machine == null) return null;

        if (dto.Name != null) machine.Name = dto.Name;
        if (dto.Host != null) machine.Host = dto.Host;
        if (dto.Port.HasValue) machine.Port = dto.Port.Value;
        if (dto.ConnectionType != null) machine.ConnectionType = dto.ConnectionType;
        if (dto.SshUsername != null) machine.SshUsername = dto.SshUsername;
        if (dto.SshKeyPath != null) machine.SshKeyPath = dto.SshKeyPath;
        if (dto.SshPassword != null) machine.SshPassword = dto.SshPassword;
        if (dto.OrderIndex.HasValue) machine.OrderIndex = dto.OrderIndex.Value;
        if (dto.AgentEndpoint != null) machine.AgentEndpoint = dto.AgentEndpoint;
        if (dto.AgentApiKey != null) machine.AgentApiKey = dto.AgentApiKey;
        if (dto.Labels != null) machine.Labels = dto.Labels;

        machine.ModifiedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Machine updated: {Name} ({Id})", machine.Name, machine.Id);

        return MapToDto(machine);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var machine = await _context.Machines.FirstOrDefaultAsync(m => m.Id == id, ct);
        
        if (machine == null) return false;
        
        if (machine.IsLocal)
        {
            _logger.LogWarning("Cannot delete the local machine ({Name})", machine.Name);
            throw new InvalidOperationException("Cannot delete the local machine.");
        }

        _context.Machines.Remove(machine);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Machine deleted: {Name} ({Id})", machine.Name, machine.Id);
        return true;
    }

    public async Task<MachineDto> GetOrCreateLocalAsync(CancellationToken ct = default)
    {
        var local = await _context.Machines
            .Include(m => m.Services)
            .FirstOrDefaultAsync(m => m.IsLocal, ct);

        if (local != null)
        {
            // Update system info on each startup
            local.CpuCores = System.Environment.ProcessorCount;
            local.TotalMemoryBytes = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes;
            local.Metadata = BuildLocalMetadata();
            local.Status = "online";
            local.LastSeen = DateTime.UtcNow;
            local.AgentVersion = GetVersion();
            local.ModifiedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);
            return MapToDto(local);
        }

        var hostname = System.Environment.MachineName;
        var machine = new Machine
        {
            Id = Guid.NewGuid(),
            Name = hostname,
            Host = "localhost",
            Port = 0,
            ConnectionType = "local",
            Status = "online",
            IsLocal = true,
            LastSeen = DateTime.UtcNow,
            CpuCores = System.Environment.ProcessorCount,
            TotalMemoryBytes = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes,
            AgentVersion = GetVersion(),
            Metadata = BuildLocalMetadata(),
            CreatedAt = DateTime.UtcNow,
            ModifiedAt = DateTime.UtcNow
        };

        _context.Machines.Add(machine);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Local machine registered: {Name} (CPU: {Cores}, RAM: {Ram}MB)", 
            machine.Name, machine.CpuCores, 
            machine.TotalMemoryBytes.HasValue ? machine.TotalMemoryBytes.Value / 1024 / 1024 : 0);

        return MapToDto(machine);
    }

    public async Task<bool> PingAsync(Guid id, CancellationToken ct = default)
    {
        var machine = await _context.Machines.FirstOrDefaultAsync(m => m.Id == id, ct);
        if (machine == null) return false;

        if (machine.IsLocal || machine.ConnectionType == "local")
        {
            machine.Status = "online";
            machine.LastSeen = DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);
            return true;
        }

        // For agent-type machines, we'd call the agent endpoint in Phase 1.
        // For now, just update the timestamp to indicate a manual ping attempt.
        if (machine.ConnectionType == "agent" && !string.IsNullOrEmpty(machine.AgentEndpoint))
        {
            // Phase 1 will implement actual HTTP ping to agent endpoint
            _logger.LogInformation("Ping to agent {Name} at {Endpoint} — not yet implemented (Phase 1)", 
                machine.Name, machine.AgentEndpoint);
            return false;
        }

        return false;
    }

    // ── Private helpers ─────────────────────────────────────────────

    private MachineDto MapToDto(Machine m)
    {
        var runningCount = m.Services.Count(s => _processManager.GetStatus(s.Id) == ServiceRuntimeStatus.Running);

        return new MachineDto
        {
            Id = m.Id,
            Name = m.Name,
            Host = m.Host,
            Port = m.Port,
            ConnectionType = m.ConnectionType,
            SshUsername = m.SshUsername,
            Status = m.Status,
            LastSeen = m.LastSeen,
            Metadata = m.Metadata,
            OrderIndex = m.OrderIndex,
            IsLocal = m.IsLocal,
            AgentEndpoint = m.AgentEndpoint,
            AgentVersion = m.AgentVersion,
            Labels = m.Labels,
            CpuCores = m.CpuCores,
            TotalMemoryBytes = m.TotalMemoryBytes,
            TotalDiskBytes = m.TotalDiskBytes,
            CreatedAt = m.CreatedAt,
            ModifiedAt = m.ModifiedAt,
            ServiceCount = m.Services.Count,
            RunningServiceCount = runningCount
        };
    }

    private static string BuildLocalMetadata()
    {
        return System.Text.Json.JsonSerializer.Serialize(new
        {
            os = RuntimeInformation.OSDescription,
            arch = RuntimeInformation.OSArchitecture.ToString(),
            framework = RuntimeInformation.FrameworkDescription,
            hostname = System.Environment.MachineName,
            processId = System.Environment.ProcessId
        });
    }

    private static string GetVersion()
    {
        var assembly = System.Reflection.Assembly.GetExecutingAssembly();
        var version = assembly.GetName().Version;
        return version?.ToString() ?? "0.0.0";
    }
}
