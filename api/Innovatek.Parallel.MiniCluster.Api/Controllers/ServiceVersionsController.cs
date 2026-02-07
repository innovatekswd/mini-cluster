using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Api.Helpers;
using Innovatek.Parallel.MiniCluster.Api.Services;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/services")]
public class ServiceVersionsController : ControllerBase
{
    private readonly IServiceVersioningService _versioningService;
    private readonly IIdentifierResolver _resolver;
    private readonly ILogger<ServiceVersionsController> _logger;

    public ServiceVersionsController(
        IServiceVersioningService versioningService,
        IIdentifierResolver resolver,
        ILogger<ServiceVersionsController> logger)
    {
        _versioningService = versioningService;
        _resolver = resolver;
        _logger = logger;
    }

    // ── Service Version CRUD ───────────────────────────────────

    [HttpGet("{identifier}/versions")]
    public async Task<ActionResult<List<ServiceVersionResponseDto>>> GetVersions(
        string identifier, [FromQuery] int limit = 50, CancellationToken ct = default)
    {
        try
        {
            var resolved = await _resolver.ResolveServiceAsync(identifier);
            if (!resolved.Success) return NotFound(new { error = $"Service '{identifier}' not found" });

            var versions = await _versioningService.GetVersionsAsync(resolved.Value, limit, ct);
            return Ok(versions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting versions for service {Identifier}", identifier);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("{identifier}/versions")]
    public async Task<ActionResult<ServiceVersionResponseDto>> CreateVersion(
        string identifier, CreateVersionDto dto, CancellationToken ct)
    {
        try
        {
            var resolved = await _resolver.ResolveServiceAsync(identifier);
            if (!resolved.Success) return NotFound(new { error = $"Service '{identifier}' not found" });

            var version = await _versioningService.CreateVersionAsync(resolved.Value, dto, ct);
            return CreatedAtAction(nameof(GetVersion), new { versionId = version.Id }, version);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating version for service {Identifier}", identifier);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("~/api/service-versions/{versionId:int}")]
    public async Task<ActionResult<ServiceVersionResponseDto>> GetVersion(int versionId, CancellationToken ct)
    {
        try
        {
            var version = await _versioningService.GetVersionAsync(versionId, ct);
            if (version == null) return NotFound(new { error = $"Version {versionId} not found" });
            return Ok(version);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting version {VersionId}", versionId);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("~/api/service-versions/{versionId:int}/diff")]
    public async Task<ActionResult<string>> GetVersionDiff(
        int versionId, [FromQuery] int? compareToId, CancellationToken ct)
    {
        try
        {
            var diff = await _versioningService.GetVersionDiffAsync(versionId, compareToId, ct);
            if (diff == null) return NotFound(new { error = $"Version {versionId} not found or no changes" });
            return Ok(new { diff });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting diff for version {VersionId}", versionId);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // ── Deploy / Rollback ──────────────────────────────────────

    [HttpPost("~/api/service-versions/{versionId:int}/deploy")]
    public async Task<ActionResult<DeploymentResult>> DeployVersion(int versionId, CancellationToken ct)
    {
        try
        {
            var result = await _versioningService.DeployVersionAsync(versionId, ct);
            return result.Success ? Ok(result) : BadRequest(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deploying version {VersionId}", versionId);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("{identifier}/rollback")]
    public async Task<ActionResult<DeploymentResult>> Rollback(
        string identifier, [FromQuery] int? targetVersionId, CancellationToken ct)
    {
        try
        {
            var resolved = await _resolver.ResolveServiceAsync(identifier);
            if (!resolved.Success) return NotFound(new { error = $"Service '{identifier}' not found" });

            var result = await _versioningService.RollbackAsync(resolved.Value, targetVersionId, ct);
            return result.Success ? Ok(result) : BadRequest(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rolling back service {Identifier}", identifier);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // ── Deployment Config ──────────────────────────────────────

    [HttpGet("{identifier}/deployment-config")]
    public async Task<ActionResult<DeploymentConfigDto>> GetDeploymentConfig(
        string identifier, CancellationToken ct)
    {
        try
        {
            var resolved = await _resolver.ResolveServiceAsync(identifier);
            if (!resolved.Success) return NotFound(new { error = $"Service '{identifier}' not found" });

            var config = await _versioningService.GetDeploymentConfigAsync(resolved.Value, ct);
            if (config == null)
            {
                // Return defaults
                return Ok(new DeploymentConfigDto
                {
                    ServiceId = resolved.Value,
                    Strategy = 0,
                    AutoRollbackOnFailure = true,
                    RollbackTimeoutSeconds = 60,
                    WaitForHealthy = true,
                    HealthCheckTimeoutSeconds = 30,
                    MaxVersionsToKeep = 10,
                    AutoVersionOnSave = true
                });
            }
            return Ok(config);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting deployment config for {Identifier}", identifier);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPut("{identifier}/deployment-config")]
    public async Task<ActionResult<DeploymentConfigDto>> UpdateDeploymentConfig(
        string identifier, UpdateDeploymentConfigDto dto, CancellationToken ct)
    {
        try
        {
            var resolved = await _resolver.ResolveServiceAsync(identifier);
            if (!resolved.Success) return NotFound(new { error = $"Service '{identifier}' not found" });

            var config = await _versioningService.UpdateDeploymentConfigAsync(resolved.Value, dto, ct);
            return Ok(config);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating deployment config for {Identifier}", identifier);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // ── App Snapshots ──────────────────────────────────────────

    [HttpGet("~/api/apps/{appIdentifier}/snapshots")]
    public async Task<ActionResult<List<AppSnapshotResponseDto>>> GetAppSnapshots(
        string appIdentifier, [FromQuery] int limit = 50, CancellationToken ct = default)
    {
        try
        {
            var resolved = await _resolver.ResolveAppAsync(appIdentifier);
            if (!resolved.Success) return NotFound(new { error = $"App '{appIdentifier}' not found" });

            var snapshots = await _versioningService.GetAppSnapshotsAsync(resolved.Value, limit, ct);
            return Ok(snapshots);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting snapshots for app {AppIdentifier}", appIdentifier);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("~/api/apps/{appIdentifier}/snapshots")]
    public async Task<ActionResult<AppSnapshotResponseDto>> CreateAppSnapshot(
        string appIdentifier, CreateAppSnapshotDto dto, CancellationToken ct)
    {
        try
        {
            var resolved = await _resolver.ResolveAppAsync(appIdentifier);
            if (!resolved.Success) return NotFound(new { error = $"App '{appIdentifier}' not found" });

            // Extract userId from claims if available
            var userIdClaim = User.FindFirst("sub")?.Value ?? User.FindFirst("userId")?.Value;
            Guid? userId = Guid.TryParse(userIdClaim, out var uid) ? uid : null;

            var snapshot = await _versioningService.CreateAppSnapshotAsync(resolved.Value, dto, userId, ct);
            return CreatedAtAction(nameof(GetAppSnapshot), new { snapshotId = snapshot.Id }, snapshot);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating snapshot for app {AppIdentifier}", appIdentifier);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("~/api/app-snapshots/{snapshotId:int}")]
    public async Task<ActionResult<AppSnapshotResponseDto>> GetAppSnapshot(int snapshotId, CancellationToken ct)
    {
        try
        {
            var snapshot = await _versioningService.GetAppSnapshotAsync(snapshotId, ct);
            if (snapshot == null) return NotFound(new { error = $"Snapshot {snapshotId} not found" });
            return Ok(snapshot);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting snapshot {SnapshotId}", snapshotId);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("~/api/app-snapshots/{snapshotId:int}/deploy")]
    public async Task<ActionResult<DeploymentResult>> DeployAppSnapshot(int snapshotId, CancellationToken ct)
    {
        try
        {
            var result = await _versioningService.DeployAppSnapshotAsync(snapshotId, ct);
            return result.Success ? Ok(result) : BadRequest(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deploying snapshot {SnapshotId}", snapshotId);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
