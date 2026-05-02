using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

// ── Request/Response DTOs ─────────────────────────────────────────────────

public record CreateAlertRuleRequest(
    string Name,
    string? Description,
    Guid? ServiceId,
    Guid? AppId,
    AlertMetric Metric,
    AlertOperator Operator,
    double Threshold,
    int DurationSeconds,
    int CooldownMinutes,
    AlertSeverity Severity,
    string NotifyChannels);

public record UpdateAlertRuleRequest(
    string Name,
    string? Description,
    Guid? ServiceId,
    Guid? AppId,
    AlertMetric Metric,
    AlertOperator Operator,
    double Threshold,
    int DurationSeconds,
    int CooldownMinutes,
    AlertSeverity Severity,
    string NotifyChannels,
    bool IsEnabled);

public record CreateNotificationChannelRequest(
    string Name,
    NotificationChannelType Type,
    string? WebhookUrl,
    string? WebhookHeaders,
    string? WebhookTemplate,
    string? EmailTo,
    string? EmailSubjectTemplate);

public record UpdateNotificationChannelRequest(
    string Name,
    NotificationChannelType Type,
    bool IsEnabled,
    string? WebhookUrl,
    string? WebhookHeaders,
    string? WebhookTemplate,
    string? EmailTo,
    string? EmailSubjectTemplate);

// ── Controller ───────────────────────────────────────────────────────────

[ApiController]
[Authorize]
[Route("api/alerts")]
public class AlertsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAlertNotifier _notifier;
    private readonly ILogger<AlertsController> _logger;

    public AlertsController(
        AppDbContext db,
        IAlertNotifier notifier,
        ILogger<AlertsController> logger)
    {
        _db = db;
        _notifier = notifier;
        _logger = logger;
    }

    // ── Alert Rules ───────────────────────────────────────────────────────

    [HttpGet("rules")]
    public async Task<IActionResult> GetRules(CancellationToken ct)
        => Ok(await _db.AlertRules.OrderBy(r => r.Name).ToListAsync(ct));

    [HttpGet("rules/{id:int}")]
    public async Task<IActionResult> GetRule(int id, CancellationToken ct)
    {
        var rule = await _db.AlertRules.FindAsync([id], ct);
        return rule is null ? NotFound() : Ok(rule);
    }

    [HttpPost("rules")]
    public async Task<IActionResult> CreateRule([FromBody] CreateAlertRuleRequest req, CancellationToken ct)
    {
        var rule = new AlertRule
        {
            Name = req.Name,
            Description = req.Description,
            ServiceId = req.ServiceId,
            AppId = req.AppId,
            Metric = req.Metric,
            Operator = req.Operator,
            Threshold = req.Threshold,
            DurationSeconds = req.DurationSeconds,
            CooldownMinutes = req.CooldownMinutes,
            Severity = req.Severity,
            NotifyChannels = req.NotifyChannels,
            CreatedAt = DateTime.UtcNow,
        };

        _db.AlertRules.Add(rule);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetRule), new { id = rule.Id }, rule);
    }

    [HttpPut("rules/{id:int}")]
    public async Task<IActionResult> UpdateRule(int id, [FromBody] UpdateAlertRuleRequest req, CancellationToken ct)
    {
        var rule = await _db.AlertRules.FindAsync([id], ct);
        if (rule is null) return NotFound();

        rule.Name = req.Name;
        rule.Description = req.Description;
        rule.ServiceId = req.ServiceId;
        rule.AppId = req.AppId;
        rule.Metric = req.Metric;
        rule.Operator = req.Operator;
        rule.Threshold = req.Threshold;
        rule.DurationSeconds = req.DurationSeconds;
        rule.CooldownMinutes = req.CooldownMinutes;
        rule.Severity = req.Severity;
        rule.NotifyChannels = req.NotifyChannels;
        rule.IsEnabled = req.IsEnabled;

        await _db.SaveChangesAsync(ct);
        return Ok(rule);
    }

    [HttpDelete("rules/{id:int}")]
    public async Task<IActionResult> DeleteRule(int id, CancellationToken ct)
    {
        var rule = await _db.AlertRules.FindAsync([id], ct);
        if (rule is null) return NotFound();

        _db.AlertRules.Remove(rule);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("rules/{id:int}/enable")]
    public async Task<IActionResult> EnableRule(int id, CancellationToken ct)
        => await SetEnabledAsync(id, true, ct);

    [HttpPost("rules/{id:int}/disable")]
    public async Task<IActionResult> DisableRule(int id, CancellationToken ct)
        => await SetEnabledAsync(id, false, ct);

    [HttpPost("rules/{id:int}/test")]
    public async Task<IActionResult> TestRule(int id, CancellationToken ct)
    {
        var rule = await _db.AlertRules.FindAsync([id], ct);
        if (rule is null) return NotFound();

        var testEvent = new AlertEvent
        {
            AlertRuleId = rule.Id,
            AlertRule = rule,
            Timestamp = DateTime.UtcNow,
            EventType = AlertEventType.Triggered,
            Value = rule.Threshold + 1,
            Threshold = rule.Threshold,
            Message = $"[TEST] {rule.Name}",
        };

        await _notifier.NotifyAsync(rule, testEvent, ct);
        return Ok(new { message = "Test notification sent." });
    }

    // ── Alert Events ──────────────────────────────────────────────────────

    [HttpGet("events")]
    public async Task<IActionResult> GetEvents(
        [FromQuery] int? ruleId,
        [FromQuery] AlertSeverity? severity,
        [FromQuery] AlertEventType? eventType,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var query = _db.AlertEvents
            .Include(e => e.AlertRule)
            .AsQueryable();

        if (ruleId.HasValue) query = query.Where(e => e.AlertRuleId == ruleId.Value);
        if (severity.HasValue) query = query.Where(e => e.AlertRule.Severity == severity.Value);
        if (eventType.HasValue) query = query.Where(e => e.EventType == eventType.Value);
        if (from.HasValue) query = query.Where(e => e.Timestamp >= from.Value);
        if (to.HasValue) query = query.Where(e => e.Timestamp <= to.Value);

        var total = await query.CountAsync(ct);
        var events = await query
            .OrderByDescending(e => e.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, events });
    }

    [HttpGet("events/{id:long}")]
    public async Task<IActionResult> GetEvent(long id, CancellationToken ct)
    {
        var ev = await _db.AlertEvents
            .Include(e => e.AlertRule)
            .FirstOrDefaultAsync(e => e.Id == id, ct);
        return ev is null ? NotFound() : Ok(ev);
    }

    [HttpPost("events/{id:long}/acknowledge")]
    public async Task<IActionResult> AcknowledgeEvent(long id, CancellationToken ct)
    {
        var ev = await _db.AlertEvents.FindAsync([id], ct);
        if (ev is null) return NotFound();
        if (ev.EventType == AlertEventType.Acknowledged)
            return Ok(ev);

        ev.EventType = AlertEventType.Acknowledged;
        await _db.SaveChangesAsync(ct);
        return Ok(ev);
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActive(CancellationToken ct)
    {
        // "Active" = triggered but not yet resolved or acknowledged
        var resolved = _db.AlertEvents
            .Where(e => e.EventType == AlertEventType.Resolved || e.EventType == AlertEventType.Acknowledged)
            .Select(e => e.AlertRuleId)
            .Distinct();

        var active = await _db.AlertEvents
            .Include(e => e.AlertRule)
            .Where(e => e.EventType == AlertEventType.Triggered && !resolved.Contains(e.AlertRuleId))
            .OrderByDescending(e => e.Timestamp)
            .ToListAsync(ct);

        return Ok(active);
    }

    // ── Notification Channels ─────────────────────────────────────────────

    [HttpGet("channels")]
    public async Task<IActionResult> GetChannels(CancellationToken ct)
        => Ok(await _db.NotificationChannels.OrderBy(c => c.Name).ToListAsync(ct));

    [HttpPost("channels")]
    public async Task<IActionResult> CreateChannel([FromBody] CreateNotificationChannelRequest req, CancellationToken ct)
    {
        var channel = new NotificationChannel
        {
            Name = req.Name,
            Type = req.Type,
            WebhookUrl = req.WebhookUrl,
            WebhookHeaders = req.WebhookHeaders,
            WebhookTemplate = req.WebhookTemplate,
            EmailTo = req.EmailTo,
            EmailSubjectTemplate = req.EmailSubjectTemplate,
            CreatedAt = DateTime.UtcNow,
        };

        _db.NotificationChannels.Add(channel);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetChannels), new { id = channel.Id }, channel);
    }

    [HttpPut("channels/{id:int}")]
    public async Task<IActionResult> UpdateChannel(int id, [FromBody] UpdateNotificationChannelRequest req, CancellationToken ct)
    {
        var channel = await _db.NotificationChannels.FindAsync([id], ct);
        if (channel is null) return NotFound();

        channel.Name = req.Name;
        channel.Type = req.Type;
        channel.IsEnabled = req.IsEnabled;
        channel.WebhookUrl = req.WebhookUrl;
        channel.WebhookHeaders = req.WebhookHeaders;
        channel.WebhookTemplate = req.WebhookTemplate;
        channel.EmailTo = req.EmailTo;
        channel.EmailSubjectTemplate = req.EmailSubjectTemplate;

        await _db.SaveChangesAsync(ct);
        return Ok(channel);
    }

    [HttpDelete("channels/{id:int}")]
    public async Task<IActionResult> DeleteChannel(int id, CancellationToken ct)
    {
        var channel = await _db.NotificationChannels.FindAsync([id], ct);
        if (channel is null) return NotFound();

        _db.NotificationChannels.Remove(channel);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("channels/{id:int}/test")]
    public async Task<IActionResult> TestChannel(int id, CancellationToken ct)
    {
        var channel = await _db.NotificationChannels.FindAsync([id], ct);
        if (channel is null) return NotFound();

        var dummyRule = new AlertRule
        {
            Id = 0,
            Name = "Test Alert",
            Metric = AlertMetric.SystemCpuPercent,
            Operator = AlertOperator.GreaterThan,
            Threshold = 90,
            Severity = AlertSeverity.Warning,
            NotifyChannels = channel.Id.ToString(),
        };

        var dummyEvent = new AlertEvent
        {
            AlertRule = dummyRule,
            Timestamp = DateTime.UtcNow,
            EventType = AlertEventType.Triggered,
            Value = 95,
            Threshold = 90,
            Message = "[TEST NOTIFICATION] This is a test from MiniCluster alerting.",
        };

        await _notifier.NotifyAsync(dummyRule, dummyEvent, ct);
        return Ok(new { message = "Test notification sent." });
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private async Task<IActionResult> SetEnabledAsync(int id, bool enabled, CancellationToken ct)
    {
        var rule = await _db.AlertRules.FindAsync([id], ct);
        if (rule is null) return NotFound();
        rule.IsEnabled = enabled;
        await _db.SaveChangesAsync(ct);
        return Ok(rule);
    }
}
