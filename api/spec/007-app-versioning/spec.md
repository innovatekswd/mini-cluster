# Feature 007: App Versioning & Deployment

## Overview

Track application configuration history, enable rollbacks to previous versions, and support advanced deployment strategies like blue-green and canary deployments. This feature transforms MiniCluster from a runtime manager into a deployment platform.

---

## Business Value

### Problems Solved

| Problem | Impact | Solution |
|---------|--------|----------|
| "What changed?" | Hours debugging | Version history with diffs |
| "Rollback needed!" | Downtime | One-click rollback |
| Risky deployments | Fear of updates | Blue-green deployments |
| Manual deployments | Human error | Git-triggered deploys |
| No audit trail | Compliance issues | Full deployment history |

### Use Cases

1. **Quick Rollback** - New version has bugs? Rollback in seconds
2. **Configuration Tracking** - See exactly what changed and when
3. **Zero-Downtime Updates** - Blue-green keeps service running
4. **CI/CD Integration** - Deploy on git push via webhooks
5. **Compliance** - Audit trail of who deployed what

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VERSION & DEPLOYMENT FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│  │   Version   │────▶│  Deployment │────▶│   Runtime   │                  │
│  │   History   │     │   Strategy  │     │   (Active)  │                  │
│  └─────────────┘     └─────────────┘     └─────────────┘                  │
│         │                   │                   │                          │
│         │                   │                   │                          │
│  ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐                    │
│  │   v1.0.0    │    │  Immediate  │    │   Slot A    │◀── Active          │
│  │   v1.1.0    │    │  Blue-Green │    │   Slot B    │◀── Standby         │
│  │   v1.2.0 ◀─┼────│  Canary     │    │             │                    │
│  │   (current) │    │  Rolling    │    │             │                    │
│  └─────────────┘    └─────────────┘    └─────────────┘                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         TRIGGERS                                     │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │   │
│  │  │  Manual │  │   Git   │  │   API   │  │Schedule │               │   │
│  │  │   UI    │  │ Webhook │  │  Call   │  │ (cron)  │               │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Version Entity

```csharp
public class AppVersion
{
    public int Id { get; set; }
    public Guid AppId { get; set; }
    public App App { get; set; } = null!;
    
    // Version identification
    public string Version { get; set; } = "";            // e.g., "1.2.3" or "abc123" (git SHA)
    public int SequenceNumber { get; set; }              // Auto-incrementing
    public string? Label { get; set; }                   // Optional friendly name
    
    // Configuration snapshot
    public string ConfigSnapshot { get; set; } = "";     // JSON of full App config
    public string? ConfigDiff { get; set; }              // Diff from previous version
    
    // Source information
    public VersionSource Source { get; set; } = VersionSource.Manual;
    public string? GitCommit { get; set; }               // Git SHA if from git
    public string? GitBranch { get; set; }
    public string? GitMessage { get; set; }              // Commit message
    public string? ArtifactUrl { get; set; }             // URL to deployment artifact
    
    // Deployment history
    public DeploymentStatus DeploymentStatus { get; set; } = DeploymentStatus.Pending;
    public DateTime? DeployedAt { get; set; }
    public DateTime? RolledBackAt { get; set; }
    public string? DeploymentNotes { get; set; }
    
    // Audit
    public Guid? DeployedBy { get; set; }                // User ID
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Metadata
    public Dictionary<string, string> Metadata { get; set; } = new();
}

public enum VersionSource
{
    Manual = 0,          // Created via UI/API
    GitPush = 1,         // Triggered by git webhook
    GitTag = 2,          // Triggered by git tag
    Api = 3,             // Triggered by external API
    Rollback = 4,        // Created during rollback
    Schedule = 5         // Scheduled deployment
}

public enum DeploymentStatus
{
    Pending = 0,         // Not yet deployed
    Deploying = 1,       // Currently being deployed
    Active = 2,          // Currently running
    RolledBack = 3,      // Was active, then rolled back
    Failed = 4,          // Deployment failed
    Superseded = 5       // Replaced by newer version
}
```

### Deployment Slot (for Blue-Green)

```csharp
public class DeploymentSlot
{
    public int Id { get; set; }
    public Guid AppId { get; set; }
    
    public string Name { get; set; } = "";               // "blue" or "green"
    public int? VersionId { get; set; }                  // Currently deployed version
    public AppVersion? Version { get; set; }
    
    public bool IsActive { get; set; } = false;          // Receiving traffic?
    public int TrafficPercentage { get; set; } = 0;      // For canary (0-100)
    
    // Runtime state
    public string? ProcessId { get; set; }               // OS PID or Container ID
    public DateTime? StartedAt { get; set; }
    public HealthStatus HealthStatus { get; set; } = HealthStatus.Unknown;
}
```

### Deployment Configuration

```csharp
public class DeploymentConfig
{
    public int Id { get; set; }
    public Guid AppId { get; set; }
    
    // Strategy
    public DeploymentStrategy Strategy { get; set; } = DeploymentStrategy.Immediate;
    
    // Blue-Green settings
    public bool KeepPreviousSlot { get; set; } = true;   // Keep standby running
    public int SwitchDelaySeconds { get; set; } = 30;    // Wait before switching traffic
    
    // Canary settings
    public int CanaryPercentage { get; set; } = 10;      // Initial traffic %
    public int CanaryStepPercentage { get; set; } = 10;  // Increment per step
    public int CanaryStepDelaySeconds { get; set; } = 60;
    
    // Rollback
    public bool AutoRollbackOnFailure { get; set; } = true;
    public int RollbackTimeoutSeconds { get; set; } = 300;
    
    // Health check before traffic switch
    public bool WaitForHealthy { get; set; } = true;
    public int HealthCheckTimeoutSeconds { get; set; } = 120;
    
    // Versioning
    public int MaxVersionsToKeep { get; set; } = 10;     // Auto-cleanup old versions
    public bool AutoVersionOnSave { get; set; } = true;  // Create version on config change
}

public enum DeploymentStrategy
{
    Immediate = 0,       // Stop old, start new (downtime)
    BlueGreen = 1,       // Run both, switch traffic
    Canary = 2,          // Gradual traffic shift
    Rolling = 3          // For replicas: update one at a time
}
```

### Git Integration

```csharp
public class GitIntegration
{
    public int Id { get; set; }
    public Guid AppId { get; set; }
    
    // Repository
    public string RepositoryUrl { get; set; } = "";      // https://github.com/user/repo
    public string? Branch { get; set; } = "main";
    public string? DeployPath { get; set; }              // Path within repo
    
    // Authentication
    public GitAuthType AuthType { get; set; } = GitAuthType.None;
    public string? AccessToken { get; set; }             // Encrypted
    public string? SshKeyId { get; set; }                // Reference to stored SSH key
    
    // Webhook
    public string WebhookSecret { get; set; } = "";      // For validating webhooks
    public string? WebhookId { get; set; }               // GitHub/GitLab webhook ID
    
    // Triggers
    public bool DeployOnPush { get; set; } = true;
    public bool DeployOnTag { get; set; } = true;
    public string? TagPattern { get; set; } = "v*";      // e.g., "v*" for v1.0.0
    
    // Build
    public string? BuildCommand { get; set; }            // Run before deploy
    public string? ArtifactPath { get; set; }            // What to deploy
    
    // State
    public string? LastCommit { get; set; }
    public DateTime? LastSync { get; set; }
}

public enum GitAuthType
{
    None = 0,
    Token = 1,           // Personal access token
    SshKey = 2,          // SSH key
    App = 3              // GitHub App
}
```

---

## Deployment Service

```csharp
public interface IDeploymentService
{
    // Versions
    Task<AppVersion> CreateVersionAsync(Guid appId, CreateVersionDto dto, CancellationToken ct);
    Task<List<AppVersion>> GetVersionsAsync(Guid appId, int limit, CancellationToken ct);
    Task<AppVersion?> GetVersionAsync(int versionId, CancellationToken ct);
    Task<string> GetVersionDiffAsync(int versionId, int? compareToId, CancellationToken ct);
    
    // Deployments
    Task<DeploymentResult> DeployVersionAsync(int versionId, DeployOptions options, CancellationToken ct);
    Task<DeploymentResult> RollbackAsync(Guid appId, int? targetVersionId, CancellationToken ct);
    Task<DeploymentStatus> GetDeploymentStatusAsync(Guid appId, CancellationToken ct);
    
    // Blue-Green
    Task SwitchTrafficAsync(Guid appId, string toSlot, CancellationToken ct);
    Task<List<DeploymentSlot>> GetSlotsAsync(Guid appId, CancellationToken ct);
    
    // Canary
    Task AdjustCanaryTrafficAsync(Guid appId, int percentage, CancellationToken ct);
    Task PromoteCanaryAsync(Guid appId, CancellationToken ct);
}

public class DeploymentService : IDeploymentService
{
    public async Task<AppVersion> CreateVersionAsync(Guid appId, CreateVersionDto dto, CancellationToken ct)
    {
        var app = await _db.Apps.FindAsync(appId);
        
        // Get next sequence number
        var lastVersion = await _db.AppVersions
            .Where(v => v.AppId == appId)
            .OrderByDescending(v => v.SequenceNumber)
            .FirstOrDefaultAsync(ct);
        
        var sequenceNumber = (lastVersion?.SequenceNumber ?? 0) + 1;
        
        // Create config snapshot
        var configSnapshot = SerializeAppConfig(app);
        var configDiff = lastVersion != null 
            ? GenerateDiff(lastVersion.ConfigSnapshot, configSnapshot)
            : null;
        
        var version = new AppVersion
        {
            AppId = appId,
            Version = dto.Version ?? $"v{sequenceNumber}",
            SequenceNumber = sequenceNumber,
            Label = dto.Label,
            ConfigSnapshot = configSnapshot,
            ConfigDiff = configDiff,
            Source = dto.Source,
            GitCommit = dto.GitCommit,
            GitBranch = dto.GitBranch,
            GitMessage = dto.GitMessage,
            DeployedBy = _currentUser.Id
        };
        
        _db.AppVersions.Add(version);
        await _db.SaveChangesAsync(ct);
        
        // Cleanup old versions if configured
        await CleanupOldVersionsAsync(appId, ct);
        
        _logger.LogInformation("Created version {Version} (#{Seq}) for app {AppId}",
            version.Version, version.SequenceNumber, appId);
        
        return version;
    }
    
    public async Task<DeploymentResult> DeployVersionAsync(
        int versionId, 
        DeployOptions options, 
        CancellationToken ct)
    {
        var version = await _db.AppVersions
            .Include(v => v.App)
            .ThenInclude(a => a.DeploymentConfig)
            .FirstOrDefaultAsync(v => v.Id == versionId, ct);
        
        var config = version.App.DeploymentConfig ?? new DeploymentConfig();
        var strategy = options.Strategy ?? config.Strategy;
        
        version.DeploymentStatus = DeploymentStatus.Deploying;
        await _db.SaveChangesAsync(ct);
        
        try
        {
            var result = strategy switch
            {
                DeploymentStrategy.Immediate => await DeployImmediateAsync(version, ct),
                DeploymentStrategy.BlueGreen => await DeployBlueGreenAsync(version, config, ct),
                DeploymentStrategy.Canary => await DeployCanaryAsync(version, config, ct),
                DeploymentStrategy.Rolling => await DeployRollingAsync(version, config, ct),
                _ => throw new NotSupportedException()
            };
            
            if (result.Success)
            {
                // Mark previous active version as superseded
                var previousActive = await _db.AppVersions
                    .Where(v => v.AppId == version.AppId && v.DeploymentStatus == DeploymentStatus.Active)
                    .ToListAsync(ct);
                    
                foreach (var prev in previousActive)
                    prev.DeploymentStatus = DeploymentStatus.Superseded;
                
                version.DeploymentStatus = DeploymentStatus.Active;
                version.DeployedAt = DateTime.UtcNow;
            }
            else
            {
                version.DeploymentStatus = DeploymentStatus.Failed;
                
                if (config.AutoRollbackOnFailure)
                    await RollbackAsync(version.AppId, null, ct);
            }
            
            await _db.SaveChangesAsync(ct);
            return result;
        }
        catch (Exception ex)
        {
            version.DeploymentStatus = DeploymentStatus.Failed;
            await _db.SaveChangesAsync(ct);
            throw;
        }
    }
    
    private async Task<DeploymentResult> DeployBlueGreenAsync(
        AppVersion version, 
        DeploymentConfig config, 
        CancellationToken ct)
    {
        var app = version.App;
        
        // Get or create slots
        var slots = await GetOrCreateSlotsAsync(app.Id, ct);
        var activeSlot = slots.FirstOrDefault(s => s.IsActive);
        var standbySlot = slots.FirstOrDefault(s => !s.IsActive);
        
        // Apply config to standby slot
        ApplyVersionConfig(app, version);
        
        // Start new version in standby slot
        standbySlot.VersionId = version.Id;
        standbySlot.HealthStatus = HealthStatus.Starting;
        await _db.SaveChangesAsync(ct);
        
        var startResult = await _appExecutor.StartAsync(app, ct);
        standbySlot.ProcessId = startResult.ProcessId;
        standbySlot.StartedAt = DateTime.UtcNow;
        
        // Wait for healthy
        if (config.WaitForHealthy)
        {
            var healthy = await WaitForHealthyAsync(app, 
                TimeSpan.FromSeconds(config.HealthCheckTimeoutSeconds), ct);
                
            if (!healthy)
            {
                return new DeploymentResult 
                { 
                    Success = false, 
                    Message = "New version failed health check" 
                };
            }
        }
        
        standbySlot.HealthStatus = HealthStatus.Healthy;
        
        // Wait before switching
        if (config.SwitchDelaySeconds > 0)
            await Task.Delay(TimeSpan.FromSeconds(config.SwitchDelaySeconds), ct);
        
        // Switch traffic
        if (activeSlot != null)
            activeSlot.IsActive = false;
        standbySlot.IsActive = true;
        
        // Stop old version if not keeping
        if (!config.KeepPreviousSlot && activeSlot != null)
        {
            await _appExecutor.StopAsync(/* old process */, TimeSpan.FromSeconds(30), ct);
            activeSlot.ProcessId = null;
        }
        
        await _db.SaveChangesAsync(ct);
        
        return new DeploymentResult 
        { 
            Success = true, 
            Message = $"Deployed to {standbySlot.Name} slot" 
        };
    }
    
    public async Task<DeploymentResult> RollbackAsync(
        Guid appId, 
        int? targetVersionId, 
        CancellationToken ct)
    {
        // Find version to rollback to
        AppVersion targetVersion;
        
        if (targetVersionId.HasValue)
        {
            targetVersion = await _db.AppVersions.FindAsync(targetVersionId.Value);
        }
        else
        {
            // Find last successful version before current
            targetVersion = await _db.AppVersions
                .Where(v => v.AppId == appId)
                .Where(v => v.DeploymentStatus == DeploymentStatus.Superseded ||
                           v.DeploymentStatus == DeploymentStatus.RolledBack)
                .OrderByDescending(v => v.SequenceNumber)
                .FirstOrDefaultAsync(ct);
        }
        
        if (targetVersion == null)
            return new DeploymentResult { Success = false, Message = "No version to rollback to" };
        
        // Mark current as rolled back
        var currentVersion = await _db.AppVersions
            .Where(v => v.AppId == appId && v.DeploymentStatus == DeploymentStatus.Active)
            .FirstOrDefaultAsync(ct);
            
        if (currentVersion != null)
            currentVersion.DeploymentStatus = DeploymentStatus.RolledBack;
        
        // Create rollback version (copy of target)
        var rollbackVersion = new AppVersion
        {
            AppId = appId,
            Version = $"{targetVersion.Version}-rollback",
            SequenceNumber = (await _db.AppVersions.Where(v => v.AppId == appId).MaxAsync(v => v.SequenceNumber, ct)) + 1,
            ConfigSnapshot = targetVersion.ConfigSnapshot,
            Source = VersionSource.Rollback,
            DeploymentNotes = $"Rollback from {currentVersion?.Version} to {targetVersion.Version}"
        };
        
        _db.AppVersions.Add(rollbackVersion);
        await _db.SaveChangesAsync(ct);
        
        // Deploy the rollback version
        return await DeployVersionAsync(rollbackVersion.Id, new DeployOptions(), ct);
    }
}
```

---

## Git Webhook Handler

```csharp
[ApiController]
[Route("api/webhooks")]
public class WebhookController : ControllerBase
{
    [HttpPost("github/{appId}")]
    public async Task<IActionResult> GitHubWebhook(
        Guid appId,
        [FromHeader(Name = "X-Hub-Signature-256")] string signature,
        [FromHeader(Name = "X-GitHub-Event")] string eventType)
    {
        var integration = await _db.GitIntegrations.FirstOrDefaultAsync(g => g.AppId == appId);
        if (integration == null)
            return NotFound();
        
        // Validate signature
        var body = await new StreamReader(Request.Body).ReadToEndAsync();
        if (!ValidateGitHubSignature(body, signature, integration.WebhookSecret))
            return Unauthorized();
        
        var payload = JsonSerializer.Deserialize<GitHubWebhookPayload>(body);
        
        // Handle different event types
        switch (eventType)
        {
            case "push":
                if (integration.DeployOnPush && payload.Ref == $"refs/heads/{integration.Branch}")
                {
                    await TriggerDeploymentAsync(integration, payload);
                }
                break;
                
            case "create":
                if (integration.DeployOnTag && 
                    payload.RefType == "tag" &&
                    MatchesPattern(payload.Ref, integration.TagPattern))
                {
                    await TriggerDeploymentAsync(integration, payload);
                }
                break;
        }
        
        return Ok();
    }
    
    private async Task TriggerDeploymentAsync(GitIntegration integration, GitHubWebhookPayload payload)
    {
        // Create version from git info
        var version = await _deploymentService.CreateVersionAsync(integration.AppId, new CreateVersionDto
        {
            Version = payload.After?.Substring(0, 7) ?? payload.Ref,
            Source = payload.RefType == "tag" ? VersionSource.GitTag : VersionSource.GitPush,
            GitCommit = payload.After,
            GitBranch = payload.Ref?.Replace("refs/heads/", ""),
            GitMessage = payload.HeadCommit?.Message
        });
        
        // Run build if configured
        if (!string.IsNullOrEmpty(integration.BuildCommand))
        {
            await _buildService.RunBuildAsync(integration, payload, CancellationToken.None);
        }
        
        // Deploy
        await _deploymentService.DeployVersionAsync(version.Id, new DeployOptions(), CancellationToken.None);
        
        // Update integration state
        integration.LastCommit = payload.After;
        integration.LastSync = DateTime.UtcNow;
        await _db.SaveChangesAsync(CancellationToken.None);
    }
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Versions** |||
| GET | `/api/apps/{appId}/versions` | List version history |
| POST | `/api/apps/{appId}/versions` | Create new version |
| GET | `/api/versions/{id}` | Get version details |
| GET | `/api/versions/{id}/diff` | Get diff from previous |
| GET | `/api/versions/{id}/config` | Get config snapshot |
| **Deployments** |||
| POST | `/api/versions/{id}/deploy` | Deploy a version |
| POST | `/api/apps/{appId}/rollback` | Rollback to previous |
| GET | `/api/apps/{appId}/deployment-status` | Get current deployment status |
| **Blue-Green** |||
| GET | `/api/apps/{appId}/slots` | Get deployment slots |
| POST | `/api/apps/{appId}/slots/switch` | Switch active slot |
| **Canary** |||
| POST | `/api/apps/{appId}/canary/adjust` | Adjust traffic percentage |
| POST | `/api/apps/{appId}/canary/promote` | Promote canary to 100% |
| POST | `/api/apps/{appId}/canary/abort` | Abort canary, rollback |
| **Git Integration** |||
| GET | `/api/apps/{appId}/git` | Get git integration |
| POST | `/api/apps/{appId}/git` | Setup git integration |
| DELETE | `/api/apps/{appId}/git` | Remove git integration |
| POST | `/api/apps/{appId}/git/sync` | Manual sync from git |
| **Webhooks** |||
| POST | `/api/webhooks/github/{appId}` | GitHub webhook handler |
| POST | `/api/webhooks/gitlab/{appId}` | GitLab webhook handler |
| POST | `/api/webhooks/generic/{appId}` | Generic webhook |

---

## UI Components

### Version History

```tsx
function VersionHistory({ appId }: Props) {
  const { data: versions, isLoading } = useVersions(appId);
  const deployMutation = useDeployVersion();
  const rollbackMutation = useRollback();
  
  return (
    <div className="version-history">
      <header>
        <h2>Version History</h2>
        <Button onClick={() => openCreateVersionModal()}>
          Create Version
        </Button>
      </header>
      
      <div className="version-list">
        {versions?.map(version => (
          <VersionCard
            key={version.id}
            version={version}
            onDeploy={() => deployMutation.mutate(version.id)}
            onRollback={() => rollbackMutation.mutate({ appId, versionId: version.id })}
            onViewDiff={() => openDiffModal(version.id)}
          />
        ))}
      </div>
    </div>
  );
}

function VersionCard({ version, onDeploy, onRollback, onViewDiff }: Props) {
  return (
    <div className={`version-card status-${version.deploymentStatus}`}>
      <div className="version-header">
        <span className="version-number">{version.version}</span>
        <StatusBadge status={version.deploymentStatus} />
        {version.deploymentStatus === 'active' && (
          <span className="active-badge">LIVE</span>
        )}
      </div>
      
      <div className="version-meta">
        <span><ClockIcon /> {formatDate(version.createdAt)}</span>
        {version.gitCommit && (
          <span><GitIcon /> {version.gitCommit.slice(0, 7)}</span>
        )}
        {version.deployedBy && (
          <span><UserIcon /> {version.deployedByName}</span>
        )}
      </div>
      
      {version.gitMessage && (
        <p className="commit-message">{version.gitMessage}</p>
      )}
      
      <div className="version-actions">
        <Button size="sm" onClick={onViewDiff}>View Diff</Button>
        {version.deploymentStatus !== 'active' && (
          <>
            <Button size="sm" variant="primary" onClick={onDeploy}>
              Deploy
            </Button>
            <Button size="sm" variant="warning" onClick={onRollback}>
              Rollback to This
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
```

### Blue-Green Status

```tsx
function BlueGreenStatus({ appId }: Props) {
  const { data: slots } = useDeploymentSlots(appId);
  const switchMutation = useSwitchSlot();
  
  const activeSlot = slots?.find(s => s.isActive);
  const standbySlot = slots?.find(s => !s.isActive);
  
  return (
    <div className="blue-green-status">
      <h3>Deployment Slots</h3>
      
      <div className="slots">
        {slots?.map(slot => (
          <SlotCard
            key={slot.id}
            slot={slot}
            isActive={slot.isActive}
            onSwitch={() => switchMutation.mutate({ appId, toSlot: slot.name })}
          />
        ))}
      </div>
      
      <div className="traffic-indicator">
        <TrafficFlowDiagram
          activeSlot={activeSlot?.name}
          trafficPercentage={100}
        />
      </div>
    </div>
  );
}

function SlotCard({ slot, isActive, onSwitch }: Props) {
  return (
    <div className={`slot-card ${slot.name} ${isActive ? 'active' : 'standby'}`}>
      <div className="slot-header">
        <span className="slot-name">{slot.name.toUpperCase()}</span>
        {isActive && <span className="live-indicator">● LIVE</span>}
      </div>
      
      <div className="slot-version">
        {slot.version ? (
          <>
            <span>{slot.version.version}</span>
            <HealthBadge status={slot.healthStatus} />
          </>
        ) : (
          <span className="no-version">No version deployed</span>
        )}
      </div>
      
      {!isActive && slot.version && (
        <Button onClick={onSwitch} variant="primary">
          Switch Traffic Here
        </Button>
      )}
    </div>
  );
}
```

### Git Integration Setup

```tsx
function GitIntegrationSetup({ appId }: Props) {
  const { data: integration } = useGitIntegration(appId);
  const saveMutation = useSaveGitIntegration();
  
  const [form, setForm] = useState({
    repositoryUrl: '',
    branch: 'main',
    deployOnPush: true,
    deployOnTag: true,
    tagPattern: 'v*',
    buildCommand: '',
  });
  
  const webhookUrl = `${window.location.origin}/api/webhooks/github/${appId}`;
  
  return (
    <div className="git-integration">
      <h3>Git Integration</h3>
      
      <FormField label="Repository URL" required>
        <Input 
          value={form.repositoryUrl}
          onChange={e => setForm({...form, repositoryUrl: e.target.value})}
          placeholder="https://github.com/user/repo"
        />
      </FormField>
      
      <FormField label="Branch">
        <Input 
          value={form.branch}
          onChange={e => setForm({...form, branch: e.target.value})}
        />
      </FormField>
      
      <div className="trigger-options">
        <Checkbox
          checked={form.deployOnPush}
          onChange={e => setForm({...form, deployOnPush: e.target.checked})}
          label="Deploy on push to branch"
        />
        
        <Checkbox
          checked={form.deployOnTag}
          onChange={e => setForm({...form, deployOnTag: e.target.checked})}
          label="Deploy on tag creation"
        />
        
        {form.deployOnTag && (
          <Input
            value={form.tagPattern}
            onChange={e => setForm({...form, tagPattern: e.target.value})}
            placeholder="v*"
            label="Tag pattern"
          />
        )}
      </div>
      
      <FormField label="Build Command (optional)">
        <Input 
          value={form.buildCommand}
          onChange={e => setForm({...form, buildCommand: e.target.value})}
          placeholder="npm run build"
        />
      </FormField>
      
      <div className="webhook-info">
        <h4>Webhook URL</h4>
        <CopyableInput value={webhookUrl} />
        <p>Add this URL as a webhook in your GitHub repository settings.</p>
      </div>
      
      <Button onClick={() => saveMutation.mutate({ appId, ...form })}>
        Save Integration
      </Button>
    </div>
  );
}
```

---

## Database Migration

```csharp
public partial class AddVersioningSupport : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "AppVersions",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                AppId = table.Column<Guid>(nullable: false),
                Version = table.Column<string>(maxLength: 100, nullable: false),
                SequenceNumber = table.Column<int>(nullable: false),
                Label = table.Column<string>(maxLength: 200, nullable: true),
                ConfigSnapshot = table.Column<string>(nullable: false),
                ConfigDiff = table.Column<string>(nullable: true),
                Source = table.Column<int>(nullable: false),
                GitCommit = table.Column<string>(maxLength: 40, nullable: true),
                GitBranch = table.Column<string>(maxLength: 200, nullable: true),
                GitMessage = table.Column<string>(nullable: true),
                ArtifactUrl = table.Column<string>(nullable: true),
                DeploymentStatus = table.Column<int>(nullable: false),
                DeployedAt = table.Column<DateTime>(nullable: true),
                RolledBackAt = table.Column<DateTime>(nullable: true),
                DeploymentNotes = table.Column<string>(nullable: true),
                DeployedBy = table.Column<Guid>(nullable: true),
                CreatedAt = table.Column<DateTime>(nullable: false),
                Metadata = table.Column<string>(nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AppVersions", x => x.Id);
                table.ForeignKey(
                    name: "FK_AppVersions_Apps_AppId",
                    column: x => x.AppId,
                    principalTable: "Apps",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });
            
        migrationBuilder.CreateTable(
            name: "DeploymentSlots",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                AppId = table.Column<Guid>(nullable: false),
                Name = table.Column<string>(maxLength: 50, nullable: false),
                VersionId = table.Column<int>(nullable: true),
                IsActive = table.Column<bool>(nullable: false),
                TrafficPercentage = table.Column<int>(nullable: false),
                ProcessId = table.Column<string>(nullable: true),
                StartedAt = table.Column<DateTime>(nullable: true),
                HealthStatus = table.Column<int>(nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_DeploymentSlots", x => x.Id);
            });
            
        migrationBuilder.CreateTable(
            name: "DeploymentConfigs",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                AppId = table.Column<Guid>(nullable: false),
                Strategy = table.Column<int>(nullable: false),
                KeepPreviousSlot = table.Column<bool>(nullable: false, defaultValue: true),
                SwitchDelaySeconds = table.Column<int>(nullable: false, defaultValue: 30),
                CanaryPercentage = table.Column<int>(nullable: false, defaultValue: 10),
                AutoRollbackOnFailure = table.Column<bool>(nullable: false, defaultValue: true),
                WaitForHealthy = table.Column<bool>(nullable: false, defaultValue: true),
                MaxVersionsToKeep = table.Column<int>(nullable: false, defaultValue: 10),
                AutoVersionOnSave = table.Column<bool>(nullable: false, defaultValue: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_DeploymentConfigs", x => x.Id);
            });
            
        migrationBuilder.CreateTable(
            name: "GitIntegrations",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                AppId = table.Column<Guid>(nullable: false),
                RepositoryUrl = table.Column<string>(maxLength: 500, nullable: false),
                Branch = table.Column<string>(maxLength: 200, nullable: true),
                AuthType = table.Column<int>(nullable: false),
                AccessToken = table.Column<string>(nullable: true),
                WebhookSecret = table.Column<string>(nullable: false),
                DeployOnPush = table.Column<bool>(nullable: false, defaultValue: true),
                DeployOnTag = table.Column<bool>(nullable: false, defaultValue: true),
                TagPattern = table.Column<string>(nullable: true),
                BuildCommand = table.Column<string>(nullable: true),
                LastCommit = table.Column<string>(nullable: true),
                LastSync = table.Column<DateTime>(nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_GitIntegrations", x => x.Id);
            });
            
        migrationBuilder.CreateIndex(
            name: "IX_AppVersions_AppId_SequenceNumber",
            table: "AppVersions",
            columns: new[] { "AppId", "SequenceNumber" });
    }
}
```

---

## Implementation Phases

### Phase 1: Version History (2 weeks)
- [ ] AppVersion entity and migration
- [ ] Create version on app save (auto-versioning)
- [ ] Version list API
- [ ] Config snapshot and diff generation
- [ ] UI: Version history list
- [ ] UI: Version diff viewer

### Phase 2: Deployment & Rollback (2 weeks)
- [ ] DeploymentConfig entity
- [ ] Immediate deployment strategy
- [ ] Rollback to previous version
- [ ] API endpoints
- [ ] UI: Deploy button on versions
- [ ] UI: Rollback button

### Phase 3: Blue-Green Deployments (1-2 weeks)
- [ ] DeploymentSlot entity
- [ ] Blue-green deployment logic
- [ ] Traffic switch API
- [ ] UI: Slot visualization
- [ ] UI: Traffic switch controls

### Phase 4: Git Integration (1-2 weeks)
- [ ] GitIntegration entity
- [ ] GitHub webhook handler
- [ ] Deploy on push trigger
- [ ] Deploy on tag trigger
- [ ] UI: Git integration setup
- [ ] UI: Webhook URL display

---

## Estimated Effort

**Total: 4-6 weeks**

---

## Dependencies

- Feature 005 (Health checks) - for blue-green health validation
- Feature 003 (Authentication) - for audit trail (deployedBy)

---

## Notes

- Version snapshots include full app configuration (command, env, etc.)
- Diff generation uses standard JSON diff format
- Git integration supports GitHub initially, GitLab can be added
- Blue-green requires app to support running two instances
- Canary requires load balancer integration (future enhancement)
