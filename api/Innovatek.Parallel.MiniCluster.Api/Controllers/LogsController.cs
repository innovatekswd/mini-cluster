using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Models;
using Innovatek.Parallel.MiniCluster.Api.Services;
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

        // Use efficient query instead of Last()
        var lastServiceSession = await _logsDb.ServiceSessions
            .Where(s => s.ServiceId == result.Value)
            .OrderByDescending(s => s.StartTimestamp)
            .FirstOrDefaultAsync(cancellationToken);
            
        if (lastServiceSession == null)
        {
            return NotFound(new { Message = "No sessions found for this service" });
        }

        // Add max page size limit
        const int maxPageSize = 1000;
        var pageSize = Math.Min(request.PageSize, maxPageSize);

        var query = _logsDb.SessionLogs
            .Where(l => l.SessionId == lastServiceSession.SessionId);

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
