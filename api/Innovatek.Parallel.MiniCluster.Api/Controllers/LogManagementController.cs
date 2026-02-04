using Innovatek.Parallel.MiniCluster.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/logs")]
public class LogManagementController : ControllerBase
{
    private readonly LogsDbContext _logsDb;
    private readonly AppDbContext _controlDb;
    private readonly ILogger<LogManagementController> _logger;

    public LogManagementController(
        LogsDbContext logsDb,
        AppDbContext controlDb,
        ILogger<LogManagementController> logger)
    {
        _logsDb = logsDb;
        _controlDb = controlDb;
        _logger = logger;
    }

    /// <summary>
    /// Truncate all log tables (DANGEROUS - cannot be undone)
    /// </summary>
    [HttpDelete("truncate")]
    public async Task<IActionResult> TruncateAllLogs([FromQuery] bool confirm = false)
    {
        if (!confirm)
        {
            return BadRequest(new
            {
                Message = "This operation will delete ALL logs permanently. Add ?confirm=true to proceed.",
                Warning = "This action cannot be undone!"
            });
        }

        _logger.LogWarning("Truncating all log tables - initiated by user");

        try
        {
            // Delete in correct order (foreign key dependencies)
            var logsDeleted = await _logsDb.SessionLogs.ExecuteDeleteAsync();
            var eventsDeleted = await _logsDb.LifecycleEvents.ExecuteDeleteAsync();
            var sessionsDeleted = await _logsDb.ServiceSessions.ExecuteDeleteAsync();

            // Vacuum to reclaim space
            await _logsDb.Database.ExecuteSqlRawAsync("VACUUM");

            _logger.LogWarning(
                "All logs truncated. Deleted: {Logs} logs, {Events} events, {Sessions} sessions",
                logsDeleted, eventsDeleted, sessionsDeleted);

            return Ok(new
            {
                Message = "All logs truncated successfully",
                Deleted = new
                {
                    Logs = logsDeleted,
                    Events = eventsDeleted,
                    Sessions = sessionsDeleted
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to truncate logs");
            return StatusCode(500, new { Message = "Failed to truncate logs", Error = ex.Message });
        }
    }

    /// <summary>
    /// Get database statistics
    /// </summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetDatabaseStats()
    {
        try
        {
            var stats = new
            {
                LogsDatabase = new
                {
                    TotalLogs = await _logsDb.SessionLogs.CountAsync(),
                    TotalSessions = await _logsDb.ServiceSessions.CountAsync(),
                    TotalEvents = await _logsDb.LifecycleEvents.CountAsync(),
                    OldestLog = await _logsDb.SessionLogs
                        .OrderBy(l => l.Timestamp)
                        .Select(l => l.Timestamp)
                        .FirstOrDefaultAsync(),
                    NewestLog = await _logsDb.SessionLogs
                        .OrderByDescending(l => l.Timestamp)
                        .Select(l => l.Timestamp)
                        .FirstOrDefaultAsync(),
                    ActiveSessions = await _logsDb.ServiceSessions
                        .CountAsync(s => s.EndTimestamp == null)
                },
                ControlDatabase = new
                {
                    TotalServices = await _controlDb.Services.CountAsync(),
                    TotalVariableGroups = await _controlDb.VariableGroups.CountAsync(),
                    AutoStartServices = await _controlDb.Services.CountAsync(s => s.AutoStart)
                }
            };

            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get database stats");
            return StatusCode(500, new { Message = "Failed to get stats", Error = ex.Message });
        }
    }

    /// <summary>
    /// Delete logs older than specified hours
    /// </summary>
    [HttpDelete("cleanup")]
    public async Task<IActionResult> CleanupOldLogs([FromQuery] int olderThanHours = 24)
    {
        if (olderThanHours < 1)
            return BadRequest("olderThanHours must be at least 1");

        var cutoffTime = DateTime.UtcNow - TimeSpan.FromHours(olderThanHours);

        _logger.LogInformation("Manual cleanup requested for logs older than {Hours} hours", olderThanHours);

        try
        {
            var deletedEvents = await _logsDb.LifecycleEvents
                .Where(e => e.Timestamp < cutoffTime)
                .ExecuteDeleteAsync();

            var deletedLogs = await _logsDb.SessionLogs
                .Where(l => l.Timestamp < cutoffTime)
                .ExecuteDeleteAsync();

            var deletedSessions = await _logsDb.ServiceSessions
                .Where(s => s.EndTimestamp != null && s.EndTimestamp < cutoffTime)
                .ExecuteDeleteAsync();

            return Ok(new
            {
                Message = $"Deleted logs older than {olderThanHours} hours",
                CutoffTime = cutoffTime,
                Deleted = new
                {
                    Logs = deletedLogs,
                    Events = deletedEvents,
                    Sessions = deletedSessions
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to cleanup old logs");
            return StatusCode(500, new { Message = "Failed to cleanup logs", Error = ex.Message });
        }
    }

    /// <summary>
    /// Export logs for a specific app and date range
    /// </summary>
    [HttpGet("export")]
    public async Task<IActionResult> ExportLogs(
        [FromQuery] Guid? appId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to)
    {
        try
        {
            var query = _logsDb.SessionLogs.AsQueryable();

            if (appId.HasValue)
            {
                var sessionIds = await _logsDb.ServiceSessions
                    .Where(s => s.ServiceId == appId.Value)
                    .Select(s => s.SessionId)
                    .ToListAsync();
                query = query.Where(l => sessionIds.Contains(l.SessionId));
            }

            if (from.HasValue)
                query = query.Where(l => l.Timestamp >= from.Value);

            if (to.HasValue)
                query = query.Where(l => l.Timestamp <= to.Value);

            var logs = await query
                .OrderBy(l => l.Timestamp)
                .Take(10000) // Limit to prevent huge downloads
                .ToListAsync();

            return Ok(new
            {
                TotalLogs = logs.Count,
                Filters = new { appId, from, to },
                Logs = logs
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export logs");
            return StatusCode(500, new { Message = "Failed to export logs", Error = ex.Message });
        }
    }

    /// <summary>
    /// Get service uptime statistics
    /// </summary>
    [HttpGet("uptime/{serviceId}")]
    public async Task<IActionResult> GetServiceUptime(Guid serviceId, [FromQuery] int lastDays = 7)
    {
        try
        {
            var cutoff = DateTime.UtcNow.AddDays(-lastDays);

            var sessions = await _logsDb.ServiceSessions
                .Where(s => s.ServiceId == serviceId && s.StartTimestamp >= cutoff)
                .ToListAsync();

            if (sessions.Count == 0)
                return Ok(new { Message = "No sessions found for this service" });

            var totalSessions = sessions.Count;
            var crashedSessions = sessions.Count(s => s.ExitCode != 0 && s.ExitCode != null);
            var totalRuntime = sessions
                .Where(s => s.EndTimestamp.HasValue)
                .Sum(s => (s.EndTimestamp!.Value - s.StartTimestamp).TotalSeconds);
            var avgRuntime = totalSessions > 0 ? totalRuntime / totalSessions : 0;

            return Ok(new
            {
                ServiceId = serviceId,
                Period = $"Last {lastDays} days",
                TotalSessions = totalSessions,
                CrashedSessions = crashedSessions,
                CrashRate = totalSessions > 0 ? (double)crashedSessions / totalSessions * 100 : 0,
                AverageRuntimeSeconds = avgRuntime,
                TotalRuntimeHours = totalRuntime / 3600
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get uptime stats");
            return StatusCode(500, new { Message = "Failed to get uptime stats", Error = ex.Message });
        }
    }
}
