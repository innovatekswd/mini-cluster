using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using System.Text.Json;
using Innovatek.Parallel.MiniCluster.Api.Data;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Innovatek.Parallel.TemplateEngine;
using Innovatek.Parallel.MiniCluster.Api.Dtos;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;



[ApiController]
[Authorize]
[Route("api/services/")]
public class ImportController(AppDbContext dbContext, IMapper mapper, IVariableResolverFactory variableResolverFactory, ILogger<ImportController> logger) : ControllerBase
{
    private readonly AppDbContext _dbContext = dbContext;
    private readonly ILogger<ImportController> _logger = logger;

    public class ImportRequest
    {
        public List<CreateEnvironmentDto> Environments { get; set; } = new();
        public List<ServiceBase> Services { get; set; } = new();
    }

    [HttpPost("import")]
    public async Task<IActionResult> ImportServices(IFormFile file, bool resolveVariables = false)
    {
        if (file == null || file.Length == 0)
            return BadRequest("File not provided.");

        ImportRequest? importRequest;

        try
        {
            using (var stream = file.OpenReadStream())
            {
                importRequest = await JsonSerializer.DeserializeAsync<ImportRequest>(stream, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
        }
        catch (JsonException)
        {
            return BadRequest("Failed to deserialize JSON. Please ensure the file contains valid JSON.");
        }

        if (importRequest == null)
            return BadRequest("Failed to deserialize JSON.");

        // Use transaction for atomic import (if supported by the database provider)
        var strategy = _dbContext.Database.CreateExecutionStrategy();
        IDbContextTransaction? transaction = null;
        try
        {
            // Check if transactions are supported (InMemory provider doesn't support them)
            if (_dbContext.Database.ProviderName != "Microsoft.EntityFrameworkCore.InMemory")
            {
                transaction = await _dbContext.Database.BeginTransactionAsync();
            }

            // Import Environments
            foreach (var envDto in importRequest.Environments)
        {
            // Check if the Environment already exists based on the Name
            var existingEnv = await _dbContext.Environments
                .FirstOrDefaultAsync(e => e.Name == envDto.Name);

            if (existingEnv == null)
            {
                // Create a new Environment if it doesn't exist
                var newEnv = new Environment
                {
                    Id = Guid.NewGuid(),
                    Name = envDto.Name,
                    Description = envDto.Description,
                    Variables = envDto.Variables,
                    IsActive = envDto.IsActive
                };
                _dbContext.Environments.Add(newEnv);
            }
            else
            {
                // Update the existing Environment
                existingEnv.Description = envDto.Description;
                existingEnv.Variables = envDto.Variables;
                existingEnv.IsActive = envDto.IsActive;
            }
        }

        // Import Services
        foreach (var svc in importRequest.Services)
        {
            // Validate required properties
            if (string.IsNullOrWhiteSpace(svc.Name))
                return BadRequest("Service name is required.");
            if (string.IsNullOrWhiteSpace(svc.ExecutablePath))
                return BadRequest($"ExecutablePath is required for service '{svc.Name}'.");

            if (resolveVariables)
            {
                // Ensure Environments exist before resolving
                if (importRequest.Environments.Count == 0)
                    return BadRequest("Variable resolution requested but no environments provided.");

                // Resolve variables for the service
                var variableResolver = variableResolverFactory.CreateResolver(importRequest.Environments.First().Variables);

                var (executablePath, isCircular1, circularVar1) = await variableResolver.ResolveVariablesAsync(svc.ExecutablePath);
                if (isCircular1)
                    return BadRequest($"Circular variable reference detected in ExecutablePath: {circularVar1}");
                svc.ExecutablePath = executablePath;

                if (svc.Arguments != null)
                {
                    var (resolvedArgs, isCircular2, circularVar2) = await variableResolver.ResolveVariablesAsync(svc.Arguments);
                    if (isCircular2)
                        return BadRequest($"Circular variable reference detected in Arguments: {circularVar2}");
                    svc.Arguments = resolvedArgs;
                }

                if (svc.WorkingDirectory != null)
                {
                    var (resolvedWorkDir, isCircular3, circularVar3) = await variableResolver.ResolveVariablesAsync(svc.WorkingDirectory);
                    if (isCircular3)
                        return BadRequest($"Circular variable reference detected in WorkingDirectory: {circularVar3}");
                    svc.WorkingDirectory = resolvedWorkDir;
                }

                var resolvedEnvVars = new Dictionary<string, string>();
                foreach (var (key, value) in svc.EnvironmentVariables)
                {
                    var (resolvedValue, isCircular, circularVar) = await variableResolver.ResolveVariablesAsync(value);
                    if (isCircular)
                        return BadRequest($"Circular variable reference detected in environment variable '{key}': {circularVar}");
                    resolvedEnvVars[key] = resolvedValue;
                }
                svc.EnvironmentVariables = resolvedEnvVars;
            }

            // Check if the service already exists in the database
            var existingService = await _dbContext.Services
                .FirstOrDefaultAsync(s => s.Name == svc.Name);

            if (existingService == null)
            {
                // Add the new service to the database
                var service = mapper.Map<Service>(svc);
                service.Id = Guid.NewGuid();
                service.CreatedAt = DateTime.UtcNow;
                service.ModifiedAt = DateTime.UtcNow;

                _dbContext.Services.Add(service);
            }
            else
            {
                // Update the existing service
                mapper.Map(svc, existingService);
                existingService.ModifiedAt = DateTime.UtcNow;
            }
        }

            await _dbContext.SaveChangesAsync();
            
            if (transaction != null)
            {
                await transaction.CommitAsync();
            }

            return Ok(new { Message = "Services and Environments imported successfully." });
        }
        catch (Exception ex)
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync();
            }
            _logger.LogError(ex, "Failed to import services and environments");
            return StatusCode(500, new { Message = "Import failed. Database rolled back.", Error = ex.Message });
        }
        finally
        {
            transaction?.Dispose();
        }
    }

    // GET: api/services/export
    [HttpGet("export")]
    public async Task<IActionResult> ExportConfig()
    {
        try
        {
            var environments = await _dbContext.Environments.ToListAsync();
            var services = await _dbContext.Services.ToListAsync();

            var exportData = new ConfigExportDto
            {
                Version = "1.0",
                ExportedAt = DateTime.UtcNow,
                ExportedBy = "MiniCluster",
                Environments = environments,
                Services = services,
                Metadata = new ExportMetadata
                {
                    TotalServices = services.Count,
                    TotalEnvironments = environments.Count
                }
            };

            var json = JsonSerializer.Serialize(exportData, new JsonSerializerOptions { WriteIndented = true });
            var bytes = System.Text.Encoding.UTF8.GetBytes(json);
            var stream = new MemoryStream(bytes);

            return File(stream, "application/json", $"minicluster-export-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export configuration");
            return StatusCode(500, new { error = "Export failed", details = ex.Message });
        }
    }
}
