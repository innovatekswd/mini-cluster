# 001 — Network Optimization, Keep-Alive & Long Timeouts

> Created: 2026-03-11
> Status: Active
> Topic: Optimizing network layer across API (.NET), CLI (Go), and UI (React) — keep-alive, long timeouts, connection pooling, streaming, back-pressure

---

## 1. Context & Problem Statement

MiniCluster is a local cluster manager where:
- The **API** (.NET / ASP.NET Core) manages long-lived processes, streams logs, exposes a terminal over WebSocket, and serves REST endpoints.
- The **CLI** (Go) communicates with the API over HTTP.
- The **UI** (React / React Router) connects via REST (Axios) and real-time SignalR/WebSocket.

Network problems compound here because many operations are inherently long-running:
- App startup / shutdown sequences can take 10–120 s.
- Log streaming is indefinite (until the process exits).
- Terminal sessions are indefinitely open WebSocket connections.
- Health-polling + SignalR heartbeat + status polling all compete for the same connection pool.

**Key pain points identified from the code:**

| Layer | Pain Point | File |
|-------|------------|------|
| .NET API | `RequestTimeoutMiddleware` hard-codes 30 s for ALL routes | [Middleware/RequestTimeoutMiddleware.cs](../../api/Innovatek.Parallel.MiniCluster.Api/Middleware/RequestTimeoutMiddleware.cs) |
| .NET API | SignalR `ClientTimeoutInterval` = 60 s — aggressive for low-bandwidth clients | [Program.cs](../../api/Innovatek.Parallel.MiniCluster.Api/Program.cs) |
| Go CLI | `http.Client.Timeout` defaults to 30 s; long uploads/downloads will abort | [cli/internal/api/client.go](../../cli/internal/api/client.go) |
| UI | Axios `timeout: 30000` — same 30 s blanket limit | [ui/app/lib/apiClient.ts](../../ui/app/lib/apiClient.ts) |
| UI | Health check polls every 10 s regardless of tab visibility | [ui/app/context/ConnectionContext.tsx](../../ui/app/context/ConnectionContext.tsx) |
| UI | React Query refetch on mount for all queries, even static data | [ui/app/lib/queryClient.ts](../../ui/app/lib/queryClient.ts) |

---

## 2. Current State

### .NET API — SignalR
```csharp
options.ClientTimeoutInterval  = TimeSpan.FromSeconds(60);
options.KeepAliveInterval      = TimeSpan.FromSeconds(30);
options.MaximumReceiveMessageSize = 102400; // 100 KB
```
- Keep-alive every 30 s is standard but generous for local LAN usage.
- `ClientTimeoutInterval` at 60 s means after 60 s of silence, the server drops the client. For a terminal session where the user is just watching, this is fine — but for a logs stream that goes quiet (idle process), the connection could be dropped unnecessarily.

### .NET API — Request Timeout Middleware
- Applies a **single 30 s timeout to all HTTP requests**.
- Long operations (file upload, app import, binary deploy) will be killed at exactly 30 s.
- No per-route override mechanism exists.

### Go CLI — HTTP client
```go
httpClient: &http.Client{
    Timeout: timeout, // defaults to 30 s
},
```
- A single timeout governs connect + write + read + close.
- Large file uploads to `/api/upload` will fail.
- No keep-alive or transport tuning is configured — uses `http.DefaultTransport` implicitly.

### UI — Axios
```ts
timeout: 30000 // all requests
```
- Log-file download or large import requests will abort at 30 s.
- No per-request timeout override is wired in.

### UI — React Query polling
- `AppStatusContext`: refetchInterval = 10 s when authenticated.
- `ConnectionContext`: health check every 10 s.
- `constants.ts`: pollInterval = 30 s, refetchInterval = 10 s.
- These fire even when no services are running, burning idle CPU and network.

### UI — SignalR reconnect
```ts
.withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
```
- Good exponential back-off pattern. After 30 s it stops auto-reconnecting (SignalR default).

---

## 3. Ideas

### Idea A — Per-Route Timeout Policy (API)

Instead of a blanket 30 s timeout, classify routes:

| Route Category | Example Routes | Suggested Timeout |
|----------------|---------------|-------------------|
| Fast CRUD | `GET /api/apps`, `POST /api/apps` | 15 s |
| Long operations | `POST /api/apps/{id}/start`, `/stop` | 120 s |
| Streaming | `GET /api/apps/{id}/logs` (SSE), SignalR | No timeout (CancellationToken only) |
| File upload/import | `POST /api/upload`, `POST /api/apps/import` | 300 s |
| Terminal | `/terminalhub` WebSocket | No timeout |

**Implementation**: Use ASP.NET Core 8's built-in `RequestTimeouts` middleware (replaces custom middleware) with named policies:
```csharp
// Program.cs
builder.Services.AddRequestTimeouts(opts => {
    opts.DefaultPolicy = new RequestTimeoutPolicy { Timeout = TimeSpan.FromSeconds(15) };
    opts.AddPolicy("LongRunning", TimeSpan.FromSeconds(120));
    opts.AddPolicy("FileUpload",  TimeSpan.FromSeconds(300));
});

// On controllers/actions:
[RequestTimeout("LongRunning")]
public async Task<IActionResult> StartApp(...)
```

**Pros**: Clean, declarative, no custom middleware needed, ASP.NET 8 built-in.
**Cons**: Requires annotating each action (effort), must ensure streaming routes are excluded.

---

### Idea B — HTTP Transport Tuning in Go CLI

Configure `http.Transport` explicitly for connection pooling and keep-alive:

```go
transport := &http.Transport{
    DialContext: (&net.Dialer{
        Timeout:   5 * time.Second,
        KeepAlive: 30 * time.Second,
    }).DialContext,
    MaxIdleConns:        10,
    MaxIdleConnsPerHost: 5,
    IdleConnTimeout:     90 * time.Second,
    TLSHandshakeTimeout: 5 * time.Second,
    DisableCompression:  false, // enable gzip
}
```

**Then split the timeout** into connect timeout (transport-level) vs. request timeout (per-call context):

```go
// For uploads: no client-level timeout; pass context with deadline instead
ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
defer cancel()
req, _ = http.NewRequestWithContext(ctx, "POST", url, body)
```

**Pros**: Zero breaking changes, massive improvement for file uploads, proper connection reuse.
**Cons**: Minor increase in code complexity.

---

### Idea C — Adaptive Keep-Alive on SignalR (API)

For local LAN usage, the current 30 s keep-alive is unnecessarily chatty. For remote/VPN use, it may be too sparse.

Options:
1. **Reduce KeepAliveInterval to 15 s** for better reliability on flaky Wi-Fi.
2. **Increase ClientTimeoutInterval to 120 s** to tolerate network hiccups without dropping idle log streams.
3. **Environment-aware config**: read intervals from `appsettings.json` so admins can tune.

```json
// appsettings.json
"SignalR": {
    "KeepAliveIntervalSeconds": 15,
    "ClientTimeoutIntervalSeconds": 120,
    "MaxReceiveMessageSizeBytes": 262144
}
```

**Pros**: Resilience for idle log streams, no dropped terminal sessions on slow networks.
**Cons**: Slightly higher heartbeat traffic.

---

### Idea D — Adaptive Polling with Visibility API (UI)

Currently health-checks and status-polls fire every 10 s regardless of tab state. Use the browser **Page Visibility API** and **online/offline events** to reduce idle traffic:

```ts
// Pause polling when tab is hidden
refetchInterval: () => {
    if (document.visibilityState === 'hidden') return false;
    return isBackendConnected ? 10_000 : false;
}
```

Additionally, **exponential back-off for health checks** when disconnected:
```ts
const BACKOFF = [5, 10, 15, 30, 60]; // seconds
// After each failed check, advance the index
```

**Pros**: ~0 network traffic when tab is in background. Better battery life on laptops.
**Cons**: Small implementation effort, must ensure reconnection still happens on tab focus.

---

### Idea E — Response Compression (API + UI)

Enable gzip / Brotli on the API for REST responses. Log data, JSON arrays, and status payloads compress extremely well (70–90% reduction).

```csharp
// Program.cs
builder.Services.AddResponseCompression(opts => {
    opts.EnableForHttps = true;
    opts.Providers.Add<BrotliCompressionProvider>();
    opts.Providers.Add<GzipCompressionProvider>();
    opts.MimeTypes = ResponseCompressionDefaults.MimeTypes
        .Concat(["application/json"]);
});

builder.Services.Configure<BrotliCompressionProviderOptions>(o => 
    o.Level = CompressionLevel.Fastest);
```

Axios automatically decompresses gzip. No UI changes needed.

**Pros**: Significant bandwidth reduction, especially for log payloads.
**Cons**: Small CPU cost on server for compression. Must **exclude** already-streaming SSE/WebSocket routes.

---

### Idea F — Server-Sent Events (SSE) for Log Streaming (API + UI)

Currently logs flow over SignalR (WebSocket). For one-directional data (logs), **SSE is simpler, more efficient, and naturally keeps the connection alive**:

```csharp
[HttpGet("{id}/logs/stream")]
public async Task StreamLogs(string id, CancellationToken ct) {
    Response.Headers["Content-Type"] = "text/event-stream";
    Response.Headers["Cache-Control"] = "no-cache";
    Response.Headers["X-Accel-Buffering"] = "no"; // nginx
    
    await foreach (var line in logService.ReadLogsAsync(id, ct)) {
        await Response.WriteAsync($"data: {line}\n\n", ct);
        await Response.Body.FlushAsync(ct);
    }
}
```

**Pros**: HTTP/1.1 compatible, no WebSocket upgrade, automatic reconnect by browser, no SignalR overhead for read-only data.
**Cons**: Can't push from server if tab reconnects without re-request; browser limits 6 concurrent SSE connections (mitigated by HTTP/2 multiplexing).

---

### Idea G — HTTP/2 Enablement (API)

ASP.NET Core's Kestrel supports HTTP/2 out of the box over TLS. If MiniCluster runs on localhost with a dev cert, enabling HTTP/2 provides:
- **Connection multiplexing** — hundreds of concurrent streams on one TCP connection.
- **Header compression (HPACK)** — saves repeated auth headers on polling.
- **Server push** (limited but useful for initial data).

```json
// appsettings.json
"Kestrel": {
    "EndpointDefaults": {
        "Protocols": "Http1AndHttp2"
    }
}
```

**Pros**: Free bandwidth savings, better for multiplexed polling + SignalR.
**Cons**: Requires HTTPS (dev cert must be trusted). SignalR falls back to HTTP/1.1 if HTTP/2 isn't supported.

---

### Idea H — Connection Pooling-Aware API Client (UI)

Axios default config creates **no explicit connection limit**. During an initial page load, the UI fires many parallel queries (apps list, statuses, system info) all at once. For HTTP/1.1, browsers limit to 6 concurrent connections per host.

Strategy: **Request waterfall** with React Query priority:
1. **Critical** (auth, user info) — fire immediately.
2. **Above fold** (app list) — fire after auth.
3. **Background** (system metrics, historical logs) — defer with `enabled: false` until critical is complete.

This isn't a network-level change but reduces perceived latency significantly.

---

### Idea I — CLI Long-Operation Streaming with Progress (CLI)

For long operations (app deploy, file upload), switch from a single blocking HTTP call to **chunked upload with progress reporting**:

```go
// Stream upload with progress bar
pr := &ProgressReader{reader: file, total: fileSize, bar: progressBar}
req, _ := http.NewRequestWithContext(ctx, "POST", url, pr)
req.Header.Set("Transfer-Encoding", "chunked")
req.ContentLength = fileSize
```

The server should respond with progress events (SSE or chunked response) so the CLI can show live feedback and the connection stays alive throughout.

---

### Idea J — Idle Connection Detection & Graceful Teardown (Terminal Hub)

The `TerminalHub` keeps WebSocket connections open indefinitely. If the browser tab crashes or the user closes it without properly leaving, the terminal session leaks until `ClientTimeoutInterval` (60 s) expires.

Improvement: Track last-activity timestamp per terminal session. A background task sweeps for sessions older than a configurable idle threshold (default: 5 min) and terminates them.

```csharp
// TerminalCleanupService.cs (BackgroundService)
foreach (var session in _terminalService.GetSessions()) {
    if (session.LastActivity < DateTime.UtcNow - _idleThreshold) {
        await _terminalService.TerminateAsync(session.Id);
    }
}
```

---

## 4. Challenges & Risks

| Risk | Details | Mitigation |
|------|---------|-----------|
| Timeout too short for slow environments | 30 s will fail large imports on slow disks | Per-route timeouts (Idea A) |
| SignalR dropped on idle log stream | 60 s client timeout triggers for quiet processes | Increase to 120 s (Idea C) |
| HTTP/2 + SignalR interaction | SignalR prefers WebSocket; HTTP/2 may cause transport negotiation issues | Test with `Protocols: Http1AndHttp2`, fall back gracefully |
| Response compression on streaming | Gzip + streaming is incompatible (must buffer) | Exclude SSE/streaming routes from compression |
| Browser SSE limit (6 connections) | Multiple log tabs exhaust HTTP/1.1 connection budget | Enable HTTP/2 (Idea G) + SSE (Idea F) together |
| Go `http.Transport` tuning | Wrong `MaxIdleConnsPerHost` causes connection exhaustion on large parallelism | Start conservative: `MaxIdleConnsPerHost = 5` |
| Visibility API cross-browser | IE / older browsers lack Visibility API | Already N/A for modern React apps; safe |

---

## 5. Ranked Recommendations

| Rank | Idea | Impact | Effort | Priority |
|------|------|--------|--------|----------|
| 1 | **A — Per-Route Timeout Policy** | High — fixes upload/start aborts | Medium | Do first |
| 2 | **B — Go CLI Transport Tuning** | High — fixes large upload failures | Low | Do first |
| 3 | **C — Adaptive SignalR Intervals** | High — prevents dropped log/terminal sessions | Low | Do first |
| 4 | **E — Response Compression** | Medium — bandwidth -70% on JSON | Low | Quick win |
| 5 | **D — Adaptive Polling (Visibility API)** | Medium — idle CPU/network reduction | Low | Quick win |
| 6 | **J — Idle Terminal Cleanup** | Medium — prevents resource leaks | Medium | Do next |
| 7 | **G — HTTP/2** | Medium — free multiplexing | Low (config only) | Do next |
| 8 | **H — Request Waterfall (UI)** | Medium — perceived perf | Medium | Do next |
| 9 | **F — SSE for Logs** | High — but architectural change | High | Phase 2 |
| 10 | **I — CLI Streaming Upload** | Medium — UX improvement | High | Phase 2 |

---

## 6. Next Steps / Phase Plan

### Phase 1 — Low-Hanging Fruit (1–2 days)

1. **CLI Transport Tuning** (Idea B): Edit `cli/internal/api/client.go` — add explicit `http.Transport` with keep-alive and per-operation context deadlines. No breaking changes.

2. **SignalR Interval Config** (Idea C): Read `KeepAliveInterval` and `ClientTimeoutInterval` from `appsettings.json`. Raise `ClientTimeoutInterval` to 120 s. Reduce `KeepAliveInterval` to 15 s.

3. **Response Compression** (Idea E): Four lines in `Program.cs`, zero UI changes.

4. **Adaptive Polling** (Idea D): Add `document.visibilityState` check to React Query `refetchInterval` callbacks in `queryClient.ts` and `AppStatusContext.tsx`.

### Phase 2 — Structural Improvements (3–5 days)

5. **Per-Route Timeout Policy** (Idea A): Replace `RequestTimeoutMiddleware` with ASP.NET 8's `AddRequestTimeouts`. Annotate controllers.

6. **Idle Terminal Cleanup** (Idea J): New `BackgroundService` in the API.

7. **HTTP/2** (Idea G): Single `appsettings.json` entry if TLS is available.

### Phase 3 — Architecture Evolution (1–2 weeks)

8. **SSE Log Streaming** (Idea F): Separate SSE endpoint for log tailing; keep SignalR for bidirectional (terminal, status push).

9. **CLI Progress Upload** (Idea I): Streaming upload with progress bar.

---

## 7. Critical Assessment

Things that **sound good but need careful evaluation**:

- **HTTP/2 on localhost**: Kestrel supports it, but the .NET dev cert must be trusted by the browser AND the Go CLI. Go's `http.Client` will need TLS cert pinning or skip-verify configured — which is a security trade-off for local dev.

- **SSE vs. SignalR for logs**: SSE is simpler for logs but **requires a separate connection per log stream**. If many services are running, `n × streams` = `n` open TCP connections. With HTTP/2 multiplexing this is fine; without it, we hit browser connection limits. Don't migrate to SSE until HTTP/2 is confirmed.

- **Raising ClientTimeoutInterval too high**: Setting it to e.g. 5 min means zombie connections from crashed browsers hold server resources for 5 min. 120 s is a reasonable compromise.

- **Response compression on .NET 8**: The built-in `ResponseCompressionMiddleware` can't compress streams that don't have `Content-Length`. This is correct — streaming responses (SSE, chunked) must be excluded explicitly via `opts.ExcludedMimeTypes` or middleware ordering.

---

---

## 8. Deep Dive — "Lost Connection" on the Frontend (Reported Issue)

### Root Cause Analysis

Three independent mechanisms can trigger "lost connection" in the UI, and they interact badly:

```
SignalRConnectionContext  ──►  withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
                               ─── after ~47 s of failed reconnects ──► onclose() fires
                               onclose just sets isConnected = false
                               *** NO FURTHER RECONNECTION EVER ATTEMPTED ***
                               *** PAGE REFRESH IS THE ONLY RECOVERY ***

ConnectionContext         ──►  setInterval(checkHealth, 10 000 ms)
                               One failed HTTP call ──► status = "disconnected"
                               cancels ALL in-flight queries
                               (even a momentary 10 s API hiccup = full disconnect event)

SignalR server side       ──►  ClientTimeoutInterval = 60 s
                               If client misses one keep-alive ping cycle (~30 s)
                               under packet loss, server drops the socket
```

### The Three Bugs

#### Bug 1 — SignalR never retries after `onclose`

```ts
// SignalRConnectionContext.tsx — current behavior
connection.onclose(() => {
  setIsConnected(false);  // ← dead end. No reconnect scheduled.
});
```

`withAutomaticReconnect([0, 2000, 5000, 10000, 30000])` means:
- Attempt 1: immediately
- Attempt 2: 2 s
- Attempt 3: 5 s
- Attempt 4: 10 s
- Attempt 5: 30 s
- **After attempt 5 fails → `onclose` fires → connection is permanently dead.**

**Fix A**: Implement a custom `InfiniteRetryPolicy` that keeps retrying with a cap (e.g., every 60 s forever):

```ts
// Option 1 — custom reconnect policy
.withAutomaticReconnect({
  nextRetryDelayInMilliseconds: (ctx) => {
    // Cap at 60 s, retry indefinitely
    return Math.min(1000 * 2 ** ctx.previousRetryCount, 60_000);
  }
})

// Option 2 — manual restart in onclose
connection.onclose(async () => {
  setIsConnected(false);
  // Schedule a restart after 5 s
  setTimeout(() => restartConnection(), 5_000);
});
```

---

#### Bug 2 — One failed health check = full disconnect event

```ts
// ConnectionContext.tsx — current behavior
} catch (error) {
  const wasConnected = !wasDisconnectedRef.current;
  setStatus("disconnected");        // ← immediate
  setBackendConnectionStatus(false);
  wasDisconnectedRef.current = true;
  if (wasConnected) {
    queryClientRef.current.cancelQueries();  // ← all queries cancelled
    disconnectCallbacksRef.current.forEach(callback => callback());
  }
}
```

A single failed `/health` call (server briefly busy, OS scheduling, antivirus scan) triggers the full disconnect flow. This causes:
- Flickering "Lost connection" banners
- All React Query cache invalidated
- SignalR groups left

**Fix B**: Require **N consecutive failures** before declaring disconnect:

```ts
// Add a consecutive failure counter
const failureCountRef = useRef(0);
const DISCONNECT_THRESHOLD = 2; // 2 consecutive failures = ~20s

} catch (error) {
  failureCountRef.current++;
  if (failureCountRef.current >= DISCONNECT_THRESHOLD) {
    const wasConnected = !wasDisconnectedRef.current;
    setStatus("disconnected");
    setBackendConnectionStatus(false);
    wasDisconnectedRef.current = true;
    if (wasConnected) {
      queryClientRef.current.cancelQueries();
      disconnectCallbacksRef.current.forEach(callback => callback());
    }
  }
}

// Reset counter on success
} try {
  await serviceService.checkHealth();
  failureCountRef.current = 0; // reset on success
  ...
```

---

#### Bug 3 — SignalR server drops idle clients at 60 s

```csharp
// Program.cs
options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
options.KeepAliveInterval     = TimeSpan.FromSeconds(30);
```

The server pings the client every 30 s. The client must respond within 60 s — that's only a 2× margin. On a busy system or under any packet loss:
1. Server sends ping at T+0
2. Ping delayed by 5 s (OS scheduler / GC pause / network jitter)
3. Server sends next ping at T+30
4. If both are slow, client looks silent from T=0 to T=60 → server drops it

**Fix C** (server): Raise `ClientTimeoutInterval` to 120 s or make it config-driven:
```json
// appsettings.json
"SignalR": {
    "KeepAliveIntervalSeconds": 15,
    "ClientTimeoutIntervalSeconds": 120
}
```

**Fix C** (client): Align `withServerTimeout` to match:
```ts
.withServerTimeout(120_000)  // was 60_000
.withKeepAliveInterval(15_000)  // more frequent pings to server
```

---

### Quick Summary of Fixes

| Bug | File(s) | Fix | Effort |
|-----|---------|-----|--------|
| SignalR stops reconnecting after onclose | `SignalRConnectionContext.tsx` | Infinite retry policy or manual restart in `onclose` | 30 min |
| One health-check fail = full disconnect | `ConnectionContext.tsx` | Require 2 consecutive failures before declaring disconnect | 30 min |
| Server drops idle SignalR at 60 s | `Program.cs` + `SignalRConnectionContext.tsx` | Raise `ClientTimeoutInterval` to 120 s; lower `KeepAliveInterval` to 15 s | 15 min |

**All three fixes together should eliminate the "lost connection" banner for normal usage.** These are Phase 1 priorities.

---

### Bonus — UI Indicator Improvements

Even after fixes, transient blips may still occur. The UX around the disconnect banner matters:
- **Debounce the banner**: don't show it until disconnect persists for 3+ seconds.
- **Show reconnecting state** separately from "disconnected" — `onreconnecting` fires well before `onclose`.
- **Silent background reconnect**: if `onreconnected` fires within 5 s, never show a banner at all.

---

## 9. Full Audit — Every Network Issue Found in the Codebase

Beyond the three "lost connection" root causes, a thorough audit uncovered **11 additional issues** ranging from critical to low.

---

### Issue 4 — CRITICAL: Zero Tab Visibility Optimization (Every Poll Runs in Background)

**No component in the entire UI checks `document.visibilityState`.** All intervals fire whether the tab is active or minimized.

Combined idle-tab traffic:

| Source | File | Interval | Notes |
|--------|------|----------|-------|
| Health check | [ConnectionContext.tsx](../../ui/app/context/ConnectionContext.tsx) | 10 s | Always on |
| Status batch | [AppStatusContext.tsx](../../ui/app/context/AppStatusContext.tsx) | 10 s | Always on when auth'd |
| Live metrics (home) | [home.tsx](../../ui/app/routes/home.tsx) | 5 s | Only on home route |
| Task manager data | [TaskManager.tsx](../../ui/app/components/TaskManager.tsx) | 5 s | Only on task view |
| Task manager processes | [TaskManager.tsx](../../ui/app/components/TaskManager.tsx) | 5 s | When "all-processes" |
| System metrics history | [useSystemMetricsHistory.ts](../../ui/app/hooks/useSystemMetricsHistory.ts) | **2 s** | Most aggressive |
| Process metrics fallback | [ProcessMetrics.tsx](../../ui/app/components/ProcessMetrics.tsx) | 30 s | Even with SignalR |

**Worst case (task manager + metrics open)**: ~7 HTTP requests every 5 seconds = **84 requests/min in a hidden tab**.

**Fix**: Centralized visibility hook:
```ts
function useIsTabVisible() {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const handler = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return visible;
}

// Usage in any polling hook:
const isVisible = useIsTabVisible();
refetchInterval: isVisible && isConnected ? 10_000 : false,
```

---

### Issue 5 — HIGH: Cache Invalidation Stampede on Reconnect

When `ConnectionContext` transitions from disconnected → connected, it fires:

```ts
queryClientRef.current.invalidateQueries({ queryKey: appQueryKeys.all }); // ["apps"]
queryClientRef.current.invalidateQueries({ queryKey: ["apps", "detail"] });
```

`["apps"]` matches **every** app-related query in the cache — details, statuses, metrics, environments, versions, trees. This triggers a burst of 10–30 simultaneous refetches, which hammers the API just as it's recovering.

**Other stampede sources found:**

| Trigger | File | Queries Invalidated |
|---------|------|---------------------|
| Reconnect | [ConnectionContext.tsx](../../ui/app/context/ConnectionContext.tsx) | `["apps"]` + `["apps", "detail"]` |
| Service action (start/stop) | [ServiceDetails.tsx](../../ui/app/components/ServiceDetails.tsx) | `["services", "statuses"]` + `["apps"]` |
| Environment update | [useEnvironmentQueries.ts](../../ui/app/hooks/useEnvironmentQueries.ts) | `env.all` + `env.active` |
| Tree move | [useTreeQueries.ts](../../ui/app/hooks/useTreeQueries.ts) | `tree` + `["appsWithStats"]` |
| Snapshot deploy | [useVersioningQueries.ts](../../ui/app/hooks/useVersioningQueries.ts) | `["appSnapshots"]` + `["serviceVersions"]` |

**Fix**: Stagger invalidations on reconnect:
```ts
// Reconnect: invalidate critical data first, defer the rest
queryClient.invalidateQueries({ queryKey: ["apps", "list"] }); // just the list
setTimeout(() => {
  queryClient.invalidateQueries({ queryKey: ["apps", "detail"] });
}, 1_000);
setTimeout(() => {
  queryClient.invalidateQueries({ queryKey: ["apps", "metrics"] });
}, 3_000);
```

---

### Issue 6 — MEDIUM: Token Refresh Queue Has No Size Limit

In [apiClient.ts](../../ui/app/lib/apiClient.ts), when a 401 triggers token refresh, all subsequent requests queue in `failedQueue`:

```ts
let failedQueue: Array<{ resolve, reject }> = []; // no limit
```

If the refresh token is slow (e.g., 10 s) and the app is polling every 2–5 s, dozens of requests pile up, all replayed simultaneously. Plus a **proactive refresh timer** every 28 min in `AuthContext.tsx` could race with the reactive 401-triggered refresh.

**Fix**: Cap queue at 20 requests; reject overflow with a clear error.

---

### Issue 7 — MEDIUM: SignalR StreamBufferCapacity = 10 (Very Low)

```csharp
options.StreamBufferCapacity = 10;
```

When a service outputs logs fast (e.g., a build tool printing hundreds of lines/sec), the server sends one SignalR message per line via `ServiceProcessManager`. With a buffer of only 10, bursts will hit backpressure — the server blocks on `SendAsync`, which blocks the stdout reader, which can block the managed process.

Compounding this: `MaximumReceiveMessageSize = 100 KB`. A single JSON log message with a long stack trace could approach this limit.

**Fix**: Raise `StreamBufferCapacity` to 50. Consider log batching (10 lines per message, 100ms window) to convert 1000 msg/s into 100 msg/s.

---

### Issue 8 — MEDIUM: Log Lines Sent Individually Over SignalR (No Batching)

In [ServiceProcessManager.cs](../../api/Innovatek.Parallel.MiniCluster.Api/Services/ServiceProcessManager.cs):

```csharp
// Each stdout line = one SignalR message
await _hub.Clients.Group(serviceId.ToString()).SendAsync("ReceiveLog", new {
    ServiceId = serviceId,
    Line = e.Data  // one line at a time
});
```

A process outputting 500 lines/s = 500 SignalR messages/s. The existing `LogBatchService` batches for **database writes**, but the real-time push to the UI is still unbatched.

**Fix**: Window-based batch (e.g., collect lines for 100ms, then send as array):
```csharp
// SignalR log batch: one message with 50 lines vs. 50 messages with 1 line
await _hub.Clients.Group(groupId).SendAsync("ReceiveLogs", batchedLines);
```

---

### Issue 9 — MEDIUM: Vite Dev Proxy Has No Timeout Config

In [vite.config.ts](../../ui/vite.config.ts):
```ts
proxy: {
  '/api': { target: 'http://127.0.0.1:5147', changeOrigin: true, secure: false },
  '/loghub': { target: 'http://127.0.0.1:5147', ws: true, ... },
  '/terminalhub': { target: 'http://127.0.0.1:5147', ws: true, ... },
}
```

No `timeout` or `proxyTimeout` configured. Vite's http-proxy defaults to **no timeout** for WebSocket but a silent 120 s timeout for HTTP, which doesn't match the 30 s Axios timeout. This can cause confusing behavior during development: Axios times out at 30 s, but the proxy keeps the upstream connection open for another 90 s.

**Fix**: Align proxy timeout with API request timeout:
```ts
'/api': { target: '...', timeout: 120_000, proxyTimeout: 120_000 },
```

---

### Issue 10 — MEDIUM: Task Manager Has Dual Overlapping Intervals

In [TaskManager.tsx](../../ui/app/components/TaskManager.tsx):
```ts
// Interval 1: fetch main data
const interval = setInterval(fetchData, 5000);

// Interval 2: when "all-processes" view active
const interval = setInterval(fetchSystemProcesses, 5000);
```

When the user switches to "all-processes" view, **both** intervals fire in parallel every 5 s = 2 API calls every 5 s just for the task manager. Neither pauses when the tab is hidden.

**Fix**: Combine into a single fetch; gate on visibility.

---

### Issue 11 — LOW: System Metrics History Polls Every 2 Seconds

In [useSystemMetricsHistory.ts](../../ui/app/hooks/useSystemMetricsHistory.ts):
```ts
const POLL_INTERVAL_MS = 2000;
```

This is the most aggressive poll in the entire codebase. For historical metrics that don't change second-by-second, 5–10 s would be more than sufficient.

---

### Issue 12 — LOW: ProcessMetrics Falls Back to 30 s Poll Despite SignalR

In [ProcessMetrics.tsx](../../ui/app/components/ProcessMetrics.tsx):
```ts
const interval = setInterval(() => { fetchData(); }, 30000);
```

This runs **alongside** the SignalR real-time stream as a failsafe. If SignalR is working, the poll is wasted. If it's not working, the poll masks a broken real-time connection.

**Fix**: Only poll when SignalR is disconnected:
```ts
const { isConnected } = useSignalRConnection();
refetchInterval: isConnected ? false : 30_000,
```

---

### Issue 13 — LOW: Axios Timeout for File Operations

The blanket `timeout: 30000` in `apiClient` affects all requests equally. File uploads, app imports, and binary deployments can easily exceed 30 s on slow storage.

**Fix**: Override timeout per-request:
```ts
apiClient.post('/api/upload', formData, { timeout: 300_000 });
```

---

### Issue 14 — LOW: Health Endpoint Implementation Unknown

The health check in `ConnectionContext` calls `serviceService.checkHealth()` every 10 s. If the health endpoint hits the database or runs diagnostics, that's 6 DB calls per minute just for the health check — plus the tab-visibility issue multiplies this across open tabs.

**Fix**: Ensure the health endpoint is a bare-minimum in-memory check (return 200 if the server process is alive, no DB hit).

---

## 10. Consolidated Priority Matrix

| # | Issue | Category | Impact | Effort | Phase |
|---|-------|----------|--------|--------|-------|
| 1 | SignalR dies permanently after `onclose` | Connection | 🔴 Critical | Low | **1** |
| 2 | One health-check fail = full disconnect | Connection | 🔴 Critical | Low | **1** |
| 3 | Server drops idle SignalR at 60 s | Connection | 🔴 High | Low | **1** |
| 4 | Zero tab visibility optimization | Polling | 🔴 Critical | Medium | **1** |
| 5 | Cache invalidation stampede on reconnect | Performance | 🟠 High | Medium | **1** |
| 6 | Token refresh queue unbounded | Reliability | 🟠 Medium | Low | **1** |
| 7 | SignalR `StreamBufferCapacity` = 10 | Backpressure | 🟠 Medium | Low | **1** |
| 8 | Log lines sent individually (no batch) | Performance | 🟠 Medium | Medium | **2** |
| 9 | Vite proxy timeout mismatch | Dev experience | 🟡 Low | Low | **1** |
| 10 | Task Manager dual intervals | Polling | 🟡 Medium | Low | **1** |
| 11 | System metrics 2 s poll | Polling | 🟡 Low | Low | **1** |
| 12 | ProcessMetrics fallback poll alongside SignalR | Polling | 🟡 Low | Low | **1** |
| 13 | Axios blanket 30 s timeout | Reliability | 🟡 Low | Low | **2** |
| 14 | Health endpoint unknown weight | Performance | 🟡 Low | Low | **1** |

---

## 11. Revised Phase Plan

### Phase 1 — Connection Stability + Polling Reduction

**Goal**: Eliminate "lost connection" flicker and reduce idle network traffic by 80%.

1. **SignalR infinite retry** — Replace fixed retry array with exponential-backoff-forever policy in `SignalRConnectionContext.tsx`
2. **Consecutive failure threshold** — Require 2+ health-check failures before declaring disconnect in `ConnectionContext.tsx`
3. **SignalR intervals** — Set `ClientTimeoutInterval` to 120 s, `KeepAliveInterval` to 15 s in `Program.cs`; match on client
4. **Tab visibility hook** — Create `useIsTabVisible()` hook; wire into all polling intervals
5. **Raise StreamBufferCapacity** — Increase from 10 to 50 in `Program.cs`
6. **Cap token refresh queue** — Max 20 pending requests in `apiClient.ts`
7. **System metrics poll 2 s → 5 s** — Simple constant change
8. **Task Manager unify intervals** — Merge into one `setInterval`
9. **ProcessMetrics conditional poll** — Only fallback-poll when SignalR is disconnected
10. **Stagger reconnect invalidations** — Don't invalidate everything at once

### Phase 2 — Throughput & Reliability

11. **Log batching for SignalR push** — 100ms window, batch into single message
12. **Per-route timeout policy (.NET)** — Replace custom middleware with `AddRequestTimeouts`
13. **Axios per-request timeout** — Override for file uploads/imports
14. **Vite proxy timeout alignment** — Add explicit timeout to proxy config
15. **Verify health endpoint weight** — Ensure it's in-memory only

### Phase 3 — Architecture

16. **Response compression (gzip/Brotli)** on API
17. **Go CLI transport tuning** — Explicit `http.Transport` with keep-alive
18. **HTTP/2 on Kestrel**

---

## 9. References

- [ASP.NET Core Request Timeouts (8.0)](https://learn.microsoft.com/en-us/aspnet/core/performance/timeouts)
- [Go net/http Transport](https://pkg.go.dev/net/http#Transport)
- [SignalR configuration options](https://learn.microsoft.com/en-us/aspnet/core/signalr/configuration)
- [Page Visibility API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [Response Compression in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/performance/response-compression)
- [Existing resilience work](../../api/RESILIENCE_IMPROVEMENTS.md)
- [API changes log](../../api/API_CHANGES.md)
