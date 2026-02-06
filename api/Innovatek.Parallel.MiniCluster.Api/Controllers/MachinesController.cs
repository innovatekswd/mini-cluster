using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Api.Services;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class MachinesController : ControllerBase
{
    private readonly IMachineService _machineService;
    private readonly ILogger<MachinesController> _logger;

    public MachinesController(
        IMachineService machineService,
        ILogger<MachinesController> logger)
    {
        _machineService = machineService;
        _logger = logger;
    }

    /// <summary>
    /// Get all registered machines with service counts.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<MachineDto>>> GetAll(CancellationToken ct)
    {
        try
        {
            var machines = await _machineService.GetAllAsync(ct);
            return Ok(machines);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving machines");
            return StatusCode(500, "An error occurred while retrieving machines");
        }
    }

    /// <summary>
    /// Get the local machine record.
    /// </summary>
    [HttpGet("local")]
    public async Task<ActionResult<MachineDto>> GetLocal(CancellationToken ct)
    {
        try
        {
            var machine = await _machineService.GetOrCreateLocalAsync(ct);
            return Ok(machine);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving local machine");
            return StatusCode(500, "An error occurred while retrieving local machine");
        }
    }

    /// <summary>
    /// Get a machine by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MachineDto>> GetById(Guid id, CancellationToken ct)
    {
        try
        {
            var machine = await _machineService.GetByIdAsync(id, ct);
            if (machine == null) return NotFound();
            return Ok(machine);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving machine {Id}", id);
            return StatusCode(500, "An error occurred while retrieving the machine");
        }
    }

    /// <summary>
    /// Get a machine with its services.
    /// </summary>
    [HttpGet("{id:guid}/services")]
    public async Task<ActionResult<MachineWithServicesDto>> GetWithServices(Guid id, CancellationToken ct)
    {
        try
        {
            var machine = await _machineService.GetWithServicesAsync(id, ct);
            if (machine == null) return NotFound();
            return Ok(machine);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving machine with services {Id}", id);
            return StatusCode(500, "An error occurred while retrieving the machine");
        }
    }

    /// <summary>
    /// Register a new machine (cluster node).
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<MachineDto>> Create([FromBody] CreateMachineDto dto, CancellationToken ct)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("Machine name is required.");

            var machine = await _machineService.CreateAsync(dto, ct);
            return CreatedAtAction(nameof(GetById), new { id = machine.Id }, machine);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating machine");
            return StatusCode(500, "An error occurred while creating the machine");
        }
    }

    /// <summary>
    /// Update a machine registration.
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MachineDto>> Update(Guid id, [FromBody] UpdateMachineDto dto, CancellationToken ct)
    {
        try
        {
            var machine = await _machineService.UpdateAsync(id, dto, ct);
            if (machine == null) return NotFound();
            return Ok(machine);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating machine {Id}", id);
            return StatusCode(500, "An error occurred while updating the machine");
        }
    }

    /// <summary>
    /// Delete a machine registration. Cannot delete the local machine.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct)
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting machine {Id}", id);
            return StatusCode(500, "An error occurred while deleting the machine");
        }
    }

    /// <summary>
    /// Ping a machine to check connectivity.
    /// </summary>
    [HttpPost("{id:guid}/ping")]
    public async Task<ActionResult<object>> Ping(Guid id, CancellationToken ct)
    {
        try
        {
            var machine = await _machineService.GetByIdAsync(id, ct);
            if (machine == null) return NotFound();

            var reachable = await _machineService.PingAsync(id, ct);
            return Ok(new { machineId = id, reachable, timestamp = DateTime.UtcNow });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pinging machine {Id}", id);
            return StatusCode(500, "An error occurred while pinging the machine");
        }
    }
}
