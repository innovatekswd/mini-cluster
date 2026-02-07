using Cronos;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Background service that polls for due cron jobs every 10 seconds and executes them.
/// </summary>
public class CronSchedulerBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<CronSchedulerBackgroundService> _logger;

    public CronSchedulerBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<CronSchedulerBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _logger.LogInformation("Cron scheduler started");

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await ProcessDueJobsAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error in cron scheduler loop");
            }

            await Task.Delay(TimeSpan.FromSeconds(10), ct);
        }
    }

    private async Task ProcessDueJobsAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var processManager = scope.ServiceProvider.GetRequiredService<IServiceProcessManager>();

        var now = DateTime.UtcNow;
        var dueJobs = await context.CronJobs
            .Where(j => j.IsEnabled && j.NextRun != null && j.NextRun <= now)
            .ToListAsync(ct);

        foreach (var job in dueJobs)
        {
            // Check dependency
            if (job.DependsOnJobId.HasValue)
            {
                var dependency = await context.CronJobs.FindAsync(new object[] { job.DependsOnJobId.Value }, ct);
                if (dependency?.LastRunStatus != CronRunStatus.Success)
                {
                    _logger.LogDebug("Skipping job {Name}: dependency not satisfied", job.Name);
                    continue;
                }
            }

            _ = Task.Run(() => ExecuteJobAsync(job.Id, ct), ct);
        }
    }

    private async Task ExecuteJobAsync(Guid jobId, CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var processManager = scope.ServiceProvider.GetRequiredService<IServiceProcessManager>();

        var job = await context.CronJobs.FindAsync(new object[] { jobId }, ct);
        if (job == null) return;

        var run = new CronJobRun
        {
            JobId = job.Id,
            ScheduledFor = job.NextRun ?? DateTime.UtcNow,
            StartedAt = DateTime.UtcNow,
            Status = CronRunStatus.Running
        };
        context.CronJobRuns.Add(run);
        await context.SaveChangesAsync(ct);

        _logger.LogInformation("Executing cron job {Name} (ID: {Id})", job.Name, job.Id);

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(job.TimeoutSeconds));

            await ExecuteTargetAsync(job, processManager, context, cts.Token);
            run.Status = CronRunStatus.Success;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            run.Status = CronRunStatus.Timeout;
            _logger.LogWarning("Cron job {Name} timed out", job.Name);
        }
        catch (Exception ex)
        {
            run.Status = CronRunStatus.Failed;
            run.Error = ex.Message;
            job.FailedRuns++;
            _logger.LogError(ex, "Cron job {Name} failed", job.Name);
        }
        finally
        {
            run.CompletedAt = DateTime.UtcNow;
            job.LastRun = run.StartedAt;
            job.LastRunStatus = run.Status;
            job.LastRunError = run.Status == CronRunStatus.Failed ? run.Error : null;
            job.TotalRuns++;

            // Calculate next run
            try
            {
                var cron = CronExpression.Parse(job.CronExpression, CronFormat.IncludeSeconds);
                var tz = TimeZoneInfo.FindSystemTimeZoneById(job.Timezone ?? "UTC");
                job.NextRun = cron.GetNextOccurrence(DateTime.UtcNow, tz);
            }
            catch
            {
                job.NextRun = null;
            }

            await context.SaveChangesAsync(ct);
        }
    }

    private async Task ExecuteTargetAsync(
        CronJob job,
        IServiceProcessManager processManager,
        AppDbContext context,
        CancellationToken ct)
    {
        switch (job.Action)
        {
            case CronAction.Start:
                await ExecuteOnTargetServicesAsync(job, context,
                    async serviceId => await processManager.StartServiceAsync(serviceId, "cron"), ct);
                break;

            case CronAction.Run:
                await ExecuteOnTargetServicesAsync(job, context,
                    async serviceId =>
                    {
                        await processManager.StartServiceAsync(serviceId, "cron");
                        // Wait for completion is handled at the service level
                    }, ct);
                break;

            case CronAction.Restart:
                await ExecuteOnTargetServicesAsync(job, context,
                    async serviceId =>
                    {
                        await processManager.StopServiceAsync(serviceId);
                        await Task.Delay(1000, ct);
                        await processManager.StartServiceAsync(serviceId, "cron");
                    }, ct);
                break;

            case CronAction.Stop:
                await ExecuteOnTargetServicesAsync(job, context,
                    async serviceId => await processManager.StopServiceAsync(serviceId), ct);
                break;

            case CronAction.Script:
                // Script execution placeholder — requires sandboxing
                _logger.LogWarning("Script execution not yet implemented for job {Name}", job.Name);
                break;
        }
    }

    private async Task ExecuteOnTargetServicesAsync(
        CronJob job,
        AppDbContext context,
        Func<Guid, Task> action,
        CancellationToken ct)
    {
        var serviceIds = await ResolveTargetServiceIdsAsync(job, context, ct);
        foreach (var id in serviceIds)
        {
            try
            {
                await action(id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to execute cron action on service {ServiceId}", id);
            }
        }
    }

    private static async Task<List<Guid>> ResolveTargetServiceIdsAsync(
        CronJob job, AppDbContext context, CancellationToken ct)
    {
        return job.TargetType switch
        {
            CronTarget.Service when job.ServiceId.HasValue =>
                new List<Guid> { job.ServiceId.Value },

            CronTarget.App when job.AppId.HasValue =>
                await context.Services
                    .Where(s => s.AppId == job.AppId.Value)
                    .Select(s => s.Id)
                    .ToListAsync(ct),

            CronTarget.Group when job.GroupId.HasValue =>
                await context.ServiceGroupAssignments
                    .Where(a => a.GroupId == job.GroupId.Value)
                    .Select(a => a.ServiceId)
                    .ToListAsync(ct),

            _ => new List<Guid>()
        };
    }
}
