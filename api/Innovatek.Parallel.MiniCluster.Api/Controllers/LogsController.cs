using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Models;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/services/{identifier}/logs")]
public class LogsController : ControllerBase
{
    private readonly LogsDbContext _logsDb;
    private readonly IIdentifierResolver _resolver;

    public LogsController(LogsDbContext logsDb, IIdentifierResolver resolver)
    {
        _logsDb = logsDb;
        _resolver = resolver;
    }

    [HttpGet]
    public async Task<IActionResult> GetLogs(string identifier, [FromQuery] int tail = 100, CancellationToken cancellationToken = default)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        // Get the most recent session
        var lastSession = await _logsDb.ServiceSessions
            .Where(s => s.ServiceId == result.Value)
            .OrderByDescending(s => s.StartTimestamp)
            .FirstOrDefaultAsync(cancellationToken);

        if (lastSession == null)
        {
            return Ok(new { lines = Array.Empty<string>() });
        }

        // Get last N log lines
        var logs = await _logsDb.SessionLogs
            .Where(l => l.SessionId == lastSession.SessionId)
            .OrderByDescending(l => l.Timestamp)
            .Take(tail)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // Reverse to show in chronological order
        logs.Reverse();

        var lines = logs.Select(l => $"[{l.Timestamp:yyyy-MM-dd HH:mm:ss}] [{l.LogType}] {l.Line}").ToList();

        return Ok(new { lines });
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchLogs(string identifier, [FromQuery] LogSearchRequest request, CancellationToken cancellationToken = default)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        // Add max page size limit
        const int maxPageSize = 1000;
        var pageSize = Math.Min(request.PageSize, maxPageSize);

        IQueryable<SessionLogEntry> query;

        var sessionScope = request.SessionId?.Trim().ToLowerInvariant();
        
        if (sessionScope == "all")
        {
            // Search across ALL sessions for this service
            var sessionIds = _logsDb.ServiceSessions
                .Where(s => s.ServiceId == result.Value)
                .Select(s => s.SessionId);

            query = _logsDb.SessionLogs.Where(l => sessionIds.Contains(l.SessionId));
        }
        else if (Guid.TryParse(sessionScope, out var specificSessionId))
        {
            // Search within a specific session
            query = _logsDb.SessionLogs.Where(l => l.SessionId == specificSessionId);
        }
        else
        {
            // Default: search latest session
            var lastServiceSession = await _logsDb.ServiceSessions
                .Where(s => s.ServiceId == result.Value)
                .OrderByDescending(s => s.StartTimestamp)
                .FirstOrDefaultAsync(cancellationToken);
                
            if (lastServiceSession == null)
            {
                return Ok(new { total = 0, page = 1, pageSize, maxPageSize, results = Array.Empty<object>() });
            }

            query = _logsDb.SessionLogs.Where(l => l.SessionId == lastServiceSession.SessionId);
        }

        if (!string.IsNullOrWhiteSpace(request.Query))
            query = query.Where(l => EF.Functions.Like(l.Line, $"%{request.Query}%"));

        if (!string.IsNullOrWhiteSpace(request.Type))
            query = query.Where(l => l.LogType == request.Type);

        if (request.From.HasValue)
            query = query.Where(l => l.Timestamp >= request.From.Value);

        if (request.To.HasValue)
            query = query.Where(l => l.Timestamp <= request.To.Value);

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(l => l.Timestamp)
            .Skip((request.Page - 1) * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            total,
            page = request.Page,
            pageSize,
            maxPageSize,
            results = items
        });
    }
}
