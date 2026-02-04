using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _appDb;
    private readonly ILogger<SettingsController> _logger;

    public SettingsController(AppDbContext appDb, ILogger<SettingsController> logger)
    {
        _appDb = appDb;
        _logger = logger;
    }

    /// <summary>
    /// Get current application settings
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<AppSettings>> GetSettings()
    {
        var settings = await _appDb.AppSettings.FirstOrDefaultAsync();
        
        if (settings == null)
        {
            // Create default settings if not exists
            settings = new AppSettings
            {
                Id = 1,
                MaxMessagesToKeepInUi = 1000,
                EnableLogSearch = true,
                MetricsCollectionIntervalSeconds = 5,
                MetricsRetentionHours = 24,
                MetricsAggregationIntervalSeconds = 60
            };
            _appDb.AppSettings.Add(settings);
            await _appDb.SaveChangesAsync();
        }
        
        return Ok(settings);
    }

    /// <summary>
    /// Update application settings
    /// </summary>
    [HttpPut]
    public async Task<ActionResult<AppSettings>> UpdateSettings([FromBody] AppSettingsUpdateDto dto)
    {
        var settings = await _appDb.AppSettings.FirstOrDefaultAsync();
        
        if (settings == null)
        {
            settings = new AppSettings { Id = 1 };
            _appDb.AppSettings.Add(settings);
        }

        // Update UI settings
        if (dto.MaxMessagesToKeepInUi.HasValue)
        {
            settings.MaxMessagesToKeepInUi = Math.Clamp(dto.MaxMessagesToKeepInUi.Value, 100, 10000);
        }
        
        if (dto.EnableLogSearch.HasValue)
        {
            settings.EnableLogSearch = dto.EnableLogSearch.Value;
        }

        // Update metrics settings
        if (dto.MetricsCollectionIntervalSeconds.HasValue)
        {
            // Valid intervals: 1, 5, 10, 20, 30, 60, 300 (5m), 600 (10m)
            var validIntervals = new[] { 1, 5, 10, 20, 30, 60, 300, 600 };
            var interval = dto.MetricsCollectionIntervalSeconds.Value;
            
            // Find the closest valid interval
            settings.MetricsCollectionIntervalSeconds = validIntervals
                .OrderBy(v => Math.Abs(v - interval))
                .First();
        }

        if (dto.MetricsRetentionHours.HasValue)
        {
            settings.MetricsRetentionHours = Math.Clamp(dto.MetricsRetentionHours.Value, 1, 168); // 1 hour to 7 days
        }

        if (dto.MetricsAggregationIntervalSeconds.HasValue)
        {
            // Valid aggregation intervals: 1, 5, 10, 20, 30, 60, 300 (5m), 600 (10m), 1800 (30m), 3600 (1h)
            var validIntervals = new[] { 1, 5, 10, 20, 30, 60, 300, 600, 1800, 3600 };
            var interval = dto.MetricsAggregationIntervalSeconds.Value;
            
            settings.MetricsAggregationIntervalSeconds = validIntervals
                .OrderBy(v => Math.Abs(v - interval))
                .First();
        }

        settings.ModifiedAt = DateTime.UtcNow;
        await _appDb.SaveChangesAsync();
        
        _logger.LogInformation("Settings updated: MaxMessages={Max}, Interval={Interval}s, Aggregation={Agg}s",
            settings.MaxMessagesToKeepInUi, 
            settings.MetricsCollectionIntervalSeconds,
            settings.MetricsAggregationIntervalSeconds);

        return Ok(settings);
    }

    /// <summary>
    /// Get available metrics collection intervals
    /// </summary>
    [HttpGet("intervals")]
    public ActionResult<IntervalOptionsDto> GetIntervalOptions()
    {
        return Ok(new IntervalOptionsDto
        {
            CollectionIntervals = new[]
            {
                new IntervalOption { Seconds = 1, Label = "1 second" },
                new IntervalOption { Seconds = 5, Label = "5 seconds" },
                new IntervalOption { Seconds = 10, Label = "10 seconds" },
                new IntervalOption { Seconds = 20, Label = "20 seconds" },
                new IntervalOption { Seconds = 30, Label = "30 seconds" },
                new IntervalOption { Seconds = 60, Label = "1 minute" },
                new IntervalOption { Seconds = 300, Label = "5 minutes" },
            },
            AggregationIntervals = new[]
            {
                new IntervalOption { Seconds = 1, Label = "1 second" },
                new IntervalOption { Seconds = 5, Label = "5 seconds" },
                new IntervalOption { Seconds = 10, Label = "10 seconds" },
                new IntervalOption { Seconds = 20, Label = "20 seconds" },
                new IntervalOption { Seconds = 30, Label = "30 seconds" },
                new IntervalOption { Seconds = 60, Label = "1 minute" },
                new IntervalOption { Seconds = 300, Label = "5 minutes" },
                new IntervalOption { Seconds = 600, Label = "10 minutes" },
                new IntervalOption { Seconds = 1800, Label = "30 minutes" },
                new IntervalOption { Seconds = 3600, Label = "1 hour" },
            }
        });
    }
}

public class AppSettingsUpdateDto
{
    public int? MaxMessagesToKeepInUi { get; set; }
    public bool? EnableLogSearch { get; set; }
    public int? MetricsCollectionIntervalSeconds { get; set; }
    public int? MetricsRetentionHours { get; set; }
    public int? MetricsAggregationIntervalSeconds { get; set; }
}

public class IntervalOptionsDto
{
    public IntervalOption[] CollectionIntervals { get; set; } = Array.Empty<IntervalOption>();
    public IntervalOption[] AggregationIntervals { get; set; } = Array.Empty<IntervalOption>();
}

public class IntervalOption
{
    public int Seconds { get; set; }
    public string Label { get; set; } = string.Empty;
}
