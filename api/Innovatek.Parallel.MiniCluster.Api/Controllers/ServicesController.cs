using AutoMapper;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Api.Helpers;
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
    private readonly IHealthCheckService _healthCheckService;
    private readonly IAutoRestartService _autoRestartService;

    public ServicesController(AppDbContext db,
        IMapper mapper,
        IServiceProcessManager processManager,
        ILogger<ServicesController> logger,
        IIdentifierResolver resolver,
        IHealthCheckService healthCheckService,
        IAutoRestartService autoRestartService)
    {
        _db = db;
        _mapper = mapper;
        _processManager = processManager;
        _logger = logger;
        _resolver = resolver;
        _healthCheckService = healthCheckService;
        _autoRestartService = autoRestartService;
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
            ServiceRuntimeStatus.Running => "Running",
            ServiceRuntimeStatus.Starting => "Starting",
            ServiceRuntimeStatus.Stopping => "Stopping",
            ServiceRuntimeStatus.Failed => "Failed",
            _ => "Stopped"
        };

        // Get runtime health and restart state
        var healthState = service.HealthCheckType != Core.Entities.HealthCheckType.None
            ? _healthCheckService.GetHealthState(service.Id)
            : null;
        var restartState = service.RestartPolicy != Core.Entities.RestartPolicy.Never
            ? _autoRestartService.GetRestartState(service.Id)
            : null;

        return new ServiceResponseDto
        {
            Id = service.Id,
            Name = service.Name,
            Slug = service.Slug,
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
            ModifiedAt = service.ModifiedAt,

            // Restart policy fields
            RestartPolicy = (int)service.RestartPolicy,
            MaxRestarts = service.MaxRestarts,
            RestartWindowSeconds = service.RestartWindowSeconds,
            RestartDelaySeconds = service.RestartDelaySeconds,
            MaxRestartDelaySeconds = service.MaxRestartDelaySeconds,
            UseExponentialBackoff = service.UseExponentialBackoff,

            // Health check config fields
            HealthCheckType = (int)service.HealthCheckType,
            HealthCheckTarget = service.HealthCheckTarget,
            HealthCheckIntervalSeconds = service.HealthCheckIntervalSeconds,
            HealthCheckTimeoutSeconds = service.HealthCheckTimeoutSeconds,
            HealthCheckFailureThreshold = service.HealthCheckFailureThreshold,
            HealthCheckGracePeriodSeconds = service.HealthCheckGracePeriodSeconds,

            // Runtime health state
            IsHealthy = healthState?.IsHealthy,
            ConsecutiveHealthFailures = healthState?.ConsecutiveFailures,
            LastHealthError = healthState?.LastError,
            LastHealthCheckAt = healthState?.LastCheckAt,

            // Runtime restart state
            RestartCount = restartState?.RestartCount,
            IsInCooldown = restartState?.IsInCooldown,
            CooldownUntil = restartState?.CooldownUntil
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
            Slug = SlugHelper.GenerateSlug(input.Name), // Initial slug, will be made unique below
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
            RestartPolicy = (RestartPolicy)input.RestartPolicy,
            MaxRestarts = input.MaxRestarts,
            RestartWindowSeconds = input.RestartWindowSeconds,
            RestartDelaySeconds = input.RestartDelaySeconds,
            MaxRestartDelaySeconds = input.MaxRestartDelaySeconds,
            UseExponentialBackoff = input.UseExponentialBackoff,
            HealthCheckType = (HealthCheckType)input.HealthCheckType,
            HealthCheckTarget = input.HealthCheckTarget,
            HealthCheckIntervalSeconds = input.HealthCheckIntervalSeconds,
            HealthCheckTimeoutSeconds = input.HealthCheckTimeoutSeconds,
            HealthCheckFailureThreshold = input.HealthCheckFailureThreshold,
            HealthCheckGracePeriodSeconds = input.HealthCheckGracePeriodSeconds,
            CreatedAt = DateTime.UtcNow,
            ModifiedAt = DateTime.UtcNow
        };

        // Generate unique slug from name (unique per app)
        service.Slug = SlugHelper.GenerateUniqueSlug(
            service.Name,
            slug => _db.Services.Any(s => s.Slug == slug && s.AppId == service.AppId)
        );

        // Set default working directory if not provided
        if (string.IsNullOrWhiteSpace(service.WorkingDirectory))
        {
            service.WorkingDirectory = Path.GetDirectoryName(service.ExecutablePath) ?? string.Empty;
        }

        _db.Services.Add(service);
        await _db.SaveChangesAsync();
        
        _logger.LogInformation("Created service {Name} with slug {Slug} ({Id})", service.Name, service.Slug, service.Id);
        
        return CreatedAtAction(nameof(GetById), new { identifier = service.Slug }, MapToDto(service));
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
            var oldName = existing.Name;
            
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
            
            // Restart policy fields
            if (updated.RestartPolicy.HasValue) existing.RestartPolicy = (RestartPolicy)updated.RestartPolicy.Value;
            if (updated.MaxRestarts.HasValue) existing.MaxRestarts = updated.MaxRestarts.Value;
            if (updated.RestartWindowSeconds.HasValue) existing.RestartWindowSeconds = updated.RestartWindowSeconds.Value;
            if (updated.RestartDelaySeconds.HasValue) existing.RestartDelaySeconds = updated.RestartDelaySeconds.Value;
            if (updated.MaxRestartDelaySeconds.HasValue) existing.MaxRestartDelaySeconds = updated.MaxRestartDelaySeconds.Value;
            if (updated.UseExponentialBackoff.HasValue) existing.UseExponentialBackoff = updated.UseExponentialBackoff.Value;

            // Health check fields
            if (updated.HealthCheckType.HasValue) existing.HealthCheckType = (HealthCheckType)updated.HealthCheckType.Value;
            if (updated.HealthCheckTarget != null) existing.HealthCheckTarget = updated.HealthCheckTarget;
            if (updated.HealthCheckIntervalSeconds.HasValue) existing.HealthCheckIntervalSeconds = updated.HealthCheckIntervalSeconds.Value;
            if (updated.HealthCheckTimeoutSeconds.HasValue) existing.HealthCheckTimeoutSeconds = updated.HealthCheckTimeoutSeconds.Value;
            if (updated.HealthCheckFailureThreshold.HasValue) existing.HealthCheckFailureThreshold = updated.HealthCheckFailureThreshold.Value;
            if (updated.HealthCheckGracePeriodSeconds.HasValue) existing.HealthCheckGracePeriodSeconds = updated.HealthCheckGracePeriodSeconds.Value;

            existing.ModifiedAt = DateTime.UtcNow;
            
            // Regenerate slug if name changed
            if (updated.Name != null && updated.Name != oldName)
            {
                existing.Slug = SlugHelper.GenerateUniqueSlug(
                    existing.Name,
                    slug => _db.Services.Any(s => s.Slug == slug && s.AppId == existing.AppId && s.Id != existing.Id)
                );
            }

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

        // Clear manually-stopped flag so auto-restart can kick in if it exits
        _autoRestartService.ClearManuallyStopped(service.Id);
        _autoRestartService.ResetRestartState(service.Id);

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

        // Mark as manually stopped so auto-restart (UnlessStopped) won't restart it
        _autoRestartService.MarkManuallyStopped(service.Id);

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

            // Create cloned service with unique slug
            var clonedServiceName = $"{originalService.Name} (Copy)";
            var clonedService = new Service
            {
                Id = Guid.NewGuid(),
                Name = clonedServiceName,
                Slug = SlugHelper.GenerateUniqueSlug(
                    clonedServiceName,
                    slug => _db.Services.Any(s => s.Slug == slug && s.AppId == originalService.AppId)
                ),
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

    // ── Container Config Endpoints ─────────────────────────────

    /// <summary>
    /// Get container configuration for a service
    /// </summary>
    [HttpGet("{identifier}/container")]
    public async Task<ActionResult<ContainerConfigDto>> GetContainerConfig(string identifier, CancellationToken ct)
    {
        try
        {
            var result = await _resolver.ResolveServiceAsync(identifier);
            if (!result.Success) return NotFound(new { error = $"Service '{identifier}' not found" });

            var config = await _db.ContainerConfigs.FirstOrDefaultAsync(c => c.ServiceId == result.Value, ct);
            if (config == null) return NotFound(new { error = "No container config for this service" });

            return Ok(MapContainerConfig(config));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting container config for {Identifier}", identifier);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Create or update container configuration for a service
    /// </summary>
    [HttpPut("{identifier}/container")]
    public async Task<ActionResult<ContainerConfigDto>> UpdateContainerConfig(
        string identifier, ContainerConfigDto dto, CancellationToken ct)
    {
        try
        {
            var result = await _resolver.ResolveServiceAsync(identifier);
            if (!result.Success) return NotFound(new { error = $"Service '{identifier}' not found" });

            var config = await _db.ContainerConfigs.FirstOrDefaultAsync(c => c.ServiceId == result.Value, ct);
            if (config == null)
            {
                config = new ContainerConfig { ServiceId = result.Value };
                _db.ContainerConfigs.Add(config);
            }

            config.Image = dto.Image;
            config.Tag = dto.Tag ?? "latest";
            config.Registry = dto.Registry;
            config.NetworkMode = dto.NetworkMode;
            config.RestartPolicy = (ContainerRestartPolicy)dto.RestartPolicy;
            config.Privileged = dto.Privileged;
            config.CpuLimit = dto.CpuLimit;
            config.MemoryLimitBytes = dto.MemoryLimitBytes;
            
            if (dto.PortMappings != null)
                config.PortMappings = string.Join(";", dto.PortMappings.Select(p => $"{p.Host}:{p.Container}/{p.Protocol ?? "tcp"}"));
            if (dto.VolumeMounts != null)
                config.VolumeMounts = string.Join(";", dto.VolumeMounts.Select(v => $"{v.Host}:{v.Container}:{(v.ReadOnly ? "ro" : "rw")}"));
            if (dto.Labels != null)
                config.Labels = string.Join(";", dto.Labels.Select(kv => $"{kv.Key}={kv.Value}"));

            // Update the service type to Docker if not already
            var service = await _db.Services.FindAsync(new object[] { result.Value }, ct);
            if (service != null && service.ServiceType == ServiceType.Process)
            {
                service.ServiceType = ServiceType.Docker;
                service.ModifiedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync(ct);
            return Ok(MapContainerConfig(config));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating container config for {Identifier}", identifier);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Delete container configuration and reset service to process type
    /// </summary>
    [HttpDelete("{identifier}/container")]
    public async Task<IActionResult> DeleteContainerConfig(string identifier, CancellationToken ct)
    {
        try
        {
            var result = await _resolver.ResolveServiceAsync(identifier);
            if (!result.Success) return NotFound(new { error = $"Service '{identifier}' not found" });

            var config = await _db.ContainerConfigs.FirstOrDefaultAsync(c => c.ServiceId == result.Value, ct);
            if (config == null) return NotFound(new { error = "No container config to delete" });

            _db.ContainerConfigs.Remove(config);

            var service = await _db.Services.FindAsync(new object[] { result.Value }, ct);
            if (service != null)
            {
                service.ServiceType = ServiceType.Process;
                service.ModifiedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync(ct);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting container config for {Identifier}", identifier);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private static ContainerConfigDto MapContainerConfig(ContainerConfig c)
    {
        var dto = new ContainerConfigDto
        {
            Id = c.Id,
            ServiceId = c.ServiceId,
            Image = c.Image,
            Tag = c.Tag,
            Registry = c.Registry,
            ContainerName = c.ContainerName,
            Hostname = c.Hostname,
            NetworkMode = c.NetworkMode,
            RestartPolicy = (int)c.RestartPolicy,
            Privileged = c.Privileged,
            User = c.User,
            CpuLimit = c.CpuLimit,
            MemoryLimitBytes = c.MemoryLimitBytes,
            ContainerId = c.ContainerId,
            ImageId = c.ImageId
        };

        if (!string.IsNullOrEmpty(c.Labels))
        {
            dto.Labels = c.Labels.Split(';', StringSplitOptions.RemoveEmptyEntries)
                .Select(l => l.Split('=', 2))
                .Where(p => p.Length == 2)
                .ToDictionary(p => p[0], p => p[1]);
        }

        if (!string.IsNullOrEmpty(c.PortMappings))
        {
            dto.PortMappings = c.PortMappings.Split(';', StringSplitOptions.RemoveEmptyEntries).Select(p =>
            {
                var parts = p.Split(':');
                var portProto = parts.Length > 1 ? parts[1].Split('/') : new[] { parts[0] };
                return new PortMappingDto
                {
                    Host = int.TryParse(parts[0], out var hp) ? hp : 0,
                    Container = int.TryParse(portProto[0], out var cp) ? cp : 0,
                    Protocol = portProto.Length > 1 ? portProto[1] : "tcp"
                };
            }).ToList();
        }

        if (!string.IsNullOrEmpty(c.VolumeMounts))
        {
            dto.VolumeMounts = c.VolumeMounts.Split(';', StringSplitOptions.RemoveEmptyEntries).Select(v =>
            {
                var parts = v.Split(':');
                return new VolumeMountDto
                {
                    Host = parts.Length > 0 ? parts[0] : "",
                    Container = parts.Length > 1 ? parts[1] : "",
                    ReadOnly = parts.Length > 2 && parts[2] == "ro"
                };
            }).ToList();
        }

        return dto;
    }
}
