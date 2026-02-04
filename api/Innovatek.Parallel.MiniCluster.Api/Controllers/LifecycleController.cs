using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Authorize]
[Route("api/services/{identifier}/history")]
public class LifecycleController : ControllerBase
{
    private readonly LogsDbContext _logsDb;
    private readonly IIdentifierResolver _resolver;

    public LifecycleController(LogsDbContext logsDb, IIdentifierResolver resolver)
    {
        _logsDb = logsDb;
        _resolver = resolver;
    }

    [HttpGet]
    public async Task<IActionResult> GetHistory(string identifier)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        var events = await _logsDb.LifecycleEvents
            .Where(e => e.ServiceId == result.Value)
            .OrderByDescending(e => e.Timestamp)
            .ToListAsync();

        return Ok(events);
    }
}
