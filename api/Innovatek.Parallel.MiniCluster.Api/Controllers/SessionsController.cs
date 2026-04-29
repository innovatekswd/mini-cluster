using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/services/{serviceId:guid}/sessions")]
    public class SessionsController : ControllerBase
    {
        private readonly LogsDbContext _logsDb;

        public SessionsController(LogsDbContext logsDb)
        {
            _logsDb = logsDb;
        }

        // Create a new session when a service starts
        [HttpPost]
        public async Task<IActionResult> CreateSession(Guid serviceId, [FromBody] SessionCreateDto dto)
        {
            var session = new ServiceSession
            {
                ServiceId = serviceId,
                AutoStart = dto.AutoStart,
                WorkingDirectory = dto.WorkingDirectory,
                EnvironmentSnapshot = dto.EnvironmentSnapshot,  // should be a JSON string
                CommandLineArguments = dto.CommandLineArguments,
                StartTimestamp = DateTime.UtcNow
            };

            _logsDb.ServiceSessions.Add(session);
            await _logsDb.SaveChangesAsync();
            return CreatedAtAction(nameof(GetSessionDetails), new { serviceId, sessionId = session.SessionId }, session);
        }

        // Mark a session as closed (service stopped)
        [HttpPost("{sessionId:guid}/close")]
        public async Task<IActionResult> CloseSession(Guid serviceId, Guid sessionId, [FromBody] SessionCloseDto dto)
        {
            var session = await _logsDb.ServiceSessions.FindAsync(sessionId);
            if (session == null || session.ServiceId != serviceId)
            {
                return NotFound();
            }

            session.EndTimestamp = DateTime.UtcNow;
            session.ExitReason = dto.ExitReason;
            session.ExitCode = dto.ExitCode;

            await _logsDb.SaveChangesAsync();
            return Ok(session);
        }

        // Get list of sessions for a service (with log line counts, paginated, newest first)
        [HttpGet]
        public async Task<IActionResult> GetSessions(
            Guid serviceId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            var query = _logsDb.ServiceSessions.Where(s => s.ServiceId == serviceId);
            
            if (from.HasValue)
                query = query.Where(s => s.StartTimestamp >= from.Value);
            if (to.HasValue)
                query = query.Where(s => s.StartTimestamp <= to.Value);

            var total = await query.CountAsync();

            var sessions = await query
                .OrderByDescending(s => s.StartTimestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(s => new
                {
                    s.SessionId,
                    s.ServiceId,
                    s.StartTimestamp,
                    s.EndTimestamp,
                    s.AutoStart,
                    s.ExitReason,
                    s.ExitCode,
                    s.WorkingDirectory,
                    s.CommandLineArguments,
                    LineCount = _logsDb.SessionLogs.Count(l => l.SessionId == s.SessionId),
                    DurationSeconds = s.EndTimestamp.HasValue
                        ? (int)(s.EndTimestamp.Value - s.StartTimestamp).TotalSeconds
                        : (int?)null,
                })
                .ToListAsync();

            return Ok(new { total, page, pageSize, sessions });
        }

        // Get session details (including logs) for a particular session
        [HttpGet("{sessionId:guid}")]
        public async Task<IActionResult> GetSessionDetails(Guid serviceId, Guid sessionId)
        {
            var session = await _logsDb.ServiceSessions
                .Include(s => s.LogEntries)
                .FirstOrDefaultAsync(s => s.SessionId == sessionId && s.ServiceId == serviceId);

            if (session == null)
            {
                return NotFound();
            }
            return Ok(session);
        }

        [HttpGet("{sessionId:guid}/logs")]
        public async Task<IActionResult> SearchLogs(
            Guid serviceId,
            Guid sessionId,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] string? query = null,
            [FromQuery] string? type = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 500)
        {
            const int maxPageSize = 1000;
            pageSize = Math.Min(pageSize, maxPageSize);

            var logQuery = _logsDb.SessionLogs.AsQueryable().Where(l => l.SessionId == sessionId);

            if (from.HasValue)
                logQuery = logQuery.Where(l => l.Timestamp >= from.Value);
            if (to.HasValue)
                logQuery = logQuery.Where(l => l.Timestamp <= to.Value);
            if (!string.IsNullOrWhiteSpace(query))
                logQuery = logQuery.Where(l => EF.Functions.Like(l.Line, $"%{query}%"));
            if (!string.IsNullOrWhiteSpace(type))
                logQuery = logQuery.Where(l => l.LogType == type);

            var total = await logQuery.CountAsync();

            var logs = await logQuery
                .OrderBy(l => l.Timestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            return Ok(new { total, page, pageSize, results = logs });
        }

    }

    // DTO classes for session creation and closing
    public class SessionCreateDto
    {
        public bool AutoStart { get; set; }
        public string? WorkingDirectory { get; set; }
        public string? EnvironmentSnapshot { get; set; }
        public string? CommandLineArguments { get; set; }
    }

    public class SessionCloseDto
    {
        public string? ExitReason { get; set; }
        public int? ExitCode { get; set; }
    }
}
