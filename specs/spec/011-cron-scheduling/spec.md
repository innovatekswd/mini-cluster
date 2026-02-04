# Feature 011: Cron Scheduling

## Overview

Run apps and services on cron schedules. Supports:
- One-time runs
- Recurring schedules (cron syntax)
- Dependency-aware execution
- Schedule groups

---

## Business Value

| Problem | Solution |
|---------|----------|
| Manual nightly jobs | Cron-scheduled runs |
| "Run backup at 2 AM" | Schedule with cron |
| Chain of dependent jobs | Dependency-aware scheduling |
| Missed schedule handling | Catch-up execution |

---

## Data Model

```csharp
public class CronJob
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    
    // Target
    public CronTarget TargetType { get; set; }
    public Guid? AppId { get; set; }
    public Guid? ServiceId { get; set; }
    public Guid? GroupId { get; set; }  // Run all apps in group
    
    // Schedule
    public string CronExpression { get; set; } = "";  // "0 2 * * *" = 2 AM daily
    public string? Timezone { get; set; }  // Default: UTC
    
    // Behavior
    public CronAction Action { get; set; } = CronAction.Start;
    public bool WaitForCompletion { get; set; } = true;
    public int TimeoutSeconds { get; set; } = 3600;  // 1 hour
    public CronMissedPolicy MissedPolicy { get; set; } = CronMissedPolicy.RunOnce;
    
    // Chain
    public Guid? DependsOnJobId { get; set; }  // Run after this job completes
    public CronJob? DependsOnJob { get; set; }
    
    // State
    public bool IsEnabled { get; set; } = true;
    public DateTime? LastRun { get; set; }
    public DateTime? NextRun { get; set; }
    public CronRunStatus LastRunStatus { get; set; }
    public string? LastRunError { get; set; }
    public int TotalRuns { get; set; }
    public int FailedRuns { get; set; }
}

public enum CronTarget
{
    App = 0,
    Service = 1,
    Group = 2,
    Script = 3
}

public enum CronAction
{
    Start = 0,      // Start and let run
    Run = 1,        // Start, wait for exit
    Restart = 2,    // Stop then start
    Stop = 3,       // Stop if running
    Script = 4      // Run custom script
}

public enum CronMissedPolicy
{
    Skip = 0,       // Don't run missed schedules
    RunOnce = 1,    // Run once if missed
    RunAll = 2      // Run all missed (catch up)
}

public enum CronRunStatus
{
    Unknown = 0,
    Running = 1,
    Success = 2,
    Failed = 3,
    Timeout = 4,
    Skipped = 5
}

public class CronJobRun
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid JobId { get; set; }
    public CronJob Job { get; set; } = null!;
    
    public DateTime ScheduledFor { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    
    public CronRunStatus Status { get; set; }
    public int? ExitCode { get; set; }
    public string? Output { get; set; }
    public string? Error { get; set; }
    
    public TimeSpan? Duration => CompletedAt - StartedAt;
}
```

## Scheduler Service

```csharp
public class CronSchedulerService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            
            // Find due jobs
            var dueJobs = await _db.CronJobs
                .Where(j => j.IsEnabled && j.NextRun <= now)
                .Where(j => j.DependsOnJobId == null || 
                           j.DependsOnJob.LastRunStatus == CronRunStatus.Success)
                .ToListAsync(ct);
            
            foreach (var job in dueJobs)
            {
                _ = ExecuteJobAsync(job, ct);  // Fire and forget
            }
            
            await Task.Delay(TimeSpan.FromSeconds(10), ct);
        }
    }
    
    private async Task ExecuteJobAsync(CronJob job, CancellationToken ct)
    {
        var run = new CronJobRun
        {
            JobId = job.Id,
            ScheduledFor = job.NextRun!.Value,
            StartedAt = DateTime.UtcNow,
            Status = CronRunStatus.Running
        };
        _db.CronJobRuns.Add(run);
        await _db.SaveChangesAsync(ct);
        
        try
        {
            var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(job.TimeoutSeconds));
            
            switch (job.Action)
            {
                case CronAction.Start:
                    await StartTargetAsync(job, cts.Token);
                    break;
                    
                case CronAction.Run:
                    var result = await RunTargetAsync(job, cts.Token);
                    run.ExitCode = result.ExitCode;
                    run.Output = result.Output;
                    break;
                    
                case CronAction.Restart:
                    await StopTargetAsync(job, cts.Token);
                    await StartTargetAsync(job, cts.Token);
                    break;
                    
                case CronAction.Stop:
                    await StopTargetAsync(job, cts.Token);
                    break;
            }
            
            run.Status = CronRunStatus.Success;
        }
        catch (OperationCanceledException)
        {
            run.Status = CronRunStatus.Timeout;
        }
        catch (Exception ex)
        {
            run.Status = CronRunStatus.Failed;
            run.Error = ex.Message;
            job.FailedRuns++;
        }
        finally
        {
            run.CompletedAt = DateTime.UtcNow;
            job.LastRun = run.StartedAt;
            job.LastRunStatus = run.Status;
            job.NextRun = CalculateNextRun(job);
            job.TotalRuns++;
            await _db.SaveChangesAsync(ct);
            
            // Trigger dependent jobs
            await TriggerDependentJobsAsync(job, ct);
        }
    }
    
    private DateTime CalculateNextRun(CronJob job)
    {
        var cron = CronExpression.Parse(job.CronExpression);
        var tz = TimeZoneInfo.FindSystemTimeZoneById(job.Timezone ?? "UTC");
        return cron.GetNextOccurrence(DateTime.UtcNow, tz)!.Value;
    }
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cron` | List jobs |
| POST | `/api/cron` | Create job |
| GET | `/api/cron/{id}` | Get job |
| PUT | `/api/cron/{id}` | Update job |
| DELETE | `/api/cron/{id}` | Delete job |
| POST | `/api/cron/{id}/enable` | Enable job |
| POST | `/api/cron/{id}/disable` | Disable job |
| POST | `/api/cron/{id}/run` | Trigger manual run |
| GET | `/api/cron/{id}/runs` | Get run history |
| GET | `/api/cron/{id}/runs/{runId}` | Get run details |

## UI Components

```tsx
function CronJobsList() {
  const { data: jobs } = useCronJobs();
  
  return (
    <Table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Schedule</th>
          <th>Target</th>
          <th>Last Run</th>
          <th>Next Run</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {jobs?.map(job => (
          <tr key={job.id}>
            <td>{job.name}</td>
            <td><code>{job.cronExpression}</code></td>
            <td>{job.targetType}: {job.targetName}</td>
            <td>{formatDate(job.lastRun)}</td>
            <td>{formatDate(job.nextRun)}</td>
            <td><StatusBadge status={job.lastRunStatus} /></td>
            <td>
              <IconButton onClick={() => runJob(job.id)} title="Run now">▶</IconButton>
              <IconButton onClick={() => toggleJob(job.id)} title="Toggle">
                {job.isEnabled ? '⏸' : '▶'}
              </IconButton>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function CronJobForm({ job }: { job?: CronJob }) {
  return (
    <Form>
      <Field label="Name" name="name" required />
      <Field label="Cron Expression" name="cronExpression" required 
             help="e.g., '0 2 * * *' for daily at 2 AM" />
      <Field label="Timezone" name="timezone" component={TimezoneSelect} />
      
      <Field label="Target Type" name="targetType" component={Select}>
        <option value="app">App</option>
        <option value="service">Service</option>
        <option value="group">Group</option>
      </Field>
      
      <Field label="Action" name="action" component={Select}>
        <option value="start">Start</option>
        <option value="run">Run (wait for exit)</option>
        <option value="restart">Restart</option>
        <option value="stop">Stop</option>
      </Field>
      
      <Field label="Timeout (seconds)" name="timeoutSeconds" type="number" />
      <Field label="Depends On" name="dependsOnJobId" component={JobSelect} />
    </Form>
  );
}

function CronScheduleVisualizer({ expression }: { expression: string }) {
  const next5 = useMemo(() => getNext5Occurrences(expression), [expression]);
  
  return (
    <div className="schedule-preview">
      <p>Next runs:</p>
      <ul>
        {next5.map((date, i) => (
          <li key={i}>{formatDate(date)}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Cron Expression Reference

| Expression | Description |
|------------|-------------|
| `* * * * *` | Every minute |
| `0 * * * *` | Every hour |
| `0 2 * * *` | Daily at 2 AM |
| `0 2 * * 0` | Sunday at 2 AM |
| `0 0 1 * *` | First of month |
| `*/5 * * * *` | Every 5 minutes |
| `0 9-17 * * 1-5` | Hourly 9-5 weekdays |

## Migration

```csharp
public partial class AddCronScheduling : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "CronJobs",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                Name = table.Column<string>(maxLength: 200, nullable: false),
                Description = table.Column<string>(nullable: true),
                TargetType = table.Column<int>(nullable: false),
                AppId = table.Column<Guid>(nullable: true),
                ServiceId = table.Column<Guid>(nullable: true),
                GroupId = table.Column<Guid>(nullable: true),
                CronExpression = table.Column<string>(maxLength: 100, nullable: false),
                Timezone = table.Column<string>(maxLength: 50, nullable: true),
                Action = table.Column<int>(nullable: false),
                WaitForCompletion = table.Column<bool>(nullable: false),
                TimeoutSeconds = table.Column<int>(nullable: false),
                MissedPolicy = table.Column<int>(nullable: false),
                DependsOnJobId = table.Column<Guid>(nullable: true),
                IsEnabled = table.Column<bool>(nullable: false),
                LastRun = table.Column<DateTime>(nullable: true),
                NextRun = table.Column<DateTime>(nullable: true),
                LastRunStatus = table.Column<int>(nullable: false),
                LastRunError = table.Column<string>(nullable: true),
                TotalRuns = table.Column<int>(nullable: false),
                FailedRuns = table.Column<int>(nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CronJobs", x => x.Id);
                table.ForeignKey("FK_CronJobs_DependsOn", x => x.DependsOnJobId,
                    "CronJobs", "Id", onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateTable(
            name: "CronJobRuns",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                JobId = table.Column<Guid>(nullable: false),
                ScheduledFor = table.Column<DateTime>(nullable: false),
                StartedAt = table.Column<DateTime>(nullable: false),
                CompletedAt = table.Column<DateTime>(nullable: true),
                Status = table.Column<int>(nullable: false),
                ExitCode = table.Column<int>(nullable: true),
                Output = table.Column<string>(nullable: true),
                Error = table.Column<string>(nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CronJobRuns", x => x.Id);
                table.ForeignKey("FK_CronJobRuns_Jobs", x => x.JobId,
                    "CronJobs", "Id", onDelete: ReferentialAction.Cascade);
            });
    }
}
```

## Estimated Effort: 2 weeks

## Dependencies
- Feature 008 (Groups) - for group targeting
