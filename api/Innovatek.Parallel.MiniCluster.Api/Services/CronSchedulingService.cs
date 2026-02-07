using Cronos;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

public interface ICronSchedulingService
{
    Task<List<CronJobResponseDto>> GetAllJobsAsync(CancellationToken ct = default);
    Task<CronJobResponseDto?> GetJobAsync(Guid id, CancellationToken ct = default);
    Task<CronJobResponseDto> CreateJobAsync(CreateCronJobDto dto, CancellationToken ct = default);
    Task<CronJobResponseDto?> UpdateJobAsync(Guid id, UpdateCronJobDto dto, CancellationToken ct = default);
    Task<bool> DeleteJobAsync(Guid id, CancellationToken ct = default);
    Task<bool> EnableJobAsync(Guid id, CancellationToken ct = default);
    Task<bool> DisableJobAsync(Guid id, CancellationToken ct = default);
    Task<CronJobRunResponseDto?> TriggerJobAsync(Guid id, CancellationToken ct = default);
    Task<List<CronJobRunResponseDto>> GetRunsAsync(Guid jobId, int limit = 50, CancellationToken ct = default);
    Task<CronJobRunResponseDto?> GetRunAsync(Guid jobId, Guid runId, CancellationToken ct = default);
    Task<CronJobRunResponseDto?> GetRunAsync(Guid runId, CancellationToken ct = default);
}

public class CronSchedulingService : ICronSchedulingService
{
    private readonly AppDbContext _context;
    private readonly ILogger<CronSchedulingService> _logger;

    public CronSchedulingService(AppDbContext context, ILogger<CronSchedulingService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<CronJobResponseDto>> GetAllJobsAsync(CancellationToken ct = default)
    {
        var jobs = await _context.CronJobs
            .Include(j => j.DependsOnJob)
            .OrderBy(j => j.Name)
            .ToListAsync(ct);

        var dtos = new List<CronJobResponseDto>();
        foreach (var job in jobs)
        {
            dtos.Add(await MapToResponseDtoAsync(job, ct));
        }
        return dtos;
    }

    public async Task<CronJobResponseDto?> GetJobAsync(Guid id, CancellationToken ct = default)
    {
        var job = await _context.CronJobs
            .Include(j => j.DependsOnJob)
            .FirstOrDefaultAsync(j => j.Id == id, ct);

        return job == null ? null : await MapToResponseDtoAsync(job, ct);
    }

    public async Task<CronJobResponseDto> CreateJobAsync(CreateCronJobDto dto, CancellationToken ct = default)
    {
        // Validate cron expression
        CronExpression.Parse(dto.CronExpression, CronFormat.IncludeSeconds);

        var job = new CronJob
        {
            Name = dto.Name,
            Description = dto.Description,
            TargetType = dto.TargetType,
            AppId = dto.AppId,
            ServiceId = dto.ServiceId,
            GroupId = dto.GroupId,
            ScriptPath = dto.ScriptPath,
            CronExpression = dto.CronExpression,
            Timezone = dto.Timezone,
            Action = dto.Action,
            WaitForCompletion = dto.WaitForCompletion,
            TimeoutSeconds = dto.TimeoutSeconds,
            MissedPolicy = dto.MissedPolicy,
            DependsOnJobId = dto.DependsOnJobId,
            IsEnabled = true,
            NextRun = CalculateNextRun(dto.CronExpression, dto.Timezone)
        };

        _context.CronJobs.Add(job);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Created cron job {Name} (ID: {Id})", job.Name, job.Id);
        return await MapToResponseDtoAsync(job, ct);
    }

    public async Task<CronJobResponseDto?> UpdateJobAsync(Guid id, UpdateCronJobDto dto, CancellationToken ct = default)
    {
        var job = await _context.CronJobs.FindAsync(new object[] { id }, ct);
        if (job == null) return null;

        if (dto.Name != null) job.Name = dto.Name;
        if (dto.Description != null) job.Description = dto.Description;
        if (dto.TargetType.HasValue) job.TargetType = dto.TargetType.Value;
        if (dto.AppId.HasValue) job.AppId = dto.AppId;
        if (dto.ServiceId.HasValue) job.ServiceId = dto.ServiceId;
        if (dto.GroupId.HasValue) job.GroupId = dto.GroupId;
        if (dto.ScriptPath != null) job.ScriptPath = dto.ScriptPath;
        if (dto.CronExpression != null)
        {
            CronExpression.Parse(dto.CronExpression, CronFormat.IncludeSeconds);
            job.CronExpression = dto.CronExpression;
        }
        if (dto.Timezone != null) job.Timezone = dto.Timezone;
        if (dto.Action.HasValue) job.Action = dto.Action.Value;
        if (dto.WaitForCompletion.HasValue) job.WaitForCompletion = dto.WaitForCompletion.Value;
        if (dto.TimeoutSeconds.HasValue) job.TimeoutSeconds = dto.TimeoutSeconds.Value;
        if (dto.MissedPolicy.HasValue) job.MissedPolicy = dto.MissedPolicy.Value;
        if (dto.DependsOnJobId.HasValue) job.DependsOnJobId = dto.DependsOnJobId;

        job.ModifiedAt = DateTime.UtcNow;
        job.NextRun = CalculateNextRun(job.CronExpression, job.Timezone);

        await _context.SaveChangesAsync(ct);
        return await MapToResponseDtoAsync(job, ct);
    }

    public async Task<bool> DeleteJobAsync(Guid id, CancellationToken ct = default)
    {
        var job = await _context.CronJobs.FindAsync(new object[] { id }, ct);
        if (job == null) return false;

        _context.CronJobs.Remove(job);
        await _context.SaveChangesAsync(ct);
        _logger.LogInformation("Deleted cron job {Name} (ID: {Id})", job.Name, job.Id);
        return true;
    }

    public async Task<bool> EnableJobAsync(Guid id, CancellationToken ct = default)
    {
        var job = await _context.CronJobs.FindAsync(new object[] { id }, ct);
        if (job == null) return false;

        job.IsEnabled = true;
        job.NextRun = CalculateNextRun(job.CronExpression, job.Timezone);
        job.ModifiedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DisableJobAsync(Guid id, CancellationToken ct = default)
    {
        var job = await _context.CronJobs.FindAsync(new object[] { id }, ct);
        if (job == null) return false;

        job.IsEnabled = false;
        job.NextRun = null;
        job.ModifiedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<CronJobRunResponseDto?> TriggerJobAsync(Guid id, CancellationToken ct = default)
    {
        var job = await _context.CronJobs.FindAsync(new object[] { id }, ct);
        if (job == null) return null;

        var run = new CronJobRun
        {
            JobId = job.Id,
            ScheduledFor = DateTime.UtcNow,
            StartedAt = DateTime.UtcNow,
            Status = CronRunStatus.Running
        };
        _context.CronJobRuns.Add(run);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Manually triggered cron job {Name} (Run: {RunId})", job.Name, run.Id);

        return MapRunToDto(run);
    }

    public async Task<List<CronJobRunResponseDto>> GetRunsAsync(Guid jobId, int limit = 50, CancellationToken ct = default)
    {
        var runs = await _context.CronJobRuns
            .Where(r => r.JobId == jobId)
            .OrderByDescending(r => r.StartedAt)
            .Take(limit)
            .ToListAsync(ct);

        return runs.Select(MapRunToDto).ToList();
    }

    public async Task<CronJobRunResponseDto?> GetRunAsync(Guid jobId, Guid runId, CancellationToken ct = default)
    {
        var run = await _context.CronJobRuns
            .FirstOrDefaultAsync(r => r.Id == runId && r.JobId == jobId, ct);

        return run == null ? null : MapRunToDto(run);
    }

    public async Task<CronJobRunResponseDto?> GetRunAsync(Guid runId, CancellationToken ct = default)
    {
        var run = await _context.CronJobRuns
            .FirstOrDefaultAsync(r => r.Id == runId, ct);

        return run == null ? null : MapRunToDto(run);
    }

    private async Task<CronJobResponseDto> MapToResponseDtoAsync(CronJob job, CancellationToken ct)
    {
        string? targetName = null;
        switch (job.TargetType)
        {
            case CronTarget.App:
                if (job.AppId.HasValue)
                    targetName = (await _context.Apps.FindAsync(new object[] { job.AppId.Value }, ct))?.Name;
                break;
            case CronTarget.Service:
                if (job.ServiceId.HasValue)
                    targetName = (await _context.Services.FindAsync(new object[] { job.ServiceId.Value }, ct))?.Name;
                break;
            case CronTarget.Group:
                if (job.GroupId.HasValue)
                    targetName = (await _context.ServiceGroups.FindAsync(new object[] { job.GroupId.Value }, ct))?.Name;
                break;
            case CronTarget.Script:
                targetName = job.ScriptPath;
                break;
        }

        return new CronJobResponseDto
        {
            Id = job.Id,
            Name = job.Name,
            Description = job.Description,
            TargetType = job.TargetType,
            TargetName = targetName,
            AppId = job.AppId,
            ServiceId = job.ServiceId,
            GroupId = job.GroupId,
            ScriptPath = job.ScriptPath,
            CronExpression = job.CronExpression,
            Timezone = job.Timezone,
            Action = job.Action,
            WaitForCompletion = job.WaitForCompletion,
            TimeoutSeconds = job.TimeoutSeconds,
            MissedPolicy = job.MissedPolicy,
            IsEnabled = job.IsEnabled,
            LastRun = job.LastRun,
            NextRun = job.NextRun,
            LastRunStatus = job.LastRunStatus,
            LastRunError = job.LastRunError,
            TotalRuns = job.TotalRuns,
            FailedRuns = job.FailedRuns,
            DependsOnJobId = job.DependsOnJobId,
            DependsOnJobName = job.DependsOnJob?.Name
        };
    }

    private static CronJobRunResponseDto MapRunToDto(CronJobRun run)
    {
        return new CronJobRunResponseDto
        {
            Id = run.Id,
            JobId = run.JobId,
            ScheduledFor = run.ScheduledFor,
            StartedAt = run.StartedAt,
            CompletedAt = run.CompletedAt,
            Status = run.Status,
            ExitCode = run.ExitCode,
            Output = run.Output,
            Error = run.Error,
            DurationSeconds = run.CompletedAt.HasValue
                ? (run.CompletedAt.Value - run.StartedAt).TotalSeconds
                : null
        };
    }

    private static DateTime? CalculateNextRun(string cronExpression, string? timezone)
    {
        try
        {
            var cron = CronExpression.Parse(cronExpression, CronFormat.IncludeSeconds);
            var tz = TimeZoneInfo.FindSystemTimeZoneById(timezone ?? "UTC");
            return cron.GetNextOccurrence(DateTime.UtcNow, tz);
        }
        catch
        {
            return null;
        }
    }
}
