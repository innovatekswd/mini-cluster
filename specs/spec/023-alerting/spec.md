# Feature 023: Alerting & Threshold Rules

> **Stage:** 1 — Post-MVP  
> **Phase:** 12  
> **Depends on:** None (works with existing process metrics; optionally enhanced by mc-telemetry [Spec 022])  
> **Effort:** 2–3 weeks

---

## Overview

Add configurable alerting rules to MiniCluster. Users define threshold-based rules on system metrics (CPU, memory, disk, network) and process metrics (per-service CPU, memory, restart count). When a rule triggers, MiniCluster sends notifications via configured channels (webhook, email, SignalR push).

This is a **standalone feature** that works with the existing `ProcessMetricsCollectionService` and `SystemMetrics` — no dependency on OTLP or external tools. If the mc-telemetry companion app ([Spec 022](../022-otlp-telemetry/spec.md)) is running, alerting rules can optionally be extended to cover application-level OTLP metrics by querying mc-telemetry's API.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      ALERTING FLOW                               │
│                                                                   │
│  ┌──────────────────────┐    ┌──────────────────────────┐        │
│  │ ProcessMetrics       │    │ SystemMetrics             │        │
│  │ CollectionService    │───►│ (CPU, RAM, Disk, Network) │        │
│  │ (every 5s)           │    │                           │        │
│  └──────────────────────┘    └────────────┬──────────────┘        │
│                                           │                       │
│                                           ▼                       │
│                              ┌──────────────────────┐            │
│                              │  AlertEvaluator       │            │
│                              │  (BackgroundService)  │            │
│                              │                       │            │
│                              │  For each rule:       │            │
│                              │  - Read current value │            │
│                              │  - Compare threshold  │            │
│                              │  - Track duration     │            │
│                              │  - Debounce           │            │
│                              └──────────┬────────────┘            │
│                                         │                         │
│                               ┌─────────┼──────────┐             │
│                               ▼         ▼          ▼             │
│                          ┌────────┐ ┌────────┐ ┌────────┐        │
│                          │Webhook │ │ Email  │ │SignalR │        │
│                          │Notifier│ │Notifier│ │  Push  │        │
│                          └────────┘ └────────┘ └────────┘        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Entities

```csharp
public class AlertRule
{
    public int Id { get; set; }
    public string Name { get; set; }               // "High CPU on api-server"
    public string? Description { get; set; }
    
    // Scope
    public int? ServiceId { get; set; }             // null = system-wide rule
    public int? AppId { get; set; }                 // null = all apps
    
    // Condition
    public AlertMetric Metric { get; set; }         // CPU, Memory, DiskUsage, etc.
    public AlertOperator Operator { get; set; }     // GreaterThan, LessThan, Equals
    public double Threshold { get; set; }           // e.g. 90.0 (for 90%)
    public int DurationSeconds { get; set; }        // condition must hold for N seconds
    
    // Behavior
    public bool IsEnabled { get; set; } = true;
    public int CooldownMinutes { get; set; } = 5;   // don't re-fire within cooldown
    public AlertSeverity Severity { get; set; }      // Info, Warning, Critical
    
    // Notification channels (comma-separated channel IDs, or "all")
    public string NotifyChannels { get; set; } = "all";
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime? LastTriggeredAt { get; set; }
    public int TriggerCount { get; set; }
}

public class AlertEvent
{
    public long Id { get; set; }
    public int AlertRuleId { get; set; }
    public AlertRule AlertRule { get; set; }
    
    public DateTime Timestamp { get; set; }
    public AlertEventType EventType { get; set; }   // Triggered, Resolved, Acknowledged
    public double Value { get; set; }               // actual value that triggered
    public double Threshold { get; set; }           // threshold at time of trigger
    public string? Message { get; set; }            // human-readable summary
    public string? NotificationResults { get; set; } // JSON — which channels succeeded/failed
}

public class NotificationChannel
{
    public int Id { get; set; }
    public string Name { get; set; }                // "Slack Webhook", "Ops Email"
    public NotificationChannelType Type { get; set; } // Webhook, Email, SignalR
    public bool IsEnabled { get; set; } = true;
    
    // Webhook
    public string? WebhookUrl { get; set; }
    public string? WebhookHeaders { get; set; }     // JSON — custom headers
    public string? WebhookTemplate { get; set; }    // JSON body template with placeholders
    
    // Email
    public string? EmailTo { get; set; }            // comma-separated addresses
    public string? EmailSubjectTemplate { get; set; }
    
    public DateTime CreatedAt { get; set; }
}
```

### Enums

```csharp
public enum AlertMetric
{
    // System-wide
    SystemCpuPercent,
    SystemMemoryPercent,
    SystemDiskPercent,
    
    // Per-service
    ProcessCpuPercent,
    ProcessMemoryMb,
    ProcessThreadCount,
    ProcessRestartCount,
    ProcessNotResponding,
    
    // Per-service (optional — requires OTLP Spec 022)
    // OtlpCustomMetric  // future
}

public enum AlertOperator
{
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    Equals,
    NotEquals
}

public enum AlertSeverity
{
    Info,
    Warning,
    Critical
}

public enum AlertEventType
{
    Triggered,
    Resolved,
    Acknowledged
}

public enum NotificationChannelType
{
    Webhook,
    Email,
    SignalR
}
```

---

## Alert Evaluator

```csharp
public class AlertEvaluatorService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AlertEvaluatorService> _logger;

    // Track how long each rule's condition has been true
    private readonly ConcurrentDictionary<int, DateTime> _conditionStartTimes = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
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

            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken); // eval every 10s
        }
    }

    private async Task EvaluateAllRulesAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MiniClusterDbContext>();
        var metricsService = scope.ServiceProvider.GetRequiredService<IMetricsProvider>();
        var notifier = scope.ServiceProvider.GetRequiredService<IAlertNotifier>();

        var rules = await db.AlertRules
            .Where(r => r.IsEnabled)
            .ToListAsync(ct);

        foreach (var rule in rules)
        {
            var currentValue = await metricsService.GetCurrentValueAsync(rule.Metric, rule.ServiceId);
            if (currentValue is null) continue;

            var conditionMet = Evaluate(rule.Operator, currentValue.Value, rule.Threshold);

            if (conditionMet)
            {
                var startTime = _conditionStartTimes.GetOrAdd(rule.Id, DateTime.UtcNow);
                var elapsed = (DateTime.UtcNow - startTime).TotalSeconds;

                if (elapsed >= rule.DurationSeconds)
                {
                    // Check cooldown
                    if (rule.LastTriggeredAt is null ||
                        (DateTime.UtcNow - rule.LastTriggeredAt.Value).TotalMinutes >= rule.CooldownMinutes)
                    {
                        await TriggerAlertAsync(db, rule, currentValue.Value, notifier, ct);
                    }
                }
            }
            else
            {
                // Condition resolved — clear tracking, optionally emit Resolved event
                if (_conditionStartTimes.TryRemove(rule.Id, out _))
                {
                    await ResolveAlertAsync(db, rule, currentValue.Value, notifier, ct);
                }
            }
        }
    }

    private static bool Evaluate(AlertOperator op, double value, double threshold) => op switch
    {
        AlertOperator.GreaterThan => value > threshold,
        AlertOperator.GreaterThanOrEqual => value >= threshold,
        AlertOperator.LessThan => value < threshold,
        AlertOperator.LessThanOrEqual => value <= threshold,
        AlertOperator.Equals => Math.Abs(value - threshold) < 0.001,
        AlertOperator.NotEquals => Math.Abs(value - threshold) >= 0.001,
        _ => false
    };
}
```

---

## Notification System

```csharp
public interface IAlertNotifier
{
    Task NotifyAsync(AlertRule rule, AlertEvent alertEvent, CancellationToken ct);
}

public class AlertNotifier : IAlertNotifier
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IHubContext<LogHub> _hubContext;

    public async Task NotifyAsync(AlertRule rule, AlertEvent alertEvent, CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MiniClusterDbContext>();

        var channels = await db.NotificationChannels
            .Where(c => c.IsEnabled)
            .ToListAsync(ct);

        if (rule.NotifyChannels != "all")
        {
            var channelIds = rule.NotifyChannels.Split(',').Select(int.Parse).ToHashSet();
            channels = channels.Where(c => channelIds.Contains(c.Id)).ToList();
        }

        var results = new Dictionary<string, string>();

        foreach (var channel in channels)
        {
            try
            {
                switch (channel.Type)
                {
                    case NotificationChannelType.Webhook:
                        await SendWebhookAsync(channel, rule, alertEvent);
                        results[channel.Name] = "sent";
                        break;
                    case NotificationChannelType.Email:
                        await SendEmailAsync(channel, rule, alertEvent);
                        results[channel.Name] = "sent";
                        break;
                    case NotificationChannelType.SignalR:
                        await _hubContext.Clients.Group("alerts")
                            .SendAsync("AlertTriggered", alertEvent, ct);
                        results[channel.Name] = "sent";
                        break;
                }
            }
            catch (Exception ex)
            {
                results[channel.Name] = $"failed: {ex.Message}";
            }
        }

        alertEvent.NotificationResults = JsonSerializer.Serialize(results);
    }
}
```

---

## API Endpoints

### Alert Rules

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/alerts/rules` | List all alert rules |
| `GET` | `/api/alerts/rules/{id}` | Get a specific rule |
| `POST` | `/api/alerts/rules` | Create a new rule |
| `PUT` | `/api/alerts/rules/{id}` | Update a rule |
| `DELETE` | `/api/alerts/rules/{id}` | Delete a rule |
| `POST` | `/api/alerts/rules/{id}/enable` | Enable a rule |
| `POST` | `/api/alerts/rules/{id}/disable` | Disable a rule |
| `POST` | `/api/alerts/rules/{id}/test` | Test-fire a rule (sends notification without recording) |

### Alert Events (History)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/alerts/events` | List alert events (filter by rule, severity, time) |
| `GET` | `/api/alerts/events/{id}` | Get event detail |
| `POST` | `/api/alerts/events/{id}/acknowledge` | Acknowledge an alert |
| `GET` | `/api/alerts/active` | Currently firing alerts |

### Notification Channels

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/alerts/channels` | List notification channels |
| `POST` | `/api/alerts/channels` | Create a channel |
| `PUT` | `/api/alerts/channels/{id}` | Update a channel |
| `DELETE` | `/api/alerts/channels/{id}` | Delete a channel |
| `POST` | `/api/alerts/channels/{id}/test` | Send a test notification |

---

## UI Components

### Alerts Dashboard (`/alerts`)

- **Active Alerts** — currently firing alerts with severity badges, values, timestamps
- **Alert History** — paginated table of past events with Triggered/Resolved/Acknowledged status
- **Acknowledge** button — marks an alert as acknowledged

### Alert Rules Manager (`/alerts/rules`)

- CRUD for alert rules
- Service picker (system-wide or per-service)
- Metric dropdown, operator, threshold, duration inputs
- Channel selector (multi-select)
- Enable/disable toggle
- "Test" button to fire a test notification

### Notification Channels (`/alerts/channels`)

- CRUD for webhook, email, and SignalR channels
- Webhook: URL, headers, body template with preview
- Email: recipients, subject template
- "Send Test" button per channel

### Real-time Alert Banner

- Global alert banner in Layout when active critical alerts exist
- Animated bell icon in nav with unacknowledged count badge
- SignalR push — new alerts appear without page refresh

---

## Implementation Phases

### Phase 13a: Core Alerting Engine (~1 week)
- `AlertRule`, `AlertEvent`, `NotificationChannel` entities + migrations
- `AlertEvaluatorService` (BackgroundService)
- `IMetricsProvider` adapter that reads from existing `ProcessMetricsCollectionService`
- `IAlertNotifier` with webhook support
- Alert rules CRUD API

### Phase 13b: Notification Channels (~3-4 days)
- Email notifier (SMTP)
- Webhook notifier with templating
- SignalR push to UI
- Notification channels CRUD API
- Test notification endpoint

### Phase 13c: Alerts UI (~1 week)
- Alerts dashboard page
- Alert rules manager
- Notification channels page
- Real-time alert banner in Layout
- History with acknowledge flow

---

## Configuration

```json
{
  "Alerting": {
    "Enabled": true,
    "EvaluationIntervalSeconds": 10,
    "MaxActiveAlerts": 100,
    "Email": {
      "SmtpHost": "",
      "SmtpPort": 587,
      "SmtpUser": "",
      "SmtpPassword": "",
      "FromAddress": "minicluster@example.com"
    }
  }
}
```

---

## Default Alert Rules (seeded)

On first run, seed a set of recommended rules (disabled by default, user opts in):

| Rule | Metric | Threshold | Duration | Severity |
|------|--------|-----------|----------|----------|
| High System CPU | SystemCpuPercent | > 90% | 60s | Critical |
| High System Memory | SystemMemoryPercent | > 85% | 60s | Warning |
| Disk Nearly Full | SystemDiskPercent | > 90% | 0s | Critical |
| Service Crash Loop | ProcessRestartCount | > 5 | 300s | Critical |
| Service Not Responding | ProcessNotResponding | = 1 | 30s | Warning |
| High Process Memory | ProcessMemoryMb | > 1024 | 60s | Warning |

---

## Testing

- Unit tests for `AlertEvaluatorService` logic (operators, duration tracking, cooldown)
- Integration tests for webhook delivery (mock HTTP server)
- Test-fire endpoint verification
- UI smoke tests for rules CRUD and alert history
