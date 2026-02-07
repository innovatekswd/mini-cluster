using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Api.Services;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/cron")]
public class CronController : ControllerBase
{
    private readonly ICronSchedulingService _cronService;
    private readonly ILogger<CronController> _logger;

    public CronController(ICronSchedulingService cronService, ILogger<CronController> logger)
    {
        _cronService = cronService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<CronJobResponseDto>>> GetAll(CancellationToken ct)
    {
        try
        {
            var jobs = await _cronService.GetAllJobsAsync(ct);
            return Ok(jobs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting cron jobs");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CronJobResponseDto>> Get(Guid id, CancellationToken ct)
    {
        try
        {
            var job = await _cronService.GetJobAsync(id, ct);
            if (job == null) return NotFound(new { error = $"Cron job {id} not found" });
            return Ok(job);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting cron job {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<CronJobResponseDto>> Create(CreateCronJobDto dto, CancellationToken ct)
    {
        try
        {
            var job = await _cronService.CreateJobAsync(dto, ct);
            return CreatedAtAction(nameof(Get), new { id = job.Id }, job);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating cron job");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateCronJobDto dto, CancellationToken ct)
    {
        try
        {
            var result = await _cronService.UpdateJobAsync(id, dto, ct);
            if (result == null) return NotFound(new { error = $"Cron job {id} not found" });
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating cron job {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            var deleted = await _cronService.DeleteJobAsync(id, ct);
            if (!deleted) return NotFound(new { error = $"Cron job {id} not found" });
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting cron job {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("{id:guid}/enable")]
    public async Task<IActionResult> Enable(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _cronService.EnableJobAsync(id, ct);
            if (!result) return NotFound(new { error = $"Cron job {id} not found" });
            return Ok(new { enabled = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error enabling cron job {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("{id:guid}/disable")]
    public async Task<IActionResult> Disable(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _cronService.DisableJobAsync(id, ct);
            if (!result) return NotFound(new { error = $"Cron job {id} not found" });
            return Ok(new { enabled = false });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error disabling cron job {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("{id:guid}/trigger")]
    public async Task<IActionResult> Trigger(Guid id, CancellationToken ct)
    {
        try
        {
            var result = await _cronService.TriggerJobAsync(id, ct);
            if (result == null) return NotFound(new { error = $"Cron job {id} not found" });
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error triggering cron job {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("{id:guid}/runs")]
    public async Task<ActionResult<List<CronJobRunResponseDto>>> GetRuns(Guid id, [FromQuery] int limit = 50, CancellationToken ct = default)
    {
        try
        {
            var runs = await _cronService.GetRunsAsync(id, limit, ct);
            return Ok(runs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting runs for cron job {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("runs/{runId:guid}")]
    public async Task<ActionResult<CronJobRunResponseDto>> GetRun(Guid runId, CancellationToken ct)
    {
        try
        {
            var run = await _cronService.GetRunAsync(runId, ct);
            if (run == null) return NotFound(new { error = $"Cron run {runId} not found" });
            return Ok(run);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting cron run {RunId}", runId);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
