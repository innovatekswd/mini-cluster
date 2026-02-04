using Innovatek.Parallel.MiniCluster.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/services/{id}/exec")]
public class ExecutionController : ControllerBase
{
    private readonly IServiceProcessManager _manager;

    public ExecutionController(IServiceProcessManager manager)
    {
        _manager = manager;
    }

    [HttpPost("start")]
    public async Task<IActionResult> Start(Guid id)
    {
        var result = await _manager.StartServiceAsync(id);
        if (result.Success)
        {
            return Ok(new { message = "Service started successfully", serviceId = id });
        }
        else
        {
            return BadRequest(new 
            { 
                error = result.ErrorMessage, 
                details = result.ErrorDetails,
                serviceId = id
            });
        }
    }

    [HttpPost("stop")]
    public async Task<IActionResult> Stop(Guid id)
    {
        var result = await _manager.StopServiceAsync(id);
        return result ? Ok("Service stopped.") : BadRequest("Failed to stop service.");
    }

    [HttpGet("status")]
    public IActionResult Status(Guid id)
    {
        var status = _manager.GetStatus(id);
        return Ok(new { status=status.ToString() });
    }
}
