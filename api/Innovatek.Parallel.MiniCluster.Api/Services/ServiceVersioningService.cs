using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

public interface IServiceVersioningService
{
    // Service versions
    Task<ServiceVersionResponseDto> CreateVersionAsync(Guid serviceId, CreateVersionDto dto, CancellationToken ct = default);
    Task<List<ServiceVersionResponseDto>> GetVersionsAsync(Guid serviceId, int limit = 50, CancellationToken ct = default);
    Task<ServiceVersionResponseDto?> GetVersionAsync(int versionId, CancellationToken ct = default);
    Task<string?> GetVersionDiffAsync(int versionId, int? compareToId, CancellationToken ct = default);

    // Deploy / rollback
    Task<DeploymentResult> DeployVersionAsync(int versionId, CancellationToken ct = default);
    Task<DeploymentResult> RollbackAsync(Guid serviceId, int? targetVersionId, CancellationToken ct = default);

    // Auto-versioning on config save
    Task AutoVersionOnSaveAsync(Guid serviceId, CancellationToken ct = default);

    // Deployment config
    Task<DeploymentConfigDto?> GetDeploymentConfigAsync(Guid serviceId, CancellationToken ct = default);
    Task<DeploymentConfigDto> UpdateDeploymentConfigAsync(Guid serviceId, UpdateDeploymentConfigDto dto, CancellationToken ct = default);

    // App snapshots
    Task<AppSnapshotResponseDto> CreateAppSnapshotAsync(Guid appId, CreateAppSnapshotDto dto, Guid? userId, CancellationToken ct = default);
    Task<List<AppSnapshotResponseDto>> GetAppSnapshotsAsync(Guid appId, int limit = 50, CancellationToken ct = default);
    Task<AppSnapshotResponseDto?> GetAppSnapshotAsync(int snapshotId, CancellationToken ct = default);
    Task<DeploymentResult> DeployAppSnapshotAsync(int snapshotId, CancellationToken ct = default);
}

public class ServiceVersioningService : IServiceVersioningService
{
    private readonly AppDbContext _context;
    private readonly IServiceProcessManager _processManager;
    private readonly ILogger<ServiceVersioningService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public ServiceVersioningService(
        AppDbContext context,
        IServiceProcessManager processManager,
        ILogger<ServiceVersioningService> logger)
    {
        _context = context;
        _processManager = processManager;
        _logger = logger;
    }

    public async Task<ServiceVersionResponseDto> CreateVersionAsync(Guid serviceId, CreateVersionDto dto, CancellationToken ct = default)
    {
        var service = await _context.Services.FindAsync(new object[] { serviceId }, ct)
            ?? throw new KeyNotFoundException($"Service {serviceId} not found");

        var lastSeq = await _context.ServiceVersions
            .Where(v => v.ServiceId == serviceId)
            .MaxAsync(v => (int?)v.SequenceNumber, ct) ?? 0;

        var snapshot = CreateConfigSnapshot(service);
        var previousVersion = await _context.ServiceVersions
            .Where(v => v.ServiceId == serviceId)
            .OrderByDescending(v => v.SequenceNumber)
            .FirstOrDefaultAsync(ct);

        var version = new ServiceVersion
        {
            ServiceId = serviceId,
            Version = dto.Version ?? $"v{lastSeq + 1}",
            SequenceNumber = lastSeq + 1,
            Label = dto.Label,
            ConfigSnapshot = snapshot,
            ConfigDiff = previousVersion != null ? ComputeDiff(previousVersion.ConfigSnapshot, snapshot) : null,
            Source = dto.Source,
            GitCommit = dto.GitCommit,
            DeploymentStatus = DeploymentStatus.Active,
            DeployedAt = DateTime.UtcNow,
            DeploymentNotes = dto.Notes
        };

        // Mark previous active version as superseded
        if (previousVersion != null && previousVersion.DeploymentStatus == DeploymentStatus.Active)
        {
            previousVersion.DeploymentStatus = DeploymentStatus.Superseded;
        }

        _context.ServiceVersions.Add(version);
        await _context.SaveChangesAsync(ct);

        // Prune old versions
        await PruneVersionsAsync(serviceId, ct);

        _logger.LogInformation("Created version {Version} for service {ServiceId}", version.Version, serviceId);
        return MapVersionToDto(version);
    }

    public async Task<List<ServiceVersionResponseDto>> GetVersionsAsync(Guid serviceId, int limit = 50, CancellationToken ct = default)
    {
        var versions = await _context.ServiceVersions
            .Where(v => v.ServiceId == serviceId)
            .OrderByDescending(v => v.SequenceNumber)
            .Take(limit)
            .ToListAsync(ct);

        return versions.Select(MapVersionToDto).ToList();
    }

    public async Task<ServiceVersionResponseDto?> GetVersionAsync(int versionId, CancellationToken ct = default)
    {
        var version = await _context.ServiceVersions.FindAsync(new object[] { versionId }, ct);
        return version == null ? null : MapVersionToDto(version);
    }

    public async Task<string?> GetVersionDiffAsync(int versionId, int? compareToId, CancellationToken ct = default)
    {
        var version = await _context.ServiceVersions.FindAsync(new object[] { versionId }, ct);
        if (version == null) return null;

        if (compareToId.HasValue)
        {
            var other = await _context.ServiceVersions.FindAsync(new object[] { compareToId.Value }, ct);
            if (other != null)
                return ComputeDiff(other.ConfigSnapshot, version.ConfigSnapshot);
        }

        return version.ConfigDiff;
    }

    public async Task<DeploymentResult> DeployVersionAsync(int versionId, CancellationToken ct = default)
    {
        var version = await _context.ServiceVersions
            .Include(v => v.Service)
            .FirstOrDefaultAsync(v => v.Id == versionId, ct);

        if (version == null)
            return new DeploymentResult { Success = false, Message = "Version not found" };

        return await ApplyVersionAsync(version, ct);
    }

    public async Task<DeploymentResult> RollbackAsync(Guid serviceId, int? targetVersionId, CancellationToken ct = default)
    {
        ServiceVersion? targetVersion;

        if (targetVersionId.HasValue)
        {
            targetVersion = await _context.ServiceVersions
                .Include(v => v.Service)
                .FirstOrDefaultAsync(v => v.Id == targetVersionId.Value && v.ServiceId == serviceId, ct);
        }
        else
        {
            // Rollback to the version before the current active one
            targetVersion = await _context.ServiceVersions
                .Include(v => v.Service)
                .Where(v => v.ServiceId == serviceId && v.DeploymentStatus != DeploymentStatus.Active)
                .OrderByDescending(v => v.SequenceNumber)
                .FirstOrDefaultAsync(ct);
        }

        if (targetVersion == null)
            return new DeploymentResult { Success = false, Message = "No version to rollback to" };

        // Create a new version recording the rollback
        var result = await ApplyVersionAsync(targetVersion, ct);
        if (result.Success)
        {
            targetVersion.RolledBackAt = null; // It's now active, not rolled back
            await CreateVersionAsync(targetVersion.ServiceId, new CreateVersionDto
            {
                Label = $"Rollback to {targetVersion.Version}",
                Source = VersionSource.Rollback
            }, ct);
        }

        return result;
    }

    public async Task AutoVersionOnSaveAsync(Guid serviceId, CancellationToken ct = default)
    {
        // Check if auto-versioning is enabled
        var config = await _context.DeploymentConfigs
            .FirstOrDefaultAsync(c => c.ServiceId == serviceId, ct);

        if (config != null && !config.AutoVersionOnSave) return;

        await CreateVersionAsync(serviceId, new CreateVersionDto
        {
            Source = VersionSource.ConfigChange,
            Label = "Auto-saved on config change"
        }, ct);
    }

    public async Task<DeploymentConfigDto?> GetDeploymentConfigAsync(Guid serviceId, CancellationToken ct = default)
    {
        var config = await _context.DeploymentConfigs
            .FirstOrDefaultAsync(c => c.ServiceId == serviceId, ct);

        return config == null ? null : MapConfigToDto(config);
    }

    public async Task<DeploymentConfigDto> UpdateDeploymentConfigAsync(Guid serviceId, UpdateDeploymentConfigDto dto, CancellationToken ct = default)
    {
        var config = await _context.DeploymentConfigs
            .FirstOrDefaultAsync(c => c.ServiceId == serviceId, ct);

        if (config == null)
        {
            config = new DeploymentConfig { ServiceId = serviceId };
            _context.DeploymentConfigs.Add(config);
        }

        if (dto.Strategy.HasValue) config.Strategy = (DeploymentStrategy)dto.Strategy.Value;
        if (dto.AutoRollbackOnFailure.HasValue) config.AutoRollbackOnFailure = dto.AutoRollbackOnFailure.Value;
        if (dto.RollbackTimeoutSeconds.HasValue) config.RollbackTimeoutSeconds = dto.RollbackTimeoutSeconds.Value;
        if (dto.WaitForHealthy.HasValue) config.WaitForHealthy = dto.WaitForHealthy.Value;
        if (dto.HealthCheckTimeoutSeconds.HasValue) config.HealthCheckTimeoutSeconds = dto.HealthCheckTimeoutSeconds.Value;
        if (dto.MaxVersionsToKeep.HasValue) config.MaxVersionsToKeep = dto.MaxVersionsToKeep.Value;
        if (dto.AutoVersionOnSave.HasValue) config.AutoVersionOnSave = dto.AutoVersionOnSave.Value;

        await _context.SaveChangesAsync(ct);
        return MapConfigToDto(config);
    }

    // ── App Snapshots ──────────────────────────────────────────

    public async Task<AppSnapshotResponseDto> CreateAppSnapshotAsync(Guid appId, CreateAppSnapshotDto dto, Guid? userId, CancellationToken ct = default)
    {
        var app = await _context.Apps.Include(a => a.Services).FirstOrDefaultAsync(a => a.Id == appId, ct)
            ?? throw new KeyNotFoundException($"App {appId} not found");

        var lastSnapshot = await _context.AppSnapshots
            .Where(s => s.AppId == appId)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync(ct);

        var snapshotVersion = dto.Version ?? $"snap-{(lastSnapshot?.Id ?? 0) + 1}";

        var snapshot = new AppSnapshot
        {
            AppId = appId,
            Version = snapshotVersion,
            Label = dto.Label,
            CreatedBy = userId
        };

        // For each service in the app, find the current active version
        foreach (var service in app.Services)
        {
            var activeVersion = await _context.ServiceVersions
                .Where(v => v.ServiceId == service.Id && v.DeploymentStatus == DeploymentStatus.Active)
                .OrderByDescending(v => v.SequenceNumber)
                .FirstOrDefaultAsync(ct);

            if (activeVersion != null)
            {
                snapshot.Entries.Add(new AppSnapshotEntry
                {
                    ServiceId = service.Id,
                    ServiceVersionId = activeVersion.Id
                });
            }
        }

        _context.AppSnapshots.Add(snapshot);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Created app snapshot {Version} for app {AppId}", snapshotVersion, appId);
        return await MapSnapshotToDtoAsync(snapshot, ct);
    }

    public async Task<List<AppSnapshotResponseDto>> GetAppSnapshotsAsync(Guid appId, int limit = 50, CancellationToken ct = default)
    {
        var snapshots = await _context.AppSnapshots
            .Include(s => s.Entries)
            .Where(s => s.AppId == appId)
            .OrderByDescending(s => s.CreatedAt)
            .Take(limit)
            .ToListAsync(ct);

        var dtos = new List<AppSnapshotResponseDto>();
        foreach (var snap in snapshots)
            dtos.Add(await MapSnapshotToDtoAsync(snap, ct));
        return dtos;
    }

    public async Task<AppSnapshotResponseDto?> GetAppSnapshotAsync(int snapshotId, CancellationToken ct = default)
    {
        var snapshot = await _context.AppSnapshots
            .Include(s => s.Entries)
            .FirstOrDefaultAsync(s => s.Id == snapshotId, ct);

        return snapshot == null ? null : await MapSnapshotToDtoAsync(snapshot, ct);
    }

    public async Task<DeploymentResult> DeployAppSnapshotAsync(int snapshotId, CancellationToken ct = default)
    {
        var snapshot = await _context.AppSnapshots
            .Include(s => s.Entries)
            .FirstOrDefaultAsync(s => s.Id == snapshotId, ct);

        if (snapshot == null)
            return new DeploymentResult { Success = false, Message = "Snapshot not found" };

        var errors = new List<string>();
        foreach (var entry in snapshot.Entries)
        {
            var version = await _context.ServiceVersions
                .Include(v => v.Service)
                .FirstOrDefaultAsync(v => v.Id == entry.ServiceVersionId, ct);

            if (version != null)
            {
                var result = await ApplyVersionAsync(version, ct);
                if (!result.Success)
                    errors.Add($"{version.Service?.Name}: {result.Message}");
            }
        }

        return errors.Count == 0
            ? new DeploymentResult { Success = true, Message = "Snapshot deployed", NewVersion = snapshot.Version }
            : new DeploymentResult { Success = false, Message = string.Join("; ", errors) };
    }

    // ── Private helpers ────────────────────────────────────────

    private async Task<DeploymentResult> ApplyVersionAsync(ServiceVersion version, CancellationToken ct)
    {
        var service = version.Service ?? await _context.Services.FindAsync(new object[] { version.ServiceId }, ct);
        if (service == null)
            return new DeploymentResult { Success = false, Message = "Service not found" };

        var previousVersion = service.Name; // For result message

        try
        {
            // Stop current service if running
            var status = _processManager.GetStatus(service.Id);
            if (status == ServiceRuntimeStatus.Running)
                await _processManager.StopServiceAsync(service.Id);

            // Apply config snapshot
            var config = JsonSerializer.Deserialize<ConfigSnapshotData>(version.ConfigSnapshot, JsonOptions);
            if (config != null)
            {
                service.ExecutablePath = config.ExecutablePath ?? service.ExecutablePath;
                service.Arguments = config.Arguments;
                service.WorkingDirectory = config.WorkingDirectory;
                if (config.EnvironmentVariables != null)
                    service.EnvironmentVariables = config.EnvironmentVariables;
                service.AccessLink = config.AccessLink;
                service.AutoStart = config.AutoStart;
                service.UseShellExecute = config.UseShellExecute;
                service.CreateNoWindow = config.CreateNoWindow;
                service.CaptureOutput = config.CaptureOutput;
                service.RestartPolicy = (RestartPolicy)config.RestartPolicy;
                service.MaxRestarts = config.MaxRestarts;
                service.HealthCheckType = (HealthCheckType)config.HealthCheckType;
                service.HealthCheckTarget = config.HealthCheckTarget;
            }

            service.ModifiedAt = DateTime.UtcNow;

            // Mark this version as active, others as superseded
            var activeVersions = await _context.ServiceVersions
                .Where(v => v.ServiceId == service.Id && v.DeploymentStatus == DeploymentStatus.Active)
                .ToListAsync(ct);
            foreach (var v in activeVersions)
                v.DeploymentStatus = DeploymentStatus.Superseded;

            version.DeploymentStatus = DeploymentStatus.Active;
            version.DeployedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync(ct);

            // Restart if it was running
            if (status == ServiceRuntimeStatus.Running)
                await _processManager.StartServiceAsync(service.Id, "version-deploy");

            return new DeploymentResult
            {
                Success = true,
                Message = $"Deployed version {version.Version}",
                NewVersion = version.Version
            };
        }
        catch (Exception ex)
        {
            version.DeploymentStatus = DeploymentStatus.Failed;
            await _context.SaveChangesAsync(ct);
            _logger.LogError(ex, "Failed to deploy version {Version} for service {ServiceId}", version.Version, version.ServiceId);
            return new DeploymentResult { Success = false, Message = ex.Message };
        }
    }

    private static string CreateConfigSnapshot(Service service)
    {
        var data = new ConfigSnapshotData
        {
            ExecutablePath = service.ExecutablePath,
            Arguments = service.Arguments,
            WorkingDirectory = service.WorkingDirectory,
            EnvironmentVariables = service.EnvironmentVariables,
            AccessLink = service.AccessLink,
            AutoStart = service.AutoStart,
            UseShellExecute = service.UseShellExecute,
            CreateNoWindow = service.CreateNoWindow,
            CaptureOutput = service.CaptureOutput,
            RestartPolicy = (int)service.RestartPolicy,
            MaxRestarts = service.MaxRestarts,
            HealthCheckType = (int)service.HealthCheckType,
            HealthCheckTarget = service.HealthCheckTarget
        };
        return JsonSerializer.Serialize(data, JsonOptions);
    }

    private static string? ComputeDiff(string oldSnapshot, string newSnapshot)
    {
        if (oldSnapshot == newSnapshot) return null;

        try
        {
            var oldDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(oldSnapshot);
            var newDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(newSnapshot);
            if (oldDict == null || newDict == null) return null;

            var changes = new Dictionary<string, object>();
            foreach (var (key, newVal) in newDict)
            {
                if (!oldDict.TryGetValue(key, out var oldVal) || oldVal.ToString() != newVal.ToString())
                {
                    changes[key] = new
                    {
                        from = oldDict.TryGetValue(key, out var ov) ? ov.ToString() : "(none)",
                        to = newVal.ToString()
                    };
                }
            }

            return changes.Count > 0 ? JsonSerializer.Serialize(changes, JsonOptions) : null;
        }
        catch
        {
            return "Unable to compute diff";
        }
    }

    private async Task PruneVersionsAsync(Guid serviceId, CancellationToken ct)
    {
        var config = await _context.DeploymentConfigs
            .FirstOrDefaultAsync(c => c.ServiceId == serviceId, ct);
        var maxKeep = config?.MaxVersionsToKeep ?? 10;

        var excess = await _context.ServiceVersions
            .Where(v => v.ServiceId == serviceId)
            .OrderByDescending(v => v.SequenceNumber)
            .Skip(maxKeep)
            .ToListAsync(ct);

        if (excess.Count > 0)
        {
            _context.ServiceVersions.RemoveRange(excess);
            await _context.SaveChangesAsync(ct);
        }
    }

    private static ServiceVersionResponseDto MapVersionToDto(ServiceVersion v)
    {
        return new ServiceVersionResponseDto
        {
            Id = v.Id,
            ServiceId = v.ServiceId,
            Version = v.Version,
            SequenceNumber = v.SequenceNumber,
            Label = v.Label,
            Source = v.Source,
            DeploymentStatus = v.DeploymentStatus,
            CreatedAt = v.CreatedAt,
            DeployedAt = v.DeployedAt,
            GitCommit = v.GitCommit,
            ConfigDiff = v.ConfigDiff,
            DeploymentNotes = v.DeploymentNotes
        };
    }

    private static DeploymentConfigDto MapConfigToDto(DeploymentConfig c)
    {
        return new DeploymentConfigDto
        {
            Id = c.Id,
            ServiceId = c.ServiceId,
            Strategy = (int)c.Strategy,
            AutoRollbackOnFailure = c.AutoRollbackOnFailure,
            RollbackTimeoutSeconds = c.RollbackTimeoutSeconds,
            WaitForHealthy = c.WaitForHealthy,
            HealthCheckTimeoutSeconds = c.HealthCheckTimeoutSeconds,
            MaxVersionsToKeep = c.MaxVersionsToKeep,
            AutoVersionOnSave = c.AutoVersionOnSave
        };
    }

    private async Task<AppSnapshotResponseDto> MapSnapshotToDtoAsync(AppSnapshot snap, CancellationToken ct)
    {
        var dto = new AppSnapshotResponseDto
        {
            Id = snap.Id,
            AppId = snap.AppId,
            Version = snap.Version,
            Label = snap.Label,
            CreatedAt = snap.CreatedAt,
            CreatedBy = snap.CreatedBy
        };

        foreach (var entry in snap.Entries)
        {
            var sv = await _context.ServiceVersions.FindAsync(new object[] { entry.ServiceVersionId }, ct);
            var service = await _context.Services.FindAsync(new object[] { entry.ServiceId }, ct);

            dto.Entries.Add(new AppSnapshotEntryDto
            {
                ServiceId = entry.ServiceId,
                ServiceName = service?.Name ?? "(deleted)",
                ServiceVersionId = entry.ServiceVersionId,
                ServiceVersion = sv?.Version ?? "(deleted)"
            });
        }

        return dto;
    }

    private class ConfigSnapshotData
    {
        public string? ExecutablePath { get; set; }
        public string? Arguments { get; set; }
        public string? WorkingDirectory { get; set; }
        public Dictionary<string, string>? EnvironmentVariables { get; set; }
        public string? AccessLink { get; set; }
        public bool AutoStart { get; set; }
        public bool UseShellExecute { get; set; }
        public bool CreateNoWindow { get; set; }
        public int CaptureOutput { get; set; }
        public int RestartPolicy { get; set; }
        public int MaxRestarts { get; set; }
        public int HealthCheckType { get; set; }
        public string? HealthCheckTarget { get; set; }
    }
}
