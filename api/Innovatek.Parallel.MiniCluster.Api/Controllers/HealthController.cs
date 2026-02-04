using Innovatek.Parallel.MiniCluster.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Route("api/health")]
[AllowAnonymous]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _controlDb;
    private readonly LogsDbContext _logsDb;

    public HealthController(AppDbContext controlDb, LogsDbContext logsDb)
    {
        _controlDb = controlDb;
        _logsDb = logsDb;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        try
        {
            // Check both database connectivity
            await _controlDb.Database.CanConnectAsync();
            await _logsDb.Database.CanConnectAsync();
            
            var serviceCount = await _controlDb.Services.CountAsync();
            var sessionCount = await _logsDb.ServiceSessions.CountAsync();

            return Ok(new
            {
                Status = "Healthy",
                Timestamp = DateTime.UtcNow,
                Database = "Connected",
                Stats = new
                {
                    TotalServices = serviceCount,
                    TotalSessions = sessionCount
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                Status = "Unhealthy",
                Timestamp = DateTime.UtcNow,
                Error = ex.Message
            });
        }
    }
}
