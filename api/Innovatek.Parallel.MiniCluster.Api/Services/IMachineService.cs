using Innovatek.Parallel.MiniCluster.Api.Dtos;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Service for managing machines (cluster nodes) in MiniCluster.
/// </summary>
public interface IMachineService
{
    /// <summary>
    /// Get all registered machines.
    /// </summary>
    Task<List<MachineDto>> GetAllAsync(CancellationToken ct = default);
    
    /// <summary>
    /// Get a machine by ID, including service counts.
    /// </summary>
    Task<MachineDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    
    /// <summary>
    /// Get a machine with its services.
    /// </summary>
    Task<MachineWithServicesDto?> GetWithServicesAsync(Guid id, CancellationToken ct = default);
    
    /// <summary>
    /// Create a new machine registration.
    /// </summary>
    Task<MachineDto> CreateAsync(CreateMachineDto dto, CancellationToken ct = default);
    
    /// <summary>
    /// Update an existing machine.
    /// </summary>
    Task<MachineDto?> UpdateAsync(Guid id, UpdateMachineDto dto, CancellationToken ct = default);
    
    /// <summary>
    /// Delete a machine registration. Cannot delete the local machine.
    /// </summary>
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    
    /// <summary>
    /// Get or create the local machine record. Called on startup.
    /// </summary>
    Task<MachineDto> GetOrCreateLocalAsync(CancellationToken ct = default);
    
    /// <summary>
    /// Ping a machine to check connectivity.
    /// </summary>
    Task<bool> PingAsync(Guid id, CancellationToken ct = default);
}
