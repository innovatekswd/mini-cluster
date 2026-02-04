using AutoMapper;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/services")]
public class ServicesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;
    private readonly IServiceProcessManager _processManager;
    private readonly ILogger<ServicesController> _logger;
    private readonly IIdentifierResolver _resolver;

    public ServicesController(AppDbContext db,
        IMapper mapper,
        IServiceProcessManager processManager,
        ILogger<ServicesController> logger,
        IIdentifierResolver resolver)
    {
        _db = db;
        _mapper = mapper;
        _processManager = processManager;
        _logger = logger;
        _resolver = resolver;
    }

    /// <summary>
    /// Get all services with optional filtering
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<ServiceResponseDto>>> GetAll(
        [FromQuery] CancellationToken cancellationToken = default)
    {
        try
        {
            var services = await _db.Services
                .AsNoTracking()
                .OrderBy(s => s.OrderIndex)
                .ThenBy(s => s.Name)
                .ToListAsync(cancellationToken);
            
            var dtos = services.Select(s => MapToDto(s)).ToList();
            return Ok(dtos);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(408, "Request timeout");
        }
    }

    /// <summary>
    /// Get status for all services, or filtered by appId
    /// </summary>
    [HttpGet("statuses")]
    public async Task<ActionResult<Dictionary<string, string>>> GetAllStatuses(
        [FromQuery] Guid? appId = null,
        [FromQuery] CancellationToken cancellationToken = default)
    {
        try
        {
            // Get service IDs from database, optionally filtered by appId
            var query = _db.Services.AsNoTracking();
            
            if (appId.HasValue)
            {
                query = query.Where(s => s.AppId == appId.Value);
            }
            
            var serviceIds = await query
                .Select(s => s.Id)
                .ToListAsync(cancellationToken);

            // Get statuses for all services
            var result = new Dictionary<string, string>();
            foreach (var id in serviceIds)
            {
                var status = _processManager.GetStatus(id);
                var statusString = status switch
                {
                    ServiceRuntimeStatus.Running => "Running",
                    ServiceRuntimeStatus.Starting => "Starting",
                    ServiceRuntimeStatus.Stopping => "Stopping",
                    ServiceRuntimeStatus.Failed => "Failed",
                    _ => "Stopped"
                };
                result[id.ToString()] = statusString;
            }

            return Ok(result);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(408, "Request timeout");
        }
    }

    [HttpGet("{identifier}")]
    public async Task<ActionResult<ServiceResponseDto>> GetById(string identifier, [FromQuery] CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _resolver.ResolveServiceAsync(identifier);
            if (!result.Success)
            {
                if (result.AmbiguousMatches != null)
                {
                    return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
                }
                return NotFound(result.Error);
            }

            var service = await _db.Services
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == result.Value, cancellationToken);
            if (service == null) return NotFound();
            return Ok(MapToDto(service));
        }
        catch (OperationCanceledException)
        {
            return StatusCode(408, "Request timeout");
        }
    }

    private ServiceResponseDto MapToDto(Service service)
    {
        var status = _processManager.GetStatus(service.Id);
        var statusString = status switch
        {
            ServiceRuntimeStatus.Running => "running",
            ServiceRuntimeStatus.Starting => "starting",
            ServiceRuntimeStatus.Stopping => "stopping",
            ServiceRuntimeStatus.Failed => "failed",
            _ => "stopped"
        };

        return new ServiceResponseDto
        {
            Id = service.Id,
            Name = service.Name,
            ExecutablePath = service.ExecutablePath,
            Arguments = service.Arguments,
            EnvironmentVariables = service.EnvironmentVariables,
            AutoStart = service.AutoStart,
            WorkingDirectory = service.WorkingDirectory,
            AccessLink = service.AccessLink,
            IsExternal = service.IsExternal,
            UseShellExecute = service.UseShellExecute,
            CreateNoWindow = service.CreateNoWindow,
            CaptureOutput = service.CaptureOutput,
            Description = service.Description,
            OrderIndex = service.OrderIndex,
            AppId = service.AppId,
            Status = statusString,
            CreatedAt = service.CreatedAt,
            ModifiedAt = service.ModifiedAt
        };
    }

    [HttpPost]
    public async Task<ActionResult<ServiceResponseDto>> Create([FromBody] CreateServiceDto input)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var service = new Service
        {
            Id = Guid.NewGuid(),
            Name = input.Name,
            ExecutablePath = input.ExecutablePath,
            Arguments = input.Arguments,
            EnvironmentVariables = input.EnvironmentVariables ?? new(),
            AutoStart = input.AutoStart,
            WorkingDirectory = input.WorkingDirectory,
            AccessLink = input.AccessLink,
            IsExternal = input.IsExternal,
            UseShellExecute = input.UseShellExecute,
            CreateNoWindow = input.CreateNoWindow,
            CaptureOutput = input.CaptureOutput,
            Description = input.Description,
            OrderIndex = input.OrderIndex,
            AppId = input.AppId,
            CreatedAt = DateTime.UtcNow,
            ModifiedAt = DateTime.UtcNow
        };

        // Set default working directory if not provided
        if (string.IsNullOrWhiteSpace(service.WorkingDirectory))
        {
            service.WorkingDirectory = Path.GetDirectoryName(service.ExecutablePath) ?? string.Empty;
        }

        _db.Services.Add(service);
        await _db.SaveChangesAsync();
        
        _logger.LogInformation("Created service {Name} ({Id})", service.Name, service.Id);
        
        return CreatedAtAction(nameof(GetById), new { identifier = service.Name }, MapToDto(service));
    }

    [HttpPut("{identifier}")]
    public async Task<ActionResult<ServiceResponseDto>> Update(string identifier, [FromBody] UpdateServiceDto updated)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
            {
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            }
            return NotFound(result.Error);
        }

        var existing = await _db.Services.FirstOrDefaultAsync(s => s.Id == result.Value);
        if (existing == null) return NotFound();

        try
        {
            // Update properties
            if (updated.Name != null) existing.Name = updated.Name;
            if (updated.ExecutablePath != null) existing.ExecutablePath = updated.ExecutablePath;
            if (updated.Arguments != null) existing.Arguments = updated.Arguments;
            if (updated.EnvironmentVariables != null) existing.EnvironmentVariables = updated.EnvironmentVariables;
            if (updated.AutoStart.HasValue) existing.AutoStart = updated.AutoStart.Value;
            if (updated.WorkingDirectory != null) existing.WorkingDirectory = updated.WorkingDirectory;
            if (updated.AccessLink != null) existing.AccessLink = updated.AccessLink;
            if (updated.IsExternal.HasValue) existing.IsExternal = updated.IsExternal.Value;
            if (updated.UseShellExecute.HasValue) existing.UseShellExecute = updated.UseShellExecute.Value;
            if (updated.CreateNoWindow.HasValue) existing.CreateNoWindow = updated.CreateNoWindow.Value;
            if (updated.CaptureOutput.HasValue) existing.CaptureOutput = updated.CaptureOutput.Value;
            if (updated.Description != null) existing.Description = updated.Description;
            if (updated.OrderIndex.HasValue) existing.OrderIndex = updated.OrderIndex.Value;
            
            existing.ModifiedAt = DateTime.UtcNow;

            // Set default working directory if not provided
            if (string.IsNullOrWhiteSpace(existing.WorkingDirectory))
            {
                existing.WorkingDirectory = Path.GetDirectoryName(existing.ExecutablePath) ?? string.Empty;
            }

            // Explicitly mark the EnvironmentVariables property as modified
            _db.Entry(existing).Property(e => e.EnvironmentVariables).IsModified = true;

            await _db.SaveChangesAsync();

            _logger.LogInformation("Updated service {Name} ({Id})", existing.Name, existing.Id);

            return Ok(MapToDto(existing));
        }
        catch (DbUpdateException ex)
        {
            var innerMessage = ex.InnerException?.Message ?? ex.Message;
            return StatusCode(500, new
            {
                Status = 500,
                Title = "Database update failed",
                Detail = innerMessage,
                Instance = $"/api/services/{identifier}"
            });
        }
    }

    [HttpDelete("{identifier}")]
    public async Task<IActionResult> Delete(string identifier)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
            {
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            }
            return NotFound(result.Error);
        }

        var service = await _db.Services.FirstOrDefaultAsync(s => s.Id == result.Value);
        if (service == null) return NotFound();

        // Check if service is running
        var status = _processManager.GetStatus(result.Value);
        if (status == ServiceRuntimeStatus.Running)
        {
            return BadRequest($"Service '{service.Name}' is running. Stop it first.");
        }

        _db.Services.Remove(service);
        await _db.SaveChangesAsync();
        
        _logger.LogInformation("Deleted service {Name} ({Id})", service.Name, service.Id);
        
        return NoContent();
    }

    /// <summary>
    /// Start a service
    /// </summary>
    [HttpPost("{identifier}/start")]
    public async Task<ActionResult> Start(string identifier)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
            {
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            }
            return NotFound(result.Error);
        }

        var service = await _db.Services.FirstOrDefaultAsync(s => s.Id == result.Value);
        
        if (service == null)
            return NotFound();

        var startResult = await _processManager.StartServiceAsync(service.Id);
        
        if (!startResult.Success)
        {
            return BadRequest(new { error = startResult.ErrorMessage });
        }

        _logger.LogInformation("Started service {Name} ({Id})", service.Name, service.Id);

        return Ok(new { success = true, message = $"Service '{service.Name}' started" });
    }

    /// <summary>
    /// Stop a service
    /// </summary>
    [HttpPost("{identifier}/stop")]
    public async Task<ActionResult> Stop(string identifier)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
            {
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            }
            return NotFound(result.Error);
        }

        var service = await _db.Services.FirstOrDefaultAsync(s => s.Id == result.Value);
        
        if (service == null)
            return NotFound();

        var stopped = await _processManager.StopServiceAsync(service.Id);

        _logger.LogInformation("Stopped service {Name} ({Id}), result={Stopped}", service.Name, service.Id, stopped);

        return Ok(new { success = stopped, message = stopped ? $"Service '{service.Name}' stopped" : "Failed to stop service" });
    }

    /// <summary>
    /// Restart a service
    /// </summary>
    [HttpPost("{identifier}/restart")]
    public async Task<IActionResult> Restart(string identifier)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
            {
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            }
            return NotFound(result.Error);
        }

        var service = await _db.Services.FirstOrDefaultAsync(s => s.Id == result.Value);
        
        if (service == null)
            return NotFound();

        await _processManager.StopServiceAsync(result.Value);
        await Task.Delay(500); // Brief pause between stop and start
        var startResult = await _processManager.StartServiceAsync(result.Value);

        _logger.LogInformation("Restarted service {Name} ({Id})", service.Name, service.Id);

        return Ok(new { success = startResult.Success, message = startResult.Success ? $"Service '{service.Name}' restarted" : startResult.ErrorMessage });
    }

    /// <summary>
    /// Clone a service (creates a copy with the same configuration)
    /// </summary>
    [HttpPost("{identifier}/clone")]
    public async Task<ActionResult<ServiceResponseDto>> CloneService(string identifier)
    {
        try
        {
            var result = await _resolver.ResolveServiceAsync(identifier);
            if (!result.Success)
            {
                if (result.AmbiguousMatches != null)
                {
                    return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
                }
                return NotFound(result.Error);
            }

            var originalService = await _db.Services.FirstOrDefaultAsync(s => s.Id == result.Value);

            if (originalService == null)
            {
                return NotFound($"Service '{identifier}' not found");
            }

            // Create cloned service
            var clonedService = new Service
            {
                Id = Guid.NewGuid(),
                Name = $"{originalService.Name} (Copy)",
                ExecutablePath = originalService.ExecutablePath,
                Arguments = originalService.Arguments,
                EnvironmentVariables = originalService.EnvironmentVariables,
                AutoStart = false, // Don't auto-start cloned services
                WorkingDirectory = originalService.WorkingDirectory,
                AccessLink = originalService.AccessLink,
                IsExternal = originalService.IsExternal,
                UseShellExecute = originalService.UseShellExecute,
                CreateNoWindow = originalService.CreateNoWindow,
                CaptureOutput = originalService.CaptureOutput,
                Description = originalService.Description,
                OrderIndex = originalService.OrderIndex + 1,
                CreatedAt = DateTime.UtcNow,
                ModifiedAt = DateTime.UtcNow,
                AppId = originalService.AppId
            };

            _db.Services.Add(clonedService);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Cloned service {ServiceName} (ID: {ServiceId}) to {ClonedName} (ID: {ClonedId})", 
                originalService.Name, originalService.Id, clonedService.Name, clonedService.Id);

            return CreatedAtAction(nameof(GetById), new { identifier = clonedService.Name }, MapToDto(clonedService));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cloning service {Identifier}", identifier);
            return StatusCode(500, "An error occurred while cloning the service");
        }
    }
}
