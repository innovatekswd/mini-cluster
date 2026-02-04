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

        // Get list of sessions for a service
        [HttpGet]
        public async Task<IActionResult> GetSessions(Guid serviceId)
        {
            var sessions = await _logsDb.ServiceSessions.Where(s => s.ServiceId == serviceId).ToListAsync();
            return Ok(sessions);
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
        public async Task<IActionResult> SearchLogs(Guid serviceId, Guid sessionId, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            var query = _logsDb.SessionLogs.AsQueryable().Where(l => l.SessionId == sessionId);

            if (from.HasValue)
            {
                query = query.Where(l => l.Timestamp >= from.Value);
            }
            if (to.HasValue)
            {
                query = query.Where(l => l.Timestamp <= to.Value);
            }

            var logs = await query.OrderBy(l => l.Timestamp).ToListAsync();
            return Ok(logs);
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
