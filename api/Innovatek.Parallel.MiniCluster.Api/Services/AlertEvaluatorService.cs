using System.Collections.Concurrent;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Background service that evaluates all enabled <see cref="AlertRule"/>s on a fixed interval.
/// Uses duration tracking and cooldown to prevent alert storms.
/// </summary>
public class AlertEvaluatorService : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly IAlertMetricsProvider _metricsProvider;
    private readonly IAlertNotifier _notifier;
    private readonly AlertingOptions _options;
    private readonly ILogger<AlertEvaluatorService> _logger;

    // Track when each rule's condition first became true (for duration check)
    public readonly ConcurrentDictionary<int, DateTime> ConditionStartTimes = new();

    public AlertEvaluatorService(
        IServiceProvider sp,
        IAlertMetricsProvider metricsProvider,
        IAlertNotifier notifier,
        IOptions<AlertingOptions> options,
        ILogger<AlertEvaluatorService> logger)
    {
        _sp = sp;
        _metricsProvider = metricsProvider;
        _notifier = notifier;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("AlertEvaluatorService is disabled via configuration.");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await EvaluateAllRulesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Alert evaluation cycle failed");
            }

            await Task.Delay(
                TimeSpan.FromSeconds(_options.EvaluationIntervalSeconds),
                stoppingToken);
        }
    }

    public async Task EvaluateAllRulesAsync(CancellationToken ct)
    {
        using var scope = _sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var rules = await db.AlertRules
            .Where(r => r.IsEnabled)
            .ToListAsync(ct);

        foreach (var rule in rules)
        {
            var currentValue = _metricsProvider.GetCurrentValue(rule.Metric, rule.ServiceId);
            if (currentValue is null) continue;

            var conditionMet = Evaluate(rule.Operator, currentValue.Value, rule.Threshold);

            if (conditionMet)
            {
                var startTime = ConditionStartTimes.GetOrAdd(rule.Id, DateTime.UtcNow);
                var elapsed = (DateTime.UtcNow - startTime).TotalSeconds;

                if (elapsed >= rule.DurationSeconds)
                {
                    var inCooldown = rule.LastTriggeredAt is not null &&
                        (DateTime.UtcNow - rule.LastTriggeredAt.Value).TotalMinutes < rule.CooldownMinutes;

                    if (!inCooldown)
                    {
                        await TriggerAlertAsync(db, rule, currentValue.Value, ct);
                    }
                }
            }
            else
            {
                if (ConditionStartTimes.TryRemove(rule.Id, out _))
                {
                    await ResolveAlertAsync(db, rule, currentValue.Value, ct);
                }
            }
        }
    }

    private async Task TriggerAlertAsync(AppDbContext db, AlertRule rule, double value, CancellationToken ct)
    {
        rule.LastTriggeredAt = DateTime.UtcNow;
        rule.TriggerCount++;

        var ev = new AlertEvent
        {
            AlertRuleId = rule.Id,
            Timestamp = DateTime.UtcNow,
            EventType = AlertEventType.Triggered,
            Value = value,
            Threshold = rule.Threshold,
            Message = $"[{rule.Severity}] {rule.Name}: {rule.Metric} = {value:F2} {rule.Operator} {rule.Threshold:F2}",
        };

        db.AlertEvents.Add(ev);
        await db.SaveChangesAsync(ct);

        _logger.LogWarning(
            "Alert triggered: {Name} ({Severity}) — {Metric}={Value:F2} {Op} {Threshold:F2}",
            rule.Name, rule.Severity, rule.Metric, value, rule.Operator, rule.Threshold);

        await _notifier.NotifyAsync(rule, ev, ct);

        // Persist notification results
        await db.SaveChangesAsync(ct);
    }

    private async Task ResolveAlertAsync(AppDbContext db, AlertRule rule, double value, CancellationToken ct)
    {
        var ev = new AlertEvent
        {
            AlertRuleId = rule.Id,
            Timestamp = DateTime.UtcNow,
            EventType = AlertEventType.Resolved,
            Value = value,
            Threshold = rule.Threshold,
            Message = $"Resolved: {rule.Name} — {rule.Metric} = {value:F2}",
        };

        db.AlertEvents.Add(ev);
        await db.SaveChangesAsync(ct);

        _logger.LogInformation("Alert resolved: {Name}", rule.Name);

        await _notifier.NotifyAsync(rule, ev, ct);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Evaluates a threshold comparison. Public for unit testing.
    /// </summary>
    public static bool Evaluate(AlertOperator op, double value, double threshold) => op switch
    {
        AlertOperator.GreaterThan          => value > threshold,
        AlertOperator.GreaterThanOrEqual   => value >= threshold,
        AlertOperator.LessThan             => value < threshold,
        AlertOperator.LessThanOrEqual      => value <= threshold,
        AlertOperator.Equals               => Math.Abs(value - threshold) < 0.001,
        AlertOperator.NotEquals            => Math.Abs(value - threshold) >= 0.001,
        _ => false
    };
}
