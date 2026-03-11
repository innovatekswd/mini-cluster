# 002 — Enhanced Dashboard, Session-Aware Diagrams & Log Sessions

> Created: 2026-03-11
> Status: Active
> Topic: Redesign dashboard charts to be session-aware, build a full log session explorer with search, and ensure zero-loss log capture from process start

---

## 1. Context & Problem Statement

MiniCluster's dashboard and log system have solid foundations — sessions exist in the database, logs are batched and persisted, real-time streaming works via SignalR. But the **UI doesn't surface most of this**:

- **Dashboard charts lose state** on navigation — they reload from the last 6 minutes only.
- **Charts aren't session-aware** — they show raw time-series data with no concept of "this service ran from 10:05 to 10:47".
- **Logs are split between live and DB** with no unified session-scoped view.
- **Log capture can miss early output** — there's a race between process start and SignalR client joining the group.
- **No session browser** in the UI despite a full `SessionsController` API.
- **No full-text search** across sessions — only the most recent session is queried.

The backend already has: `ServiceSession` (start/end/exitCode), `SessionLogEntry` (timestamp/type/line), and API endpoints for listing/querying sessions. The frontend just doesn't use any of it.

---

## 2. Current State

### Dashboard ([home.tsx](../../ui/app/routes/home.tsx))

| Component | Data Source | Persistence | Gaps |
|-----------|------------|-------------|------|
| 6 stat cards (CPU, Mem, Disk, Net, Apps, Procs) | `useSystemMetricsHistory` | In-memory only | Lost on nav |
| CPU+Memory area chart | Same hook, 60 points | In-memory | No session markers |
| Network throughput chart | Same hook | In-memory | No session markers |
| Service status donut | `useAppsWithStatsQuery` | React Query cache | Only current state |
| Disk bars | System metrics snapshot | In-memory | No historical |
| Top memory/CPU consumers | `metricsService.getLiveMetrics()` | In-memory, 5s poll | No comparison to session baseline |

### Metrics History ([useSystemMetricsHistory.ts](../../ui/app/hooks/useSystemMetricsHistory.ts))

- Loads last 6 min on mount, polls every 5s
- Max 60 data points in-memory arrays
- **No session concept** — can't overlay "Service X was running here" on a system chart
- Backend has `/api/metrics/system/history` but no session-correlated endpoint

### Log System

| Layer | What works | What's missing |
|-------|-----------|----------------|
| **Capture** (ServiceProcessManager) | stdout/stderr → SignalR + LogBatchService | Race: client may miss first lines before joining group |
| **Storage** (LogBatchService → SessionLogs) | Batched writes, 50/2s | No full-text index, no log levels parsed |
| **Sessions API** (SessionsController) | List sessions, get session, get session logs | Not called from UI at all |
| **Real-time** (SignalR ReceiveLog) | Per-line push to service group | Unbatched (500 msg/s possible) |
| **LogContext** (React state) | Stores `Record<serviceId, string[]>` | No session awareness, no timestamps stored, unbounded growth |
| **LogViewer** (Monaco editor) | Live + DB search modes | Searches most recent session only, no session picker |

### Session Model (backend)

```
ServiceSession {
  SessionId: Guid (PK)
  ServiceId: Guid
  StartTimestamp: DateTime
  EndTimestamp: DateTime?
  ExitReason: string?     // "process" | "manual"
  ExitCode: int?
  AutoStart: bool
  WorkingDirectory: string?
  CommandLineArguments: string?
  EnvironmentSnapshot: string?  // JSON
  LogEntries: ICollection<SessionLogEntry>
}

SessionLogEntry {
  Id: Guid (PK)
  SessionId: Guid (FK)
  Timestamp: DateTime
  LogType: string          // "stdout" | "stderr" | "info"
  Line: string
}
```

**This model is excellent and already supports everything we need.** The work is 90% frontend.

---

## 3. Ideas

### Idea A — Session Timeline on Dashboard Charts

Overlay service session start/stop markers on the system-level charts (CPU, memory, network).

```
  CPU %  ▼                   ▂▃▅▇██▇▅▃▂
  100 ┤                     ╱            ╲
   75 ┤              ▃▅▇██▇╯              ╲
   50 ┤     ▂▃▅▅▃▂╱                        ╲▂
   25 ┤   ╱                                    ▂
    0 ┤──╱──────────────────────────────────────────
      ╰──┴───────┴──────────────┴───────────┴──────►
         10:00    10:15         10:30       10:45

      ■──── api-gateway ────■                      session bars
                ■──── worker-1 ──────────────■
                           ■─ db-migrate ─■ ✗ (exit 1)
```

**Data flow**: Fetch sessions via `GET /api/services/{id}/sessions` for all running/recent services. Map `startTimestamp`/`endTimestamp` onto the chart's X axis. Use recharts' `ReferenceArea` or custom SVG overlay.

**Pros**: Instantly correlates CPU spikes with which service was running. 
**Cons**: Dense if many services; need filtering.

---

### Idea B — Session-Scoped Process Metrics

Instead of "last 15 minutes", let the user pick a **session** to view its metrics:

```
┌─────────────────────────────────────────────────────┐
│  Process Metrics: api-gateway                       │
│  Session: ● 2026-03-11 10:05 → 10:47 (42m) exit 0  │
│           ○ 2026-03-11 09:12 → 09:58 (46m) exit 1  │
│           ○ 2026-03-10 22:00 → 08:15 (10h) exit 0  │
│                                                     │
│  [CPU ▓▓▓▓▓░░░  35%]  [Mem ▓▓▓▓▓▓░  182MB]       │
│  ┌───────────────────────────────────────────────┐  │
│  │  ▃▅▆▅▃▂▃▅▇▇▆▅▃▂▁▁▁▂▃▅▆▇▊▊▇▅▃               │  │
│  │  Memory over Session Duration                  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**API**: `GET /api/metrics/{serviceId}/history?from={session.start}&to={session.end}`

**Pros**: Meaningful time ranges instead of arbitrary "last 15m". Can compare sessions.
**Cons**: Needs UI for session picker dropdown.

---

### Idea C — Zero-Loss Log Capture (Backend Fix)

**The Race Condition**: When Service X starts, `ServiceProcessManager` creates the process and begins reading stdout. The first lines are pushed to SignalR group `X`. But the client may not have joined group `X` yet (still establishing connection or hasn't navigated to that service).

**Fix — Replay from session start:**

The backend already stores every line in `SessionLogs` via `LogBatchService`. The fix is a **replay mechanism**:

1. When client joins a service group, server sends the current `SessionId`.
2. Client requests: `GET /api/services/{id}/sessions/{sessionId}/logs?from={joinTimestamp}`
3. Client merges DB logs with real-time stream, deduplicating by timestamp+line.

**Alternative (simpler):** On `JoinAppGroup`, the server immediately replays the last N lines from the current session's in-memory buffer:

```csharp
// LogHub.cs
public async Task JoinAppGroup(string appId)
{
    await Groups.AddToGroupAsync(Context.ConnectionId, appId);
    
    // Replay buffered session logs so client doesn't miss early output
    var recentLogs = _logBufferService.GetRecentLogs(appId, count: 200);
    if (recentLogs.Any())
    {
        await Clients.Caller.SendAsync("ReplayLogs", recentLogs);
    }
}
```

This requires a small in-memory ring buffer per service (last 500 lines) that the `LogBatchService` also feeds.

**Pros**: Zero missed logs, even if client connects 30s after process start.
**Cons**: Small memory overhead per active service (~500 lines ≈ 50KB).

---

### Idea D — Log Session Explorer (New UI Component)

A dedicated panel (or tab in the service detail view) for browsing and searching log sessions:

```
┌──────────────────────────────────────────────────────────────┐
│  📋 Log Sessions — api-gateway                               │
├──────────────────────────────────────────────────────────────┤
│  🔍 Search across all sessions: [___________________] [🔎]  │
│  Filter: [All ▾] [stdout ▾] [Last 7 days ▾]                 │
├──────────────────────────────────────────────────────────────┤
│  SESSION LIST                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ● Session #47  2026-03-11 10:05 → 10:47               │  │
│  │   Duration: 42m 15s  •  Exit: 0  •  Lines: 12,847    │  │
│  │   Command: dotnet run --urls http://0.0.0.0:5147      │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ ✗ Session #46  2026-03-11 09:12 → 09:58               │  │
│  │   Duration: 46m 02s  •  Exit: 1  •  Lines: 8,231     │  │
│  │   Command: dotnet run --urls http://0.0.0.0:5147      │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  SESSION #47 — LOGS                                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 10:05:01.234 [OUT] info: Microsoft.Hosting[14]        │  │
│  │ 10:05:01.235 [OUT]   Now listening on: http://0.0.0.0 │  │
│  │ 10:05:01.236 [OUT]   Application started.             │  │
│  │ 10:05:02.104 [ERR]   warn: Connection refused to DB   │  │ ◄ stderr highlighted
│  │ ...                                                    │  │
│  │ 10:47:12.001 [OUT]   Application is shutting down.    │  │
│  └────────────────────────────────────────────────────────┘  │
│  Page 1 of 26  [◀ Prev] [Next ▶]  12,847 lines total        │
└──────────────────────────────────────────────────────────────┘
```

**Features**:
- List all sessions for a service (from `GET /api/services/{id}/sessions`)
- Click a session → load its logs paginated (`GET /api/services/{id}/sessions/{sessionId}/logs`)
- Full-text search across ALL sessions or within one session
- Filter by stdout/stderr
- Date range picker
- Jump to first error (stderr) in session
- Session metadata: duration, exit code, command, working directory, env snapshot
- Compare two sessions side-by-side (stretch goal)

---

### Idea E — Unified LogContext with Session Awareness

Rewrite `LogContext` to store structured log entries instead of raw strings:

```typescript
interface LogEntry {
  timestamp: string;
  type: "stdout" | "stderr" | "info";
  line: string;
  sessionId: string;
}

interface LogState {
  entries: LogEntry[];      // all entries for this service
  currentSessionId: string; // active session
  sessions: SessionInfo[];  // cached session list
}

// Store: Record<serviceId, LogState>
```

**Benefits**:
- Can filter by session in the live view
- Can highlight stderr distinctly
- Can show "Session started" / "Session ended" markers in the log stream
- Survives navigation (if stored in a global context or React Query)

---

### Idea F — Enhanced Dashboard Layout

Reorganize the dashboard into three tiers:

```
┌──────────────────────────────────────────────────────────────┐
│  TIER 1: SYSTEM HEALTH (always visible)                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ CPU  │ │ Mem  │ │ Disk │ │ Net  │ │ Apps │ │ Procs│    │
│  │ 23%  │ │ 4.2G │ │ 67%  │ │ 12M  │ │ 3/5  │ │  47  │    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
├──────────────────────────────────────────────────────────────┤
│  TIER 2: SESSION TIMELINE (new)                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Time ──────10:00──────10:15──────10:30──────10:45───► │  │
│  │ gateway  ■████████████████████████████████■            │  │
│  │ worker   ·····■████████████████████████████████■       │  │
│  │ migrate  ···········■████■✗                            │  │
│  │ redis    ■████████████████████████████████████████■    │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  TIER 3: DETAILED CHARTS (2-column)                          │
│  ┌───────────────────────┐  ┌───────────────────────────┐   │
│  │  CPU + Session Overlay │  │  Memory + Session Overlay │   │
│  │  ▅▇███▇▅▃▂▃▅▇██▇▅▃▂  │  │  ▃▅▆▇▇▆▅▃▂▃▅▆▇████▇▅   │   │
│  │  ■─gw──■  ■wkr────■  │  │  ■─gw──■  ■wkr────■      │   │
│  └───────────────────────┘  └───────────────────────────┘   │
│  ┌───────────────────────┐  ┌───────────────────────────┐   │
│  │  Network I/O           │  │  Active Sessions Feed     │   │
│  │  ▃▅▆▅▃▂▃▅▇▇▆▅         │  │  10:45 worker exit 0     │   │
│  │                        │  │  10:30 migrate exit 1 ✗   │   │
│  │                        │  │  10:05 gateway started    │   │
│  └───────────────────────┘  └───────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**New components**:
1. **Session Timeline** — Gantt-style horizontal bars showing when each service was running. Click a bar → navigate to that session's logs/metrics.
2. **Active Sessions Feed** — Real-time event log of session starts/stops/crashes (like a commit log for your cluster).
3. **Session-overlaid charts** — Existing CPU/Mem charts with colored bands showing active service sessions.

---

### Idea G — Cross-Session Log Search

Extend the `LogsController` to support searching across ALL sessions:

```
GET /api/services/{id}/logs/search?query=error&sessionId=all&from=2026-03-10&to=2026-03-11
```

**Backend changes**:
- Current search filters by most recent session → add optional `sessionId` param (`all` or specific GUID)
- Add a composite index on `(ServiceId, Timestamp)` for efficient range queries
- Consider SQLite FTS5 for full-text log search (much faster than LIKE)

**UI integration**: The Session Explorer (Idea D) uses this for "search across all sessions".

---

### Idea H — Log Ring Buffer for Replay (Backend)

A lightweight in-memory ring buffer per active service to solve the missed-logs race:

```csharp
public class LogRingBuffer
{
    private readonly LogEntry[] _buffer;
    private int _head = 0;
    private int _count = 0;
    private readonly int _capacity;
    
    public LogRingBuffer(int capacity = 500) { ... }
    
    public void Add(LogEntry entry) { ... }         // O(1), lock-free
    public LogEntry[] GetAll() { ... }               // snapshot
    public LogEntry[] GetSince(DateTime since) { ... } // filtered snapshot
}
```

- Created when service starts, disposed when service stops
- Fed by the same code path that feeds `LogBatchService`
- Queried by `LogHub.JoinAppGroup` to replay on join
- Memory cost: ~500 entries × ~200 bytes = ~100KB per active service

---

### Idea I — Metrics Session Correlation API

New endpoint that returns system metrics **annotated with active sessions**:

```json
GET /api/metrics/system/history?from=...&to=...&includeSessions=true

{
  "dataPoints": [
    {
      "timestamp": "2026-03-11T10:05:00Z",
      "cpuUsagePercent": 23.5,
      "memoryUsagePercent": 45.2,
      "activeSessions": [
        { "serviceId": "...", "serviceName": "api-gateway", "sessionId": "..." },
        { "serviceId": "...", "serviceName": "worker-1", "sessionId": "..." }
      ]
    }
  ],
  "sessionSpans": [
    { "serviceId": "...", "serviceName": "api-gateway", "start": "10:05:00", "end": "10:47:00", "exitCode": 0 },
    { "serviceId": "...", "serviceName": "worker-1", "start": "10:15:00", "end": null, "exitCode": null }
  ]
}
```

This lets the frontend render session bars and chart overlays from a single API call instead of N requests.

---

## 4. Challenges & Risks

| Risk | Details | Mitigation |
|------|---------|-----------|
| Log volume for search | SQLite LIKE on 100K+ rows is slow | Use SQLite FTS5 virtual table, or add a composite index |
| Dashboard density | Many services = crowded timeline | Collapsible groups, top-5 by CPU/Mem filter |
| Ring buffer memory | 500 lines × N services | Cap at ~100KB per service; only for active processes |
| Session list length | Long-running cluster = thousands of sessions | Paginate, default to last 7 days |
| Chart performance | 60 points × session overlays | Use recharts `ReferenceArea` (SVG), not DOM elements |
| LogContext rewrite | Breaking change to every log consumer | Incremental: add session field to existing structure |
| Missed early logs | Race between process start and SignalR join | Ring buffer replay (Idea H) + DB backfill fallback |

---

## 5. Ranked Recommendations

| Rank | Idea | Impact | Effort | Priority |
|------|------|--------|--------|----------|
| 1 | **C + H — Zero-loss log capture** (ring buffer + replay) | 🔴 High — core reliability | Medium | **Phase 1** |
| 2 | **D — Log Session Explorer UI** | 🔴 High — unused backend features exposed | Medium | **Phase 1** |
| 3 | **E — Structured LogContext** | 🟠 High — enables all other log features | Medium | **Phase 1** |
| 4 | **G — Cross-session log search** | 🟠 High — debugging power | Low-Medium | **Phase 1** |
| 5 | **F — Enhanced dashboard layout** (session timeline) | 🟠 High — visual impact | Medium | **Phase 2** |
| 6 | **A — Session markers on system charts** | 🟡 Medium — nice correlation | Low | **Phase 2** |
| 7 | **B — Session-scoped process metrics** | 🟡 Medium — better time ranges | Low | **Phase 2** |
| 8 | **I — Metrics session correlation API** | 🟡 Medium — enables A+F efficiently | Medium | **Phase 2** |

---

## 6. Next Steps / Phase Plan

### Phase 1 — Log Session Foundation

**Goal**: Complete log reliability + session browsing with search.

1. **LogRingBuffer** (backend) — In-memory ring buffer per active service
   - New `LogRingBuffer.cs` service, registered as singleton dictionary
   - Fed alongside `LogBatchService` in `ServiceProcessManager`
   
2. **Replay on JoinAppGroup** (backend) — Modify `LogHub.JoinAppGroup` to send buffered logs
   - New `ReplayLogs` SignalR event (sends array, not individual lines)
   - Client handles `ReplayLogs` by prepending to log state, deduplicating

3. **Structured LogContext** (frontend) — Rewrite `LogContext.tsx`
   - Store `LogEntry[]` with timestamp, type, sessionId
   - Add `currentSessionId` tracking
   - Handle `ReplayLogs` event
   
4. **Log Session Explorer** (frontend) — New component/tab in service detail
   - Session list from `GET /api/services/{id}/sessions`
   - Session log viewer from `GET /api/services/{id}/sessions/{sessionId}/logs`
   - Paginated, with session metadata (duration, exit code, command)
   
5. **Cross-session search** (backend) — Extend `LogsController.Search`
   - Add `sessionId` param (optional, defaults to latest, accepts `all` or GUID)
   - Add composite DB index `(ServiceId, Timestamp)` if not present

6. **Cross-session search UI** — Add session scope picker to LogViewer search bar
   - "Current session" / "All sessions" / specific session dropdown
   - Date range filter

### Phase 2 — Dashboard Session Visualization

**Goal**: Dashboard shows session lifecycle as a first-class concept.

7. **Session timeline component** — Gantt-style SVG component
   - Fetches recent sessions for all services
   - Color-coded by status (running/exited/failed)
   - Click → navigate to session logs

8. **Session overlay on charts** — Add `ReferenceArea` bands to existing recharts
   - Color-coded by service
   - Tooltip shows service name + session duration

9. **Metrics correlation API** — `GET /api/metrics/system/history?includeSessions=true`
   - Returns `sessionSpans[]` alongside `dataPoints[]`
   - Single API call for dashboard

10. **Active sessions feed** — Real-time event log on dashboard
    - SignalR event for session start/stop
    - Compact timeline like a commit log

11. **Session-scoped process metrics** — Session picker in ProcessMetrics
    - Dropdown of sessions → auto-fills time range

---

## 7. Critical Assessment

**What sounds good but needs care:**

- **SQLite FTS5 for log search**: FTS5 is powerful but requires maintaining a separate virtual table alongside `SessionLogs`. For <100K entries per service, a composite index + LIKE is sufficient. Only add FTS5 when search becomes noticeably slow.

- **Structured LogContext rewrite**: This touches every component that reads `useLogContext()`. It must be backward-compatible — keep `logs[appId]` as `string[]` for simple consumers and add `logEntries[appId]` as `LogEntry[]` for session-aware consumers. Don't break existing code.

- **Session timeline on dashboard**: If a user has 50 services, the timeline becomes unreadable. Must default to "top 5 by CPU" or "currently running" and allow expanding. Consider a collapsed summary: "4 services running, 2 stopped in last hour".

- **Ring buffer vs. DB backfill**: The ring buffer is the cleanest solution for replay, but there's a simpler first step — when `JoinAppGroup` is called, the client can immediately HTTP-fetch `GET /api/services/{id}/sessions/{currentSessionId}/logs` from the DB. The ring buffer is faster (no DB round-trip) but the DB backfill works today with zero backend changes. **Start with DB backfill, add ring buffer later if latency matters.**

- **Log volume**: A service outputting 1000 lines/sec for 1 hour = 3.6M log entries per session. Pagination is essential. Never load all logs at once — always paginate with a default of 500 lines per page.

---

## 8. Data Flow Diagrams

### Current Log Flow

```
Process stdout ──► ServiceProcessManager ──┬──► SignalR "ReceiveLog" ──► Client LogContext (string[])
                                           │
                                           └──► LogBatchService ──► SessionLogs DB
                                           
Client opens service page ──► JoinAppGroup ──► (nothing sent)
                              │
                              └──► useEffect loads 200 lines from DB ──► addLog(strings)
```

### Proposed Log Flow (Phase 1)

```
Process stdout ──► ServiceProcessManager ──┬──► SignalR "ReceiveLog" ──► Client LogContext (LogEntry[])
                                           │
                                           ├──► LogBatchService ──► SessionLogs DB
                                           │
                                           └──► LogRingBuffer (in-memory, 500 entries per service)
                                           
Client opens service page ──► JoinAppGroup ──► LogHub replays from RingBuffer
                              │                via "ReplayLogs" (batched array)
                              │
                              └──► Client merges replay + real-time, deduplicates by timestamp
```

### Session Explorer Data Flow

```
User clicks "Sessions" tab ──► GET /api/services/{id}/sessions
                               └──► Renders session list with metadata
                               
User clicks Session #47 ──► GET /api/services/{id}/sessions/{47}/logs?page=1&pageSize=500
                            └──► Renders paginated log viewer for that session
                            
User searches "error" ──► GET /api/services/{id}/logs/search?query=error&sessionId=all
                          └──► Renders cross-session search results with session labels
```

---

## 9. UI Wireframes

### Session Explorer Tab (in service detail)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Overview] [Logs] [Sessions] [Metrics] [Config] [Files]            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Sessions for: api-gateway                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🔍 Search all sessions: [_________________________] [Search]│   │
│  │ Filter: [All types ▾] [Last 7 days ▾]                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ● Session #47   Mar 11 10:05 → 10:47   42m 15s   exit 0   │   │
│  │   12,847 lines · dotnet run --urls http://0.0.0.0:5147     │   │
│  │   [View Logs] [View Metrics] [Compare]                     │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ✗ Session #46   Mar 11 09:12 → 09:58   46m 02s   exit 1   │   │
│  │   8,231 lines · dotnet run --urls http://0.0.0.0:5147      │   │
│  │   [View Logs] [View Metrics]                               │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ● Session #45   Mar 10 22:00 → Mar 11 08:15   10h 15m     │   │
│  │   124,012 lines · dotnet run --urls http://0.0.0.0:5147    │   │
│  │   [View Logs] [View Metrics]                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  Showing 3 of 47 sessions   [Load more]                            │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  SESSION #47 LOGS                                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [All ▾] [Jump to Error ↓] [Download] [🔍 Filter in session]│   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ 10:05:01.234 OUT  info: Microsoft.Hosting[14]              │   │
│  │ 10:05:01.235 OUT    Now listening on: http://0.0.0.0:5147  │   │
│  │ 10:05:01.236 OUT    Application started. Press Ctrl+C to   │   │
│  │ 10:05:02.104 ERR  warn: ConnectionRefused to database      │   │ ◄ red
│  │ 10:05:02.105 ERR    at Npgsql.NpgsqlConnection.Open()      │   │ ◄ red
│  │ 10:05:03.001 OUT  info: Retrying connection (1/3)          │   │
│  │ ...                                                         │   │
│  │ 10:47:12.001 OUT  info: Application is shutting down.      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  Page 1 of 26  ◀ ● ● ● ● ▶    12,847 lines                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Dashboard Session Timeline

```
┌──────────────────────────────────────────────────────────────┐
│  Active Sessions                   Last 2 hours              │
│  ────────────────────────────────────────────────────────── │
│                09:00    10:00    11:00    Now                 │
│  api-gateway   ····■███████████████████████████████■····     │
│  worker-1      ··················■██████████████████████     │
│  redis         ■████████████████████████████████████████     │
│  db-migrate    ···········■███■✗  ← exit 1                   │
│  scheduler     ··········■██████████████████████████████     │
│  ────────────────────────────────────────────────────────── │
│  5 services running  •  1 failed  •  12 sessions today       │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. API Changes Needed

| Change | Endpoint/File | Type |
|--------|--------------|------|
| Add `sessionId` param to log search | `LogsController.cs` — `GET /search` | Backend |
| Add `lineCount` to session list response | `SessionsController.cs` — `GET /` | Backend |
| Add session correlation to metrics | New endpoint or expand existing | Backend |
| Add ring buffer service | New `LogRingBuffer.cs` | Backend |
| Modify `JoinAppGroup` for replay | `LogHub.cs` | Backend |
| Add `ReplayLogs` SignalR event | `LogHub.cs` | Backend + Frontend |

---

## 11. References

- Existing sessions API: [SessionsController.cs](../../api/Innovatek.Parallel.MiniCluster.Api/Controllers/SessionsController.cs)
- Log batch service: [LogBatchService.cs](../../api/Innovatek.Parallel.MiniCluster.Api/Services/LogBatchService.cs)
- Current log viewer: [LogViewer.tsx](../../ui/app/components/LogViewer.tsx)
- Dashboard: [home.tsx](../../ui/app/routes/home.tsx)
- Process metrics: [ProcessMetrics.tsx](../../ui/app/components/ProcessMetrics.tsx)
- Session entity: [ServiceSession.cs](../../api/Innovatek.Parallel.MiniCluster.Core/Entities/ServiceSession.cs)
- Network optimization brainstorm: [001-Network-Optimization-KeepAlive](../001-Network-Optimization-KeepAlive/README.md)
