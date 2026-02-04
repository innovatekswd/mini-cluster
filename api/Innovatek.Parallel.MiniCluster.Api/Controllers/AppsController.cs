using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Innovatek.Parallel.MiniCluster.Api.Services;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class AppsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IMapper _mapper;
    private readonly ILogger<AppsController> _logger;
    private readonly IServiceProcessManager _processManager;
    private readonly IIdentifierResolver _resolver;

    public AppsController(
        AppDbContext context,
        IMapper mapper,
        ILogger<AppsController> logger,
        IServiceProcessManager processManager,
        IIdentifierResolver resolver)
    {
        _context = context;
        _mapper = mapper;
        _logger = logger;
        _processManager = processManager;
        _resolver = resolver;
    }

    /// <summary>
    /// Get all apps with service statistics
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ApplicationWithStatsDto>>> GetAllApps()
    {
        try
        {
            var apps = await _context.Apps
                .Include(a => a.Services)
                .OrderBy(a => a.SortOrder)
                .ThenBy(a => a.Name)
                .ToListAsync();

            var appsWithStats = apps.Select(app =>
            {
                var runningCount = app.Services.Count(s => _processManager.GetStatus(s.Id) == ServiceRuntimeStatus.Running);
                var stoppedCount = app.Services.Count - runningCount;

                return new ApplicationWithStatsDto
                {
                    Id = app.Id,
                    Name = app.Name,
                    Description = app.Description,
                    Icon = app.Icon,
                    Color = app.Color,
                    CreatedAt = app.CreatedAt,
                    ModifiedAt = app.ModifiedAt,
                    SortOrder = app.SortOrder,
                    ServiceCount = app.Services.Count,
                    RunningCount = runningCount,
                    StoppedCount = stoppedCount
                };
            }).ToList();

            return Ok(appsWithStats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving apps");
            return StatusCode(500, "An error occurred while retrieving apps");
        }
    }

    /// <summary>
    /// Get a single app by ID, name, or short ID
    /// </summary>
    [HttpGet("{identifier}")]
    public async Task<ActionResult<ApplicationDto>> GetApp(string identifier)
    {
        try
        {
            var result = await _resolver.ResolveAppAsync(identifier);
            if (!result.Success)
            {
                if (result.AmbiguousMatches != null)
                {
                    return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
                }
                return NotFound(result.Error);
            }

            var app = await _context.Apps.FindAsync(result.Value);

            if (app == null)
            {
                return NotFound($"App '{identifier}' not found");
            }

            var appDto = _mapper.Map<ApplicationDto>(app);
            return Ok(appDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving app {Identifier}", identifier);
            return StatusCode(500, "An error occurred while retrieving the app");
        }
    }

    /// <summary>
    /// Create a new app
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApplicationDto>> CreateApp(CreateApplicationDto createDto)
    {
        try
        {
            var app = _mapper.Map<App>(createDto);
            app.Id = Guid.NewGuid();
            
            // Set sort order to the end
            var maxSortOrder = await _context.Apps.MaxAsync(a => (int?)a.SortOrder) ?? 0;
            app.SortOrder = maxSortOrder + 1;

            _context.Apps.Add(app);
            await _context.SaveChangesAsync();

            var appDto = _mapper.Map<ApplicationDto>(app);
            _logger.LogInformation("Created app {AppName} with ID {AppId}", app.Name, app.Id);

            return CreatedAtAction(nameof(GetApp), new { identifier = app.Name }, appDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating app");
            return StatusCode(500, "An error occurred while creating the app");
        }
    }

    /// <summary>
    /// Update an existing app
    /// </summary>
    [HttpPut("{identifier}")]
    public async Task<IActionResult> UpdateApp(string identifier, UpdateApplicationDto updateDto)
    {
        try
        {
            var result = await _resolver.ResolveAppAsync(identifier);
            if (!result.Success)
            {
                if (result.AmbiguousMatches != null)
                {
                    return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
                }
                return NotFound(result.Error);
            }

            var app = await _context.Apps.FindAsync(result.Value);

            if (app == null)
            {
                return NotFound($"App '{identifier}' not found");
            }

            _mapper.Map(updateDto, app);
            app.ModifiedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated app {AppName} with ID {AppId}", app.Name, app.Id);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating app {Identifier}", identifier);
            return StatusCode(500, "An error occurred while updating the app");
        }
    }

    /// <summary>
    /// Delete an app (sets AppId to null for all services in this app)
    /// </summary>
    [HttpDelete("{identifier}")]
    public async Task<IActionResult> DeleteApp(string identifier)
    {
        try
        {
            var result = await _resolver.ResolveAppAsync(identifier);
            if (!result.Success)
            {
                if (result.AmbiguousMatches != null)
                {
                    return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
                }
                return NotFound(result.Error);
            }

            var app = await _context.Apps
                .Include(a => a.Services)
                .FirstOrDefaultAsync(a => a.Id == result.Value);

            if (app == null)
            {
                return NotFound($"App '{identifier}' not found");
            }

            // Unassign all services from this app (they become unassigned)
            foreach (var service in app.Services)
            {
                service.AppId = null;
            }

            _context.Apps.Remove(app);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Deleted app {AppName} with ID {AppId}", app.Name, app.Id);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting app {Identifier}", identifier);
            return StatusCode(500, "An error occurred while deleting the app");
        }
    }

    /// <summary>
    /// Reorder apps
    /// </summary>
    [HttpPost("reorder")]
    public async Task<IActionResult> ReorderApps([FromBody] List<Guid> orderedAppIds)
    {
        try
        {
            for (int i = 0; i < orderedAppIds.Count; i++)
            {
                var app = await _context.Apps.FindAsync(orderedAppIds[i]);
                if (app != null)
                {
                    app.SortOrder = i;
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Reordered {Count} apps", orderedAppIds.Count);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reordering apps");
            return StatusCode(500, "An error occurred while reordering apps");
        }
    }

    /// <summary>
    /// Clone an app (creates a copy with all its services)
    /// </summary>
    [HttpPost("{identifier}/clone")]
    public async Task<ActionResult<ApplicationDto>> CloneApp(string identifier)
    {
        try
        {
            var result = await _resolver.ResolveAppAsync(identifier);
            if (!result.Success)
            {
                if (result.AmbiguousMatches != null)
                {
                    return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
                }
                return NotFound(result.Error);
            }

            var originalApp = await _context.Apps
                .Include(a => a.Services)
                .FirstOrDefaultAsync(a => a.Id == result.Value);

            if (originalApp == null)
            {
                return NotFound($"App '{identifier}' not found");
            }

            // Create cloned app
            var clonedApp = new App
            {
                Id = Guid.NewGuid(),
                Name = $"{originalApp.Name} (Copy)",
                Description = originalApp.Description,
                Icon = originalApp.Icon,
                Color = originalApp.Color,
                CreatedAt = DateTime.UtcNow,
                ModifiedAt = DateTime.UtcNow,
                SortOrder = (await _context.Apps.MaxAsync(a => (int?)a.SortOrder) ?? 0) + 1
            };

            _context.Apps.Add(clonedApp);

            // Clone all services
            foreach (var service in originalApp.Services)
            {
                var clonedService = new Service
                {
                    Id = Guid.NewGuid(),
                    Name = $"{service.Name} (Copy)",
                    ExecutablePath = service.ExecutablePath,
                    Arguments = service.Arguments,
                    EnvironmentVariables = service.EnvironmentVariables,
                    AutoStart = false, // Don't auto-start cloned services
                    WorkingDirectory = service.WorkingDirectory,
                    AccessLink = service.AccessLink,
                    IsExternal = service.IsExternal,
                    UseShellExecute = service.UseShellExecute,
                    CreateNoWindow = service.CreateNoWindow,
                    CaptureOutput = service.CaptureOutput,
                    Description = service.Description,
                    OrderIndex = service.OrderIndex,
                    CreatedAt = DateTime.UtcNow,
                    ModifiedAt = DateTime.UtcNow,
                    AppId = clonedApp.Id
                };

                _context.Services.Add(clonedService);
            }

            await _context.SaveChangesAsync();

            var appDto = _mapper.Map<ApplicationDto>(clonedApp);
            _logger.LogInformation("Cloned app {AppName} (ID: {AppId}) to {ClonedName} (ID: {ClonedId})", 
                originalApp.Name, originalApp.Id, clonedApp.Name, clonedApp.Id);

            return CreatedAtAction(nameof(GetApp), new { identifier = clonedApp.Name }, appDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cloning app {Identifier}", identifier);
            return StatusCode(500, "An error occurred while cloning the app");
        }
    }

    /// <summary>
    /// Seed sample apps and services for testing
    /// </summary>
    [HttpPost("seed")]
    public async Task<IActionResult> SeedSampleData()
    {
        try
        {

            var apps = new[]
            {
                new App { Id = Guid.NewGuid(), Name = "E-Commerce Platform", Description = "Online shopping services", Icon = "🛒", Color = "#3b82f6", SortOrder = 1, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                new App { Id = Guid.NewGuid(), Name = "Analytics Dashboard", Description = "Data visualization and reporting", Icon = "📊", Color = "#10b981", SortOrder = 2, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                new App { Id = Guid.NewGuid(), Name = "Monitoring Services", Description = "System health and alerting", Icon = "📈", Color = "#f59e0b", SortOrder = 3, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                new App { Id = Guid.NewGuid(), Name = "Developer Tools", Description = "Build and deployment tools", Icon = "🔧", Color = "#8b5cf6", SortOrder = 4, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                new App { Id = Guid.NewGuid(), Name = "API Gateway", Description = "API management and routing", Icon = "🚪", Color = "#ec4899", SortOrder = 5, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                new App { Id = Guid.NewGuid(), Name = "ML Pipeline", Description = "Machine learning workflows", Icon = "🤖", Color = "#14b8a6", SortOrder = 6, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow }
            };

            await _context.Apps.AddRangeAsync(apps);

            // Create sample services for each app
            var services = new[]
            {
                // E-Commerce Platform services
                new Service { Id = Guid.NewGuid(), Name = "Storefront API", ExecutablePath = "node", Arguments = "server.js", WorkingDirectory = "/apps/storefront", Description = "Customer-facing API", OrderIndex = 0, AppId = apps[0].Id, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                new Service { Id = Guid.NewGuid(), Name = "Payment Service", ExecutablePath = "dotnet", Arguments = "PaymentService.dll", WorkingDirectory = "/apps/payments", Description = "Payment processing", OrderIndex = 1, AppId = apps[0].Id, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                new Service { Id = Guid.NewGuid(), Name = "Order Worker", ExecutablePath = "python", Arguments = "worker.py", WorkingDirectory = "/apps/orders", Description = "Background order processing", OrderIndex = 2, AppId = apps[0].Id, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                
                // Analytics Dashboard services
                new Service { Id = Guid.NewGuid(), Name = "Analytics Processor", ExecutablePath = "python", Arguments = "analytics.py", WorkingDirectory = "/apps/analytics", Description = "Data processing engine", OrderIndex = 0, AppId = apps[1].Id, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                new Service { Id = Guid.NewGuid(), Name = "Dashboard UI", ExecutablePath = "npm", Arguments = "start", WorkingDirectory = "/apps/dashboard", Description = "Web dashboard", OrderIndex = 1, AppId = apps[1].Id, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                
                // Monitoring Services
                new Service { Id = Guid.NewGuid(), Name = "Prometheus", ExecutablePath = "prometheus", Arguments = "--config.file=/etc/prometheus/prometheus.yml", WorkingDirectory = "/apps/monitoring", Description = "Metrics collection", OrderIndex = 0, AppId = apps[2].Id, IsExternal = true, AccessLink = "http://localhost:9090", CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                new Service { Id = Guid.NewGuid(), Name = "Grafana", ExecutablePath = "grafana-server", Arguments = "", WorkingDirectory = "/apps/monitoring", Description = "Metrics visualization", OrderIndex = 1, AppId = apps[2].Id, IsExternal = true, AccessLink = "http://localhost:3000", CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                
                // Developer Tools
                new Service { Id = Guid.NewGuid(), Name = "Jenkins", ExecutablePath = "java", Arguments = "-jar jenkins.war", WorkingDirectory = "/apps/jenkins", Description = "CI/CD automation", OrderIndex = 0, AppId = apps[3].Id, IsExternal = true, AccessLink = "http://localhost:8080", CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                new Service { Id = Guid.NewGuid(), Name = "Build Agent", ExecutablePath = "dotnet", Arguments = "build-agent.dll", WorkingDirectory = "/apps/build", Description = "Build executor", OrderIndex = 1, AppId = apps[3].Id, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                
                // API Gateway
                new Service { Id = Guid.NewGuid(), Name = "Gateway Service", ExecutablePath = "node", Arguments = "gateway.js", WorkingDirectory = "/apps/gateway", Description = "API gateway", OrderIndex = 0, AppId = apps[4].Id, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                
                // ML Pipeline
                new Service { Id = Guid.NewGuid(), Name = "Training Service", ExecutablePath = "python", Arguments = "train.py", WorkingDirectory = "/apps/ml", Description = "Model training", OrderIndex = 0, AppId = apps[5].Id, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                new Service { Id = Guid.NewGuid(), Name = "Inference API", ExecutablePath = "python", Arguments = "serve.py", WorkingDirectory = "/apps/ml", Description = "Model serving", OrderIndex = 1, AppId = apps[5].Id, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                
                // Unassigned services
                new Service { Id = Guid.NewGuid(), Name = "Legacy Database", ExecutablePath = "postgres", Arguments = "-D /data/postgres", WorkingDirectory = "/apps/legacy", Description = "Old database", OrderIndex = 0, AppId = null, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow },
                new Service { Id = Guid.NewGuid(), Name = "Legacy Cache", ExecutablePath = "redis-server", Arguments = "/etc/redis/redis.conf", WorkingDirectory = "/apps/legacy", Description = "Old cache", OrderIndex = 1, AppId = null, CreatedAt = DateTime.UtcNow, ModifiedAt = DateTime.UtcNow }
            };

            await _context.Services.AddRangeAsync(services);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Seeded {AppCount} apps and {ServiceCount} services", apps.Length, services.Length);
            return Ok(new { message = $"Successfully seeded {apps.Length} apps and {services.Length} services" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error seeding sample data");
            return StatusCode(500, "An error occurred while seeding sample data");
        }
    }
}
