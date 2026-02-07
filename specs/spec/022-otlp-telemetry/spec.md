# Feature 022: mc-telemetry — OTLP Companion App

> **Stage:** 2 — Observability  
> **Phase:** 13  
> **Depends on:** None (complementary to existing stdout/stderr logging)  
> **Effort:** 4–5 weeks  
> **Type:** Companion app (separate process, own DB, own UI)

---

## Overview

**mc-telemetry** is a standalone companion application that MiniCluster manages as a first-class service. It acts like a self-hosted Seq or Jaeger — a dedicated telemetry backend that receives, stores, queries, and visualizes OpenTelemetry data from any instrumented application.

MiniCluster doesn't embed OTLP handling into its own process. Instead, it **manages mc-telemetry the same way it manages any other app**, while having deep integration points: auto-deployment, settings integration, dashboard widgets, service-detail enrichment, and reverse-proxy access.

### Why a Companion App?

| Aspect | Embedded (rejected) | Companion App (this spec) |
|--------|---------------------|---------------------------|
| **Failure isolation** | OTLP receiver crash = MiniCluster crash | Collector crashes independently, MC restarts it |
| **Resource pressure** | High-volume telemetry ingestion competes with API requests | Separate process, separate memory, CPU-isolated |
| **Updates** | Update collector = restart entire MiniCluster | Update collector independently, zero downtime on MC |
| **Opt-in** | Always loaded even if disabled | Not deployed = zero footprint |
| **Dogfooding** | Doesn't prove anything | MC manages its own companion — eats its own dog food |
| **Scalability** | Locked to MC's single process | Could run multiple instances in Stage 2 |
| **Reusability** | Tied to MC forever | Could be used standalone by anyone |

### What mc-telemetry IS

- A **separate .NET project**: `Innovatek.Parallel.Telemetry`
- A **standalone binary** that ships alongside MiniCluster (or downloadable separately)
- Has its **own SQLite database** (`telemetry.db`), own REST API, own web UI
- MiniCluster deploys it as a managed service with reserved name `mc-telemetry`
- Follows the **Seq model**: your apps point their OTel exporters at it, it stores and visualizes

### What mc-telemetry is NOT

- Not embedded in the MiniCluster API process
- Not a replacement for existing stdout/stderr capture or process metrics
- Not a full observability platform (no alerting — that's [Spec 023](../023-alerting/spec.md))
- Not dependent on TimescaleDB or PostgreSQL

---

## Architecture

### System-Level View

```
┌─────────────────────────────────────────────────────────┐
│  MiniCluster (process manager)                          │
│                                                         │
│  Knows about "mc-telemetry" companion:                  │
│  ┌─────────────────────────────────────────────┐        │
│  │ • Auto-deploys it as a managed service      │        │
│  │ • Optionally pushes stdout/stderr + process  │        │
│  │   metrics to it in OTLP format              │        │
│  │ • Proxies its UI under /proxy/telemetry     │        │
│  │ • Queries its API for dashboard widgets     │        │
│  │ • Health-checks it like any other service   │        │
│  │ • Configures it via MC settings UI          │        │
│  └─────────────────────────────────────────────┘        │
└────────────────────┬────────────────────────────────────┘
                     │ manages
                     ▼
┌─────────────────────────────────────────────────────────┐
│  mc-telemetry (companion app)                           │
│                                                         │
│  Own process • Own DB • Own API • Own UI                │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ OTLP Receiver│  │ Storage      │  │ Web UI       │  │
│  │ gRPC :4317   │  │ telemetry.db │  │ :5300        │  │
│  │ HTTP :4318   │  │ (SQLite)     │  │ Log viewer   │  │
│  └──────────────┘  │              │  │ Trace view   │  │
│                    │ - logs       │  │ Dashboards   │  │
│  ┌──────────────┐  │ - metrics    │  │ Metrics      │  │
│  │ Query API    │  │ - spans      │  └──────────────┘  │
│  │ REST :5300   │  │ - events     │                    │
│  └──────────────┘  └──────────────┘                    │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ MC Adapter   │  │ Forwarder    │                    │
│  │ Accepts MC's │  │ → Seq        │                    │
│  │ process data │  │ → Grafana    │                    │
│  │ in OTLP fmt  │  │ → Loki       │                    │
│  └──────────────┘  │ → Jaeger     │                    │
│                    │ → Datadog    │                    │
│                    └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### Telemetry Data Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW                                   │
│                                                                    │
│   ┌───────────────┐                                               │
│   │ User App      │  OTLP/gRPC :4317  ┌────────────────────┐     │
│   │ (.NET, Node,  │ ─────────────────► │                    │     │
│   │  Python, Go,  │  OTLP/HTTP :4318  │   mc-telemetry     │     │
│   │  Java, etc.)  │ ─────────────────► │                    │     │
│   │               │                    │   OTLP Receiver    │     │
│   │ Uses OTel SDK │                    │                    │     │
│   └───────────────┘                    └────────┬───────────┘     │
│                                                  │                 │
│   ┌───────────────┐       (optional)             │                 │
│   │ MiniCluster   │  OTLP/HTTP                   │                 │
│   │ Auto-Forwarder│ ─────────────────►           │                 │
│   │               │                              │                 │
│   │ Converts:     │                              │                 │
│   │ • stdout/err  │                              │                 │
│   │   → OTLP logs │                              │                 │
│   │ • CPU/mem     │                              │                 │
│   │   → OTLP met. │                              │                 │
│   └───────────────┘                              │                 │
│                                                  ▼                 │
│                                    ┌──────────────────────┐        │
│                                    │   Pipeline           │        │
│                                    │                      │        │
│                                    │  Parse → Map →       │        │
│                                    │  Batch → Write       │        │
│                                    └──────────┬───────────┘        │
│                                               │                    │
│                              ┌────────────────┼───────────────┐    │
│                              ▼                                ▼    │
│                   ┌──────────────────┐           ┌──────────────┐  │
│                   │  telemetry.db    │           │  Forwarder   │  │
│                   │  (SQLite)        │           │              │  │
│                   │                  │           │  → Seq       │  │
│                   │  logs table      │           │  → Grafana   │  │
│                   │  metrics table   │           │  → Loki      │  │
│                   │  spans table     │           │  → Jaeger    │  │
│                   │  events table    │           │  → Any OTLP  │  │
│                   └────────┬─────────┘           └──────────────┘  │
│                            │                                       │
│              ┌─────────────┼──────────────┐                        │
│              ▼             ▼              ▼                        │
│     ┌──────────────┐ ┌──────────┐ ┌────────────┐                  │
│     │ mc-telemetry │ │ MC       │ │ MC Service │                  │
│     │ own Web UI   │ │ Dashboard│ │ Details    │                  │
│     │ :5300        │ │ Widgets  │ │ OTLP tab   │                  │
│     └──────────────┘ └──────────┘ └────────────┘                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Existing vs. OTLP — Side by Side

These two systems are **complementary, not competing**. They run independently and serve different purposes.

| Aspect | Existing (stdout/stderr) | OTLP (mc-telemetry) |
|--------|--------------------------|---------------------|
| Source | Process output streams | OpenTelemetry SDK in app |
| Format | Plain text lines | Structured protobuf (logs, metrics, spans) |
| Severity | `stdout` / `stderr` only | Trace, Debug, Info, Warn, Error, Fatal |
| Context | Session + timestamp | TraceId, SpanId, attributes, resource info |
| Metrics | OS-level (CPU, memory) | Application-level (custom counters, histograms) |
| Traces | None | Full distributed trace spans |
| Process | Embedded in MiniCluster API | Separate companion process |
| Storage | `LogsDb.sqlite` | `telemetry.db` (companion's own DB) |
| Real-time | SignalR `LogHub` | WebSocket / SSE from mc-telemetry |
| Can forward | No | Yes — to Seq, Grafana, Loki, Jaeger, etc. |

A managed app can emit stdout AND OTLP simultaneously. MiniCluster captures the stdout; mc-telemetry receives the OTLP.

---

## The Companion App: `Innovatek.Parallel.Telemetry`

### Project Structure

```
Innovatek.Parallel.Telemetry/
├── Innovatek.Parallel.Telemetry.csproj
├── Program.cs                  # Kestrel + gRPC host
├── appsettings.json
├── Data/
│   ├── TelemetryDbContext.cs   # EF Core, own telemetry.db
│   └── Migrations/
├── Entities/
│   ├── OtlpLogEntry.cs
│   ├── OtlpMetric.cs
│   ├── OtlpSpan.cs
│   └── OtlpEvent.cs
├── Receiver/
│   ├── OtlpGrpcLogsService.cs
│   ├── OtlpGrpcMetricsService.cs
│   ├── OtlpGrpcTraceService.cs
│   └── OtlpHttpController.cs    # HTTP/protobuf fallback
├── Pipeline/
│   ├── IOtlpPipeline.cs
│   ├── OtlpPipeline.cs          # Parse → batch → store + forward
│   └── TelemetryBatchWriter.cs   # Channel-based batch writer
├── Export/
│   ├── IOtlpExporter.cs
│   ├── OtlpExporter.cs          # Forward to Seq/Grafana/etc.
│   └── OtlpExportSettings.cs
├── Query/
│   ├── LogsController.cs
│   ├── MetricsController.cs
│   ├── TracesController.cs
│   └── StatsController.cs
├── Services/
│   ├── RetentionService.cs       # Auto-cleanup old data
│   └── McAdapterService.cs       # Accept MC's forwarded process data
├── wwwroot/                      # Embedded web UI (SPA)
│   ├── index.html
│   └── assets/
└── Properties/
    └── launchSettings.json
```

### Entry Point

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddDbContext<TelemetryDbContext>(options =>
    options.UseSqlite($"Data Source={Path.Combine(builder.Environment.ContentRootPath, "telemetry.db")}"));

// OTLP gRPC services
builder.Services.AddGrpc();

// Pipeline
builder.Services.AddSingleton<IOtlpPipeline, OtlpPipeline>();
builder.Services.AddHostedService<TelemetryBatchWriter>();
builder.Services.AddHostedService<RetentionService>();

// Exporter (forwarding)
builder.Services.Configure<OtlpExportSettings>(builder.Configuration.GetSection("Export"));
builder.Services.AddSingleton<IOtlpExporter, OtlpExporter>();

var app = builder.Build();

// Apply migrations
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TelemetryDbContext>();
    await db.Database.MigrateAsync();
}

// gRPC endpoints (OTLP receiver)
app.MapGrpcService<OtlpGrpcLogsService>();
app.MapGrpcService<OtlpGrpcMetricsService>();
app.MapGrpcService<OtlpGrpcTraceService>();

// REST API (query endpoints)
app.MapControllers();

// Embedded UI
app.UseStaticFiles();
app.MapFallbackToFile("index.html");

app.Run();
```

### Configuration

```json
// mc-telemetry appsettings.json
{
  "Urls": "http://0.0.0.0:5300",
  "Kestrel": {
    "Endpoints": {
      "Grpc": {
        "Url": "http://0.0.0.0:4317",
        "Protocols": "Http2"
      },
      "Http": {
        "Url": "http://0.0.0.0:5300",
        "Protocols": "Http1"
      }
    }
  },
  "Storage": {
    "RetentionDays": {
      "Logs": 30,
      "Metrics": 90,
      "Spans": 7,
      "Events": 365
    }
  },
  "Export": {
    "Enabled": false,
    "Endpoint": "",
    "Protocol": "http",
    "Headers": {}
  }
}
```

---

## Data Model (SQLite — `telemetry.db`)

### Entities

```csharp
// Structured log entry from OTLP
public class OtlpLogEntry
{
    public long Id { get; set; }
    public DateTime Timestamp { get; set; }
    public string? ServiceName { get; set; }      // from resource.service.name
    public int SeverityLevel { get; set; }         // 0=Trace..23=Fatal (OTLP scale)
    public string? SeverityText { get; set; }      // "INFO", "ERROR", etc.
    public string Body { get; set; } = "";         // log message
    public string? Attributes { get; set; }        // JSON — structured fields
    public string? ResourceAttributes { get; set; }// JSON — service.name, host, etc.
    public string? TraceId { get; set; }           // correlation
    public string? SpanId { get; set; }
    public string? ExceptionType { get; set; }
    public string? ExceptionMessage { get; set; }
    public string? ExceptionStackTrace { get; set; }
}

// Application-level metric from OTLP
public class OtlpMetric
{
    public long Id { get; set; }
    public DateTime Timestamp { get; set; }
    public string? ServiceName { get; set; }
    public string Name { get; set; } = "";         // e.g. "http.request.duration"
    public string? Unit { get; set; }              // e.g. "ms", "bytes"
    public double Value { get; set; }
    public int MetricType { get; set; }            // 0=Gauge, 1=Sum, 2=Histogram
    public string? Attributes { get; set; }        // JSON — dimensions/labels
}

// Distributed trace span from OTLP
public class OtlpSpan
{
    public long Id { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string TraceId { get; set; } = "";
    public string SpanId { get; set; } = "";
    public string? ParentSpanId { get; set; }
    public string? ServiceName { get; set; }
    public string Name { get; set; } = "";         // e.g. "GET /api/users"
    public int SpanKind { get; set; }              // 0=Internal,1=Server,2=Client,3=Producer,4=Consumer
    public int Status { get; set; }                // 0=Unset, 1=Ok, 2=Error
    public string? StatusMessage { get; set; }
    public long DurationNs { get; set; }
    public string? Attributes { get; set; }        // JSON
    public string? Events { get; set; }            // JSON — span events
}

// General event (lifecycle, custom)
public class OtlpEvent
{
    public long Id { get; set; }
    public DateTime Timestamp { get; set; }
    public string? ServiceName { get; set; }
    public string Type { get; set; } = "";         // "started", "crashed", "deployed", custom
    public string? Message { get; set; }
    public string? Details { get; set; }           // JSON
}
```

Note: mc-telemetry uses `ServiceName` (string) instead of `ServiceId` (int) — it doesn't reference MiniCluster's database. It's self-contained. MiniCluster maps names when querying.

### Indexes

```sql
CREATE INDEX IX_Logs_ServiceName_Timestamp ON OtlpLogEntries (ServiceName, Timestamp DESC);
CREATE INDEX IX_Logs_SeverityLevel ON OtlpLogEntries (SeverityLevel, Timestamp DESC);
CREATE INDEX IX_Logs_TraceId ON OtlpLogEntries (TraceId) WHERE TraceId IS NOT NULL;

CREATE INDEX IX_Metrics_ServiceName_Name ON OtlpMetrics (ServiceName, Name, Timestamp DESC);

CREATE INDEX IX_Spans_TraceId ON OtlpSpans (TraceId, StartTime);
CREATE INDEX IX_Spans_ServiceName ON OtlpSpans (ServiceName, StartTime DESC);

CREATE INDEX IX_Events_ServiceName ON OtlpEvents (ServiceName, Timestamp DESC);
```

---

## OTLP Receiver

### gRPC Services

```csharp
// NuGet: OpenTelemetry.Proto, Grpc.AspNetCore
public class OtlpGrpcLogsService : LogsService.LogsServiceBase
{
    private readonly IOtlpPipeline _pipeline;

    public override async Task<ExportLogsServiceResponse> Export(
        ExportLogsServiceRequest request,
        ServerCallContext context)
    {
        await _pipeline.ProcessLogsAsync(request);
        return new ExportLogsServiceResponse();
    }
}

public class OtlpGrpcMetricsService : MetricsService.MetricsServiceBase
{
    private readonly IOtlpPipeline _pipeline;

    public override async Task<ExportMetricsServiceResponse> Export(
        ExportMetricsServiceRequest request,
        ServerCallContext context)
    {
        await _pipeline.ProcessMetricsAsync(request);
        return new ExportMetricsServiceResponse();
    }
}

public class OtlpGrpcTraceService : TraceService.TraceServiceBase
{
    private readonly IOtlpPipeline _pipeline;

    public override async Task<ExportTraceServiceResponse> Export(
        ExportTraceServiceRequest request,
        ServerCallContext context)
    {
        await _pipeline.ProcessTracesAsync(request);
        return new ExportTraceServiceResponse();
    }
}
```

### HTTP OTLP Endpoint (fallback for SDKs that prefer HTTP)

```csharp
[ApiController]
[Route("v1")]
public class OtlpHttpController : ControllerBase
{
    private readonly IOtlpPipeline _pipeline;

    [HttpPost("logs")]
    public async Task<IActionResult> ExportLogs()
    {
        var request = ExportLogsServiceRequest.Parser.ParseFrom(await ReadBodyAsync());
        await _pipeline.ProcessLogsAsync(request);
        return Ok();
    }

    [HttpPost("metrics")]
    public async Task<IActionResult> ExportMetrics()
    {
        var request = ExportMetricsServiceRequest.Parser.ParseFrom(await ReadBodyAsync());
        await _pipeline.ProcessMetricsAsync(request);
        return Ok();
    }

    [HttpPost("traces")]
    public async Task<IActionResult> ExportTraces()
    {
        var request = ExportTraceServiceRequest.Parser.ParseFrom(await ReadBodyAsync());
        await _pipeline.ProcessTracesAsync(request);
        return Ok();
    }
}
```

### Telemetry Pipeline

```csharp
public interface IOtlpPipeline
{
    Task ProcessLogsAsync(ExportLogsServiceRequest request);
    Task ProcessMetricsAsync(ExportMetricsServiceRequest request);
    Task ProcessTracesAsync(ExportTraceServiceRequest request);
}

public class OtlpPipeline : IOtlpPipeline
{
    private readonly Channel<TelemetryBatch> _channel;
    private readonly IOtlpExporter _exporter;

    public async Task ProcessLogsAsync(ExportLogsServiceRequest request)
    {
        var entries = new List<OtlpLogEntry>();

        foreach (var resourceLogs in request.ResourceLogs)
        {
            var serviceName = ExtractServiceName(resourceLogs.Resource);

            foreach (var scopeLogs in resourceLogs.ScopeLogs)
            {
                foreach (var logRecord in scopeLogs.LogRecords)
                {
                    entries.Add(MapLogEntry(logRecord, serviceName, resourceLogs.Resource));
                }
            }
        }

        // Write to local store (batched via channel)
        await _channel.Writer.WriteAsync(new TelemetryBatch(TelemetryType.Logs, entries));

        // Forward to external backend (if configured)
        if (_exporter.IsEnabled)
            await _exporter.ExportLogsAsync(request);
    }

    private static string? ExtractServiceName(Resource? resource)
    {
        return resource?.Attributes
            .FirstOrDefault(a => a.Key == "service.name")
            ?.Value?.StringValue;
    }

    // Similar for metrics and traces...
}
```

---

## OTLP Exporter (Forwarding)

Forward received telemetry to external backends. Sends raw OTLP protobuf — compatible with any OTLP backend (Seq, Grafana, Loki, Jaeger, Datadog, etc.).

```csharp
public interface IOtlpExporter
{
    bool IsEnabled { get; }
    Task ExportLogsAsync(ExportLogsServiceRequest request);
    Task ExportMetricsAsync(ExportMetricsServiceRequest request);
    Task ExportTracesAsync(ExportTraceServiceRequest request);
}

public class OtlpExporter : IOtlpExporter
{
    private readonly OtlpExportSettings _settings;
    private readonly HttpClient _httpClient;
    private readonly GrpcChannel? _grpcChannel;

    public bool IsEnabled => _settings.Enabled && !string.IsNullOrEmpty(_settings.Endpoint);

    public async Task ExportLogsAsync(ExportLogsServiceRequest request)
    {
        if (!IsEnabled) return;

        if (_settings.Protocol == "grpc")
        {
            var client = new LogsService.LogsServiceClient(_grpcChannel);
            await client.ExportAsync(request);
        }
        else
        {
            var bytes = request.ToByteArray();
            var content = new ByteArrayContent(bytes);
            content.Headers.ContentType = new("application/x-protobuf");
            await _httpClient.PostAsync($"{_settings.Endpoint}/v1/logs", content);
        }
    }

    // Similar for metrics and traces...
}
```

---

## mc-telemetry Query API

The companion exposes its own REST API for querying stored telemetry. Both mc-telemetry's own UI and MiniCluster's integration widgets use this API.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/logs` | Query structured logs (filter by service, severity, time, traceId, text) |
| `GET` | `/api/logs/services` | List service names that have sent logs |
| `GET` | `/api/metrics` | Query metrics (filter by service, name, time range) |
| `GET` | `/api/metrics/names` | List distinct metric names |
| `GET` | `/api/traces` | Query traces (filter by service, status, duration, time) |
| `GET` | `/api/traces/{traceId}` | Full trace waterfall (all spans for a trace) |
| `GET` | `/api/events` | Query events (filter by service, type, time) |
| `GET` | `/api/stats` | Storage stats: row counts, DB size, retention config |
| `GET` | `/api/health` | Health check endpoint |
| `PUT` | `/api/config` | Update runtime config (retention, export) |
| `DELETE` | `/api/purge` | Purge all telemetry data |
| `DELETE` | `/api/purge/{serviceName}` | Purge data for a specific service |

---

## mc-telemetry Web UI

mc-telemetry ships with its own embedded minimal web UI (served from `wwwroot/`). This is a lightweight SPA — not a full React app, just enough to be useful standalone.

### Pages

1. **Log Explorer** — Structured log table with severity colors, filter by service/level/time/text, expandable rows with attributes and exception details, click TraceId to jump to trace view
2. **Trace Viewer** — Gantt-chart waterfall of spans within a trace, color-coded by service, click span for attributes/events/status, shows total duration and critical path
3. **Metrics Dashboard** — Line charts for application metrics, grouped by name, filterable by service, time range picker (1h, 6h, 24h, 7d)
4. **Events Timeline** — Chronological event feed, filterable by service and type
5. **Settings** — Retention config, export endpoint config, storage stats, purge controls

---

## MiniCluster Integration Points

This is what makes mc-telemetry a "known companion" rather than just another managed service. MiniCluster has built-in awareness of mc-telemetry and provides these integration features:

### 1. Deployment & Lifecycle

```
mc telemetry enable          # Deploy mc-telemetry as managed service
mc telemetry disable         # Remove mc-telemetry
mc telemetry status          # Show mc-telemetry health + stats
mc telemetry open            # Open mc-telemetry UI in browser
```

MiniCluster creates a managed service with reserved name `mc-telemetry`:
- Binary path: `<mc-install-dir>/companions/mc-telemetry`
- Working dir: `<mc-data-dir>/telemetry/`
- Auto-restart on crash (RestartPolicy = Always)
- Health check: HTTP GET `http://localhost:5300/api/health`

### 2. Settings Integration

MiniCluster's Settings UI gets a **"Telemetry"** section that configures mc-telemetry via its REST API:

```
Settings → Telemetry
├── Status: ● Running (mc-telemetry v1.2.0)
├── OTLP Receiver: grpc://localhost:4317, http://localhost:5300/v1/*
├── Retention: Logs 30d, Metrics 90d, Spans 7d
├── Export: Disabled [Configure]
└── Storage: 142 MB (1.2M logs, 340K metrics, 45K spans)
```

### 3. Dashboard Widgets

MiniCluster's dashboard can embed summary widgets by querying mc-telemetry's API:

- **Recent Errors** — Last 5 error-level OTLP logs across all services
- **Request Rate** — Aggregate `http.server.request.duration` metric if available
- **Trace Errors** — Recent traces with error status

### 4. Service Details Enrichment

When viewing a service in MiniCluster, an **"OTLP"** tab appears (if mc-telemetry is running) showing that service's structured logs, traces, and metrics — pulled from mc-telemetry's API using the service name as the filter key.

```
ServiceDetails → Tabs
├── Console (existing stdout/stderr)
├── Config
├── Container
├── Versions
└── OTLP (new — only visible when mc-telemetry is running)
    ├── Structured Logs (from mc-telemetry /api/logs?service=my-app)
    ├── Traces (from mc-telemetry /api/traces?service=my-app)
    └── Metrics (from mc-telemetry /api/metrics?service=my-app)
```

### 5. Auto-Forwarding (Optional)

MiniCluster can optionally convert its existing captured data to OTLP format and push it to mc-telemetry:

- **stdout/stderr → OTLP logs**: Each captured log line becomes an OTLP log entry with `source=stdout|stderr`, severity mapped from detected log level patterns
- **Process metrics → OTLP metrics**: CPU, memory, threads, disk I/O emitted as OTLP gauge metrics with `service.name` resource attribute

This is opt-in per service via configuration:

```json
{
  "Telemetry": {
    "AutoForward": {
      "Enabled": false,
      "Endpoint": "http://localhost:5300/v1",
      "ForwardLogs": true,
      "ForwardMetrics": true
    }
  }
}
```

### 6. Reverse Proxy

mc-telemetry's UI is accessible through MiniCluster's reverse proxy:

```
https://your-server.com/proxy/telemetry → http://localhost:5300
```

Auto-configured when mc-telemetry is enabled. Requires MiniCluster authentication.

---

## Companion App Pattern

mc-telemetry establishes the **companion app pattern** that will be reused in Stage 2:

```
┌──────────────────────────────────────────────────────────────────┐
│                    COMPANION APP PATTERN                         │
│                                                                  │
│  MiniCluster manages companions like any service, but with:     │
│                                                                  │
│  1. Reserved service name (mc-telemetry, mc-discovery, etc.)    │
│  2. Built-in integration code in MC (settings, widgets, tabs)   │
│  3. Ships alongside MC binary (companions/ directory)           │
│  4. Own database, own API, own UI                               │
│  5. Proxy route auto-configured                                 │
│  6. CLI subcommand (mc telemetry enable)                        │
│                                                                  │
│  Stage 1 companions:                                            │
│    mc-telemetry — OTLP receiver + telemetry storage + UI        │
│                                                                  │
│  Stage 2 companions (future):                                   │
│    mc-discovery — Service discovery + health                    │
│    mc-identity  — OIDC provider + user management               │
│    mc-config    — Distributed config + convergence              │
│    mc-registry  — Package registry + distribution               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## NuGet Dependencies (mc-telemetry project)

```xml
<PackageReference Include="OpenTelemetry.Proto" Version="1.*" />
<PackageReference Include="Grpc.AspNetCore" Version="2.*" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="10.*" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="10.*" />
```

---

## Implementation Phases

### Phase 12a: mc-telemetry Core (~1.5 weeks)
- New solution project: `Innovatek.Parallel.Telemetry`
- `TelemetryDbContext` + entities + migrations
- gRPC OTLP receiver (logs, metrics, traces)
- HTTP OTLP receiver (`/v1/logs`, `/v1/metrics`, `/v1/traces`)
- `OtlpPipeline` with channel-based batch writing
- `RetentionService` for auto-cleanup
- Configuration model
- Health check endpoint
- Build as standalone binary

### Phase 12b: Query API + Exporter (~1 week)
- REST query endpoints (logs, metrics, traces, events, stats)
- Pagination, filtering, time-range queries
- `OtlpExporter` with gRPC and HTTP protocol support
- Purge endpoints
- Config update endpoint

### Phase 12c: mc-telemetry Web UI (~1 week)
- Log explorer with severity filtering and search
- Trace waterfall visualization
- Metrics dashboard with charts
- Events timeline
- Settings page
- Embed in binary via `wwwroot/`

### Phase 12d: MiniCluster Integration (~1 week)
- `mc telemetry enable/disable/status` CLI commands
- Companion deployment logic (reserved service name, auto-restart, health check)
- Settings UI "Telemetry" section
- Service details "OTLP" tab (queries mc-telemetry API)
- Dashboard widgets (recent errors, request rate)
- Reverse proxy route auto-config
- Optional auto-forwarding (stdout → OTLP logs, process metrics → OTLP metrics)

---

## Testing

- Unit tests for OTLP proto parsing and entity mapping
- Integration tests sending OTLP data via gRPC and HTTP
- Query API tests with filtering and pagination
- Forwarding tests against mock OTLP backend
- Retention cleanup tests
- MC integration tests (deployment, settings, tab visibility)
- End-to-end: app with OTel SDK → mc-telemetry → logs visible in UI
