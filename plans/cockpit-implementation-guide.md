# Operations Cockpit Widget Grid — Implementation Guide

## Design Document

All design decisions, layouts, and specifications are in [`plans/ui-redesign-operations-cockpit.md`](plans/ui-redesign-operations-cockpit.md). Read **Sections 2.2, 2.3, 2.3b, 2.7, and 3.3** before starting.

An implementation plan summary is in [`plans/cockpit-widget-grid-plan.md`](plans/cockpit-widget-grid-plan.md).

---

## What We're Building

Replace the tabbed Focus Panel on the Operations Cockpit (`/`) with an **information-dense widget grid dashboard** and a **Global Context Bar** that cascades machine scope, time range, refresh rate, and live mode to all widgets simultaneously.

**Before**: Tabbed panel (Performance | Processes | Disks | Network | History) — only one view visible at a time.
**After**: Scrollable widget grid — Live Charts, Live Logs, Top Processes, Services Health, Recent Events, 24h Sparklines — all visible at once, with a Global Context Bar controlling time range and refresh behavior.

---

## Implementation Tasks (in order)

### Task 1: Create `CockpitContext` React Context

**File to create**: `ui/app/context/CockpitContext.tsx`

```typescript
interface TimeRange {
  type: 'relative' | 'absolute';
  value: string;  // '5m' | '15m' | '1h' | '6h' | '24h' | '7d' | '30d' | 'custom'
  from?: Date;
  to?: Date;
}

interface CockpitContextType {
  machineId: string;
  timeRange: TimeRange;
  refreshRate: number;  // ms, 0 = off
  isLive: boolean;
  setMachine: (id: string) => void;
  setTimeRange: (range: TimeRange) => void;
  setRefreshRate: (ms: number) => void;
  toggleLive: () => void;
}
```

**Behavior**:
- Default: `machineId='local'`, `timeRange={type:'relative', value:'1h'}`, `refreshRate=5000`, `isLive=true`
- Sync state to/from URL search params: `/?machine=local&range=1h&refresh=5s&live=true`
- In multi-machine mode, `machineId` changes via dropdown; in single-machine, always `'local'`
- Provider wraps the entire cockpit page at route level

**Key hook**: `useCockpitContext()` — consumed by all widgets.

---

### Task 2: Create `GlobalContextBar` Component

**File to create**: `ui/app/components/GlobalContextBar.tsx`

**Renders**:
```
[🖥 local ▾]  [⏱ Last 1h ▾]  [🔄 5s ▾]  [🔴 LIVE]
```

**Controls**:
- **Machine Scope Selector**: Dropdown (hidden/static in single-machine via `useIsSingleMachine()`). Options: "All Machines (Cluster)" + individual machines from `useMachinesQuery()`.
- **Time Range Picker**: Dropdown with options `5m`, `15m`, `1h`, `6h`, `24h`, `7d`, `30d`, `Custom`. Custom opens a date range picker.
- **Refresh Rate Selector**: Dropdown with options `Off`, `5s`, `15s`, `30s`, `1m`.
- **Live Mode Toggle**: Button toggling between 🔴 LIVE (sliding window) and ⏸ FROZEN (fixed window).

**Data sources**: All state comes from `useCockpitContext()`. No independent state.

**URL sync**: Two-way binding between context state and URL search params. Use `useSearchParams()` from React Router.

---

### Task 3: Create `VitalsStrip` Component

**File to create**: `ui/app/components/VitalsStrip.tsx`

**Renders**: Compact horizontal bar with CPU%, Memory%, Disk%, Network rates, Service counts, Alert count.

**Data source**: `useSystemMetricsHistory()` for CPU/Memory/Disk/Network. Service counts from `useServiceQueries`. Alert count from events API.

**Behavior**:
- Progress bars for CPU/Memory/Disk with color coding: green (<60%), amber (60-80%), red (>80%)
- Real-time updates at refresh rate from context
- Reacts to machine scope changes

---

### Task 4: Create `LiveChartsWidget` Component

**File to create**: `ui/app/components/widgets/LiveChartsWidget.tsx`

**Renders**: 2×2 grid of `RichChart` components (CPU, Memory, Network I/O, Disk I/O).

**Data source**: `useSystemMetricsHistory()` — already provides `cpuHistory`, `memoryHistory`, `networkSendHistory`, `networkReceiveHistory`, `diskHistory`, `timestamps`.

**Key behavior**:
- Each chart uses the existing [`RichChart`](ui/app/components/RichChart.tsx) component
- Time range from `useCockpitContext()` controls how much history to request
- Refresh rate from context controls polling interval
- Live mode: sliding window (charts auto-scroll); Frozen: fixed range
- X-axis labels adapt to time range (see Section 2.3b time range matrix in design doc)
- Each chart shows avg/peak below and "View All →" link to `/machines/local/resources`
- Responsive: 2-column on desktop, 1-column on mobile

---

### Task 5: Create `LiveLogsWidget` Component

**File to create**: `ui/app/components/widgets/LiveLogsWidget.tsx`

**Renders**: Auto-scrolling log feed with level/service filters.

**Data source**: SignalR via [`useLogStream`](ui/app/hooks/useLogStream.ts) pattern — extend to machine-wide logs (not just per-service). Use `LogHub` from [`api-go/internal/hubs/log_hub.go`](api-go/internal/hubs/log_hub.go).

**Features**:
- Auto-scroll with pause-on-hover
- Filter by log level (DEBUG, INFO, WARN, ERROR, FATAL)
- Filter by service name dropdown
- Color-coded severity badges
- Timestamps respect context time range for historical view
- "View All Logs →" links to `/machines/local/logs`
- Pause/Resume button
- Export button

---

### Task 6: Create `TopProcessesWidget` Component

**File to create**: `ui/app/components/widgets/TopProcessesWidget.tsx`

**Renders**: Compact table of top 10 processes by CPU%.

**Data source**: Existing process API (`GET /api/processes` or similar). Check existing hooks in `useServiceQueries.ts` or create a new `useProcessQueries.ts` hook.

**Features**:
- Sortable columns: Name, PID, CPU%, Mem%, State, Service
- Default sort: CPU% descending
- Service name links to `/apps/:appSlug/services/:serviceSlug`
- Right-click context menu: Kill, View Service, Send Signal
- Refreshes at context refresh rate
- "View All Processes →" links to `/machines/local/processes`

---

### Task 7: Create `ServicesHealthWidget` Component

**File to create**: `ui/app/components/widgets/ServicesHealthWidget.tsx`

**Renders**: Status counts (Running/Restarting/Failed/Stopped) + mini-list of non-healthy services.

**Data source**: `useServiceQueries` or `useAppsWithStatsQuery` from existing hooks.

**Features**:
- Large colored count badges at top
- Failed/restarting services listed below with status and uptime
- Click any service → navigates to service workspace
- "View All Services →" links to `/machines/local/services`

---

### Task 8: Create `RecentEventsWidget` Component

**File to create**: `ui/app/components/widgets/RecentEventsWidget.tsx`

**Renders**: Chronological list of last 10 events with severity badges.

**Data source**: Events API (check existing endpoints or create if missing). Events include: service crashes, deployments, backups, resource warnings.

**Features**:
- Severity badges: 🔴 Critical, ⚠️ Warning, ℹ️ Info
- Relative timestamps ("2h ago") with absolute on hover
- Filter by severity
- Respects context time range
- "View All Events →" links to Machine Detail Overview

---

### Task 9: Create `SparklinesWidget` Component

**File to create**: `ui/app/components/widgets/SparklinesWidget.tsx`

**Renders**: Horizontal strip of 5 compact sparklines (CPU, Memory, Error Rate, Request Rate, Disk) showing 24h trends.

**Data source**: Aggregated metrics API — request 48 data points (30-minute buckets over 24h). Use `metricsService.getSystemMetricsHistory()` with appropriate `from`/`to` and `maxPoints=48`.

**Features**:
- Each sparkline: ~48 points, minimal height (~30px)
- Hover tooltip shows value and time
- Color-coded: blue (normal), amber (>75%), red (>90%)
- Click sparkline → navigate to `/analytics` with metric pre-selected
- Adapts to context time range (switches from 24h to selected range)

---

### Task 10: Create `WidgetGrid` Container Component

**File to create**: `ui/app/components/WidgetGrid.tsx`

**Renders**: Scrollable container arranging all widgets in the designed layout:
1. Live Charts (2×2 grid, full width)
2. Live Logs + Top Processes (side-by-side, 50/50)
3. Services Health + Recent Events (side-by-side, 50/50)
4. 24h Sparklines (full width, compact)

**Common widget wrapper** (`WidgetCard`):
- Collapsible header with title
- Loading skeleton state (shimmer animation)
- Error state with retry button
- Empty state with contextual message
- "View All →" link (passed as prop)
- Responsive: 2-column → 1-column on narrow viewports

---

### Task 11: Update Operations Cockpit Route

**File to modify**: `ui/app/routes/dashboard.tsx` (or wherever the `/` route is defined)

Replace the current tabbed dashboard layout with:
```tsx
<CockpitContextProvider>
  <div className="cockpit-page">
    <Header />                    {/* MiniCluster · Connected · Version · Uptime */}
    <GlobalContextBar />          {/* Machine · Time · Refresh · Live */}
    <VitalsStrip />               {/* CPU · Memory · Disk · Net · Services · Alerts */}
    <QuickActionsBar />           {/* Files · Terminal · Resources · Analytics · Services · Logs · Automation · Proxy */}
    <WidgetGrid />                {/* All widgets in designed layout */}
  </div>
</CockpitContextProvider>
```

---

### Task 12: Update Multi-Machine Cockpit

When `useIsSingleMachine()` returns `false`:
- Show Fleet Overview zone (machine cards + alerts) between Quick Actions and Widget Grid
- `GlobalContextBar` machine dropdown becomes active
- Widget Grid data scopes to selected machine or "All Machines" aggregate

This can be done as a separate phase — the single-machine implementation should work standalone.

---

## File Structure

```
ui/app/
├── context/
│   └── CockpitContext.tsx          # NEW — Task 1
├── components/
│   ├── GlobalContextBar.tsx        # NEW — Task 2
│   ├── VitalsStrip.tsx             # NEW — Task 3
│   ├── WidgetGrid.tsx              # NEW — Task 10
│   └── widgets/
│       ├── LiveChartsWidget.tsx    # NEW — Task 4
│       ├── LiveLogsWidget.tsx      # NEW — Task 5
│       ├── TopProcessesWidget.tsx  # NEW — Task 6
│       ├── ServicesHealthWidget.tsx# NEW — Task 7
│       ├── RecentEventsWidget.tsx  # NEW — Task 8
│       └── SparklinesWidget.tsx    # NEW — Task 9
├── hooks/
│   ├── useSystemMetricsHistory.ts  # EXISTING — reuse for charts/vitals
│   ├── useLogStream.ts            # EXISTING — extend for machine-wide logs
│   ├── useServiceQueries.ts       # EXISTING — reuse for services health
│   └── useMachinesQueries.ts      # EXISTING — reuse for machine selector
└── routes/
    └── dashboard.tsx              # MODIFY — Task 11
```

---

## Key Existing Code to Reuse

| What | Where | How to Use |
|------|-------|------------|
| `RichChart` component | [`ui/app/components/RichChart.tsx`](ui/app/components/RichChart.tsx) | All chart widgets use this for SVG rendering |
| `useSystemMetricsHistory` hook | [`ui/app/hooks/useSystemMetricsHistory.ts`](ui/app/hooks/useSystemMetricsHistory.ts) | Provides CPU/Memory/Disk/Network history arrays + current snapshot |
| `useLogStream` hook | [`ui/app/hooks/useLogStream.ts`](ui/app/hooks/useLogStream.ts) | SignalR log streaming pattern — extend for machine-wide |
| `metricsService` | [`ui/app/services/metricsService.ts`](ui/app/services/metricsService.ts) | API calls for system metrics and history |
| `useServiceQueries` | [`ui/app/hooks/useServiceQueries.ts`](ui/app/hooks/useServiceQueries.ts) | Service list and status data |
| `useMachinesQueries` | [`ui/app/hooks/useMachinesQueries.ts`](ui/app/hooks/useMachinesQueries.ts) | Machine list for scope selector |
| `SignalRConnectionContext` | `ui/app/context/SignalRConnectionContext.tsx` | SignalR connection for real-time data |

---

## Design Document Sections to Read

| Section | Lines | What It Covers |
|---------|-------|----------------|
| 2.2 | ~116–195 | Operations Cockpit layout with full ASCII diagram |
| 2.3 | ~196–360 | Detailed widget specifications (Live Charts, Logs, Processes, Services, Events, Sparklines) |
| 2.3b | ~361–530 | Global Context Bar, time range matrix, CockpitContext architecture, URL sync |
| 2.7 | ~551–615 | Competitor design rationale (PM2, Grafana, Datadog, Supervisor) |
| 3.3 | ~616–700 | Multi-machine cockpit with Fleet Overview + scoped Widget Grid |

---

## Implementation Priority

1. **CockpitContext + GlobalContextBar** (foundation — everything depends on this)
2. **VitalsStrip** (quick win, reuses existing hooks)
3. **LiveChartsWidget** (reuses `RichChart` + `useSystemMetricsHistory`)
4. **WidgetGrid container + WidgetCard wrapper** (layout shell)
5. **LiveLogsWidget** (SignalR integration)
6. **TopProcessesWidget** (table with sorting)
7. **ServicesHealthWidget** (status counts + mini-list)
8. **RecentEventsWidget** (event feed)
9. **SparklinesWidget** (compact sparklines)
10. **Route integration** (wire everything together)
11. **Multi-machine support** (phase 2)

---

## Acceptance Criteria

- [ ] Operations Cockpit shows all widgets simultaneously — no tab switching required
- [ ] Global Context Bar time range change updates all charts, logs, and events simultaneously
- [ ] Global Context Bar refresh rate controls polling interval for all widgets
- [ ] Live Mode toggle switches between sliding window and frozen view
- [ ] Machine scope selector hidden in single-machine mode, active in multi-machine
- [ ] URL search params sync with Context Bar state (shareable links)
- [ ] Every widget has loading skeleton, error state with retry, and "View All →" deep-dive link
- [ ] Widget grid is responsive (2-column → 1-column on mobile)
- [ ] Widgets react to machine scope changes in multi-machine mode
- [ ] All existing functionality preserved (Quick Actions, navigation, etc.)
