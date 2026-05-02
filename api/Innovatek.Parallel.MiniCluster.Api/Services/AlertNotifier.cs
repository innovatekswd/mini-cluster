using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Hubs;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Sends notifications for a triggered (or resolved) alert across all configured channels.
/// </summary>
public interface IAlertNotifier
{
    Task NotifyAsync(AlertRule rule, AlertEvent alertEvent, CancellationToken ct);
}

public class AlertNotifier : IAlertNotifier
{
    private readonly IServiceProvider _sp;
    private readonly IHubContext<LogHub> _hub;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly AlertingOptions _options;
    private readonly ILogger<AlertNotifier> _logger;

    public AlertNotifier(
        IServiceProvider sp,
        IHubContext<LogHub> hub,
        IHttpClientFactory httpClientFactory,
        IOptions<AlertingOptions> options,
        ILogger<AlertNotifier> logger)
    {
        _sp = sp;
        _hub = hub;
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task NotifyAsync(AlertRule rule, AlertEvent alertEvent, CancellationToken ct)
    {
        using var scope = _sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var channels = await db.NotificationChannels
            .Where(c => c.IsEnabled)
            .ToListAsync(ct);

        if (rule.NotifyChannels != "all")
        {
            var ids = rule.NotifyChannels
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => int.TryParse(s, out var id) ? id : -1)
                .ToHashSet();
            channels = channels.Where(c => ids.Contains(c.Id)).ToList();
        }

        var results = new Dictionary<string, string>();

        foreach (var channel in channels)
        {
            try
            {
                switch (channel.Type)
                {
                    case NotificationChannelType.Webhook:
                        await SendWebhookAsync(channel, rule, alertEvent, ct);
                        results[channel.Name] = "sent";
                        break;

                    case NotificationChannelType.Email:
                        await SendEmailAsync(channel, rule, alertEvent);
                        results[channel.Name] = "sent";
                        break;

                    case NotificationChannelType.SignalR:
                        await _hub.Clients.Group("alerts")
                            .SendAsync("AlertTriggered", new
                            {
                                alertEvent.Id,
                                alertEvent.AlertRuleId,
                                RuleName = rule.Name,
                                alertEvent.EventType,
                                alertEvent.Value,
                                alertEvent.Threshold,
                                Severity = rule.Severity.ToString(),
                                alertEvent.Message,
                                alertEvent.Timestamp,
                            }, ct);
                        results[channel.Name] = "sent";
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Notification failed for channel {Channel}", channel.Name);
                results[channel.Name] = $"failed: {ex.Message}";
            }
        }

        alertEvent.NotificationResults = JsonSerializer.Serialize(results);
    }

    private async Task SendWebhookAsync(NotificationChannel channel, AlertRule rule, AlertEvent ev, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(channel.WebhookUrl)) return;

        var payload = BuildWebhookPayload(channel.WebhookTemplate, rule, ev);
        var client = _httpClientFactory.CreateClient();

        // Apply custom headers
        if (!string.IsNullOrWhiteSpace(channel.WebhookHeaders))
        {
            var headers = JsonSerializer.Deserialize<Dictionary<string, string>>(channel.WebhookHeaders);
            if (headers is not null)
            {
                foreach (var (k, v) in headers)
                    client.DefaultRequestHeaders.TryAddWithoutValidation(k, v);
            }
        }

        var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var response = await client.PostAsync(channel.WebhookUrl, content, ct);
        response.EnsureSuccessStatusCode();
    }

    private static string BuildWebhookPayload(string? template, AlertRule rule, AlertEvent ev)
    {
        var defaults = new
        {
            ruleName = rule.Name,
            severity = rule.Severity.ToString(),
            metric = rule.Metric.ToString(),
            value = ev.Value,
            threshold = ev.Threshold,
            eventType = ev.EventType.ToString(),
            message = ev.Message,
            timestamp = ev.Timestamp,
        };

        if (string.IsNullOrWhiteSpace(template))
            return JsonSerializer.Serialize(defaults);

        // Simple {{placeholder}} substitution
        return template
            .Replace("{{ruleName}}", rule.Name)
            .Replace("{{severity}}", rule.Severity.ToString())
            .Replace("{{metric}}", rule.Metric.ToString())
            .Replace("{{value}}", ev.Value.ToString("F2"))
            .Replace("{{threshold}}", ev.Threshold.ToString("F2"))
            .Replace("{{eventType}}", ev.EventType.ToString())
            .Replace("{{message}}", ev.Message ?? string.Empty)
            .Replace("{{timestamp}}", ev.Timestamp.ToString("O"));
    }

    private Task SendEmailAsync(NotificationChannel channel, AlertRule rule, AlertEvent ev)
    {
        // Email delivery requires SMTP config — log a warning when not configured.
        if (string.IsNullOrWhiteSpace(_options.Email.SmtpHost))
        {
            _logger.LogWarning(
                "Email channel '{Channel}' cannot send: SMTP host not configured in Alerting:Email",
                channel.Name);
            return Task.CompletedTask;
        }

        // SMTP delivery would be wired here using System.Net.Mail.SmtpClient or MailKit.
        // Kept as a no-op stub for Phase 13a — Phase 13b wires SMTP.
        _logger.LogInformation(
            "Email notification to {To}: [{Severity}] {Rule} — {Message}",
            channel.EmailTo, rule.Severity, rule.Name, ev.Message);
        return Task.CompletedTask;
    }
}
