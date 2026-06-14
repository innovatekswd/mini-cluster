# Feature 027: Operations Cockpit UX, Realtime, and Route Alignment

> **Status:** Spec Draft
> **Phase:** UX and Platform Consistency
> **Priority:** High
> **Estimated Effort:** 4-6 weeks
> **Author:** GitHub Copilot
> **Date:** 2026-05-02

---

## Overview

MiniCluster currently has a powerful set of pages and backend capabilities, but the user experience is fragmented across overlapping routes and several live operational views still rely on REST polling even though SignalR infrastructure exists. This spec turns the current UI into a coherent operations cockpit, aligns SignalR event contracts across the .NET and Go APIs, reduces unnecessary HTTP polling, and standardizes route naming.

This document is written as an implementation handoff for another agent. The agent should treat each section as a concrete work package with acceptance criteria.

---

## Goals

- Make the UI feel like one operational control center, not a collection of loosely related tools.
- Clarify navigation, page ownership, and route naming.
- Use SignalR for live operational state: logs, terminal, lifecycle, service status, and live metrics.
- Keep REST for durable operations: CRUD, search, history, import/export, downloads, and explicit refresh.
- Align Go and .NET backend contracts so the same React UI works correctly against both.
- Preserve existing functionality through redirects and compatibility aliases during migration.

## Non-Goals

- Do not rewrite the entire UI in a new framework.
- Do not remove existing routes without redirects.
- Do not remove REST endpoints that are useful for history, explicit refresh, CLI, or tests.
- Do not introduce a new design system dependency unless a later task explicitly approves it.
- Do not change authentication flows except where SignalR auth compatibility requires it.

---

## Current Findings

### Frontend Routes

Current route definitions are in `ui/app/routes.ts`.

Observed issues:

- `/dashboard/:appName?/:serviceName?` uses optional path segments and mixes app selection, service selection, and view mode.
- `/dashboard`, `/services`, and `/infrastructure` overlap in purpose.
- `/files` is a thin upload manager while `/explorer` is the real file manager.
- `/envs` exists as a top-level route, while environment management conceptually belongs under settings or app configuration.
- `/hierarchy` is exposed as a primary route even though it is a specialized app topology/snapshot feature.

### Navigation

Current navigation is implemented in `ui/app/components/Layout.tsx`.

Observed issues:

- The header contains brand, metrics, many icon-only page links, status, notifications, and user menu.
- Links have `aria-label`s, which is good, but discoverability is weak because primary navigation is icon-only.
- There is no consistent active route state for all primary nav items.
- The header is overloaded on smaller screens.

### SignalR And Polling

Relevant frontend files:

- `ui/app/context/SignalRConnectionContext.tsx`
- `ui/app/context/AppStatusContext.tsx`
- `ui/app/hooks/useSystemMetricsHistory.ts`
- `ui/app/components/TaskManager.tsx`
- `ui/app/services/terminalService.ts`

Relevant backend files:

- `.NET`: `api/Innovatek.Parallel.MiniCluster.Api/Hubs/LogHub.cs`
- `.NET`: `api/Innovatek.Parallel.MiniCluster.Api/Hubs/TerminalHub.cs`
- `.NET`: `api/Innovatek.Parallel.MiniCluster.Api/Services/ProcessMetricsCollectionService.cs`
- `Go`: `api-go/internal/hubs/log_hub.go`
- `Go`: `api-go/internal/hubs/terminal_hub.go`
- `Go`: `api-go/cmd/server/main.go`

Observed issues:

- React listens for `ReceiveLog`, `ReplayLogs`, `StatusUpdated`, `AllProcessMetrics`, and `SystemMetrics`.
- .NET mostly emits those names.
- Go emits `LogEntry`, `MetricsUpdate`, `ServiceStarted`, and `ServiceStopped`, which do not match the React listeners.
- Go terminal hub sends payload objects for terminal events, while the React terminal service expects positional arguments.
- `AppStatusContext` still polls `/api/services/statuses` every 10 seconds.
- `useSystemMetricsHistory` polls `/api/metrics/system` every 5 seconds.
- `TaskManager` polls live metrics and system processes every 5 seconds even while also subscribing to SignalR.

### API Naming

Observed route inconsistencies:

- `/api/apps` and `/api/Apps` both exist for compatibility.
- `/api/envs` and `/api/environments` both exist in Go.
- Service control has both `/api/services/{id}/exec/start` style and `/api/services/{id}/start` style.
- .NET uses `/api/services/{id}/history` for service lifecycle/version history, while Go uses `/api/services/{id}/versions`.
- Some routes are action-style when resource-style naming would be clearer, but action routes are acceptable for commands such as start, stop, restart, clone, trigger, activate, and test.

---

## Target Information Architecture

### Primary Navigation

Use these primary sections in a desktop rail and mobile drawer:

1. Overview
2. Apps
3. Services
4. Monitor
5. Files
6. Automation
7. Proxy
8. Settings

Secondary or nested sections:

- App hierarchy and snapshots should live under Apps or the app workspace.
- Environments should live under Settings, with `/envs` kept as a compatibility alias if needed.
- File transfers should live inside Files/Explorer, not as a separate top-level upload page.

### Target Frontend Route Model

Canonical routes:

```text
/                                      Overview
/apps                                  App management
/apps/:appSlug                         App workspace
/apps/:appSlug/services/:serviceSlug   Service workspace
/services                              Global service inventory
/machines                              Machine and infrastructure view
/monitor                               System and process monitor
/explorer                              File explorer and transfer queue
/automation                            Scheduling and jobs
/proxy                                 Reverse proxy management
/settings                              General settings
/settings/environments                 Environments
/settings/users                        Users
/settings/system                       System maintenance
```

> **REJECTED per architecture decision:** No backward compatibility redirects. Clean rename only.
>
> Old routes (`/dashboard`, `/infrastructure`, `/scheduling`) will be removed entirely. Users must update bookmarks.

Acceptance criteria:

- [ ] Primary navigation shows the current route as active.
- [ ] Mobile users can navigate through a drawer without horizontal overflow.
- [ ] Optional path segment routing is removed from new navigation flows.
- [ ] Route names are resource-oriented and predictable.

---

## Work Package 1: App Shell And Navigation

### Implementation Tasks

- Create a reusable app shell layout with:
  - Desktop left rail.
  - Mobile drawer.
  - Top header for brand, compact metrics, backend status, notifications, and user menu.
- Move primary nav links out of the crowded header.
- Add active route styling using the current location.
- Add visible nav labels in rail/drawer.
- Keep icon buttons where appropriate, but use text labels for primary navigation.
- Add tooltips for collapsed rail items.

Suggested files:

- `ui/app/components/Layout.tsx`
- `ui/app/components/Header/SystemMetricsBar.tsx`
- New: `ui/app/components/AppShell.tsx`
- New: `ui/app/components/NavigationRail.tsx`
- New: `ui/app/components/MobileNavigationDrawer.tsx`

Acceptance criteria:

- [ ] Header no longer contains every primary route icon.
- [ ] Desktop has a stable left rail or equivalent navigation surface.
- [ ] Mobile has a drawer that lists all primary sections with labels.
- [ ] Active route state is visible.
- [ ] Keyboard focus states are visible.
- [ ] All nav items keep `aria-label` or visible text.

---

## Work Package 2: Page Ownership And UX

### Overview Page `/`

Purpose: operational summary and triage.

> **ADAPTIVE BEHAVIOR (per architecture decision):** The Overview page adapts its layout based on cluster topology:
> - **Single-node mode:** Shows machine-focused view (system metrics, local services)
> - **Multi-node mode:** Shows cluster-focused view (aggregate stats across all nodes, per-node health)

Required UX:

- Show high-signal cards only:
  - Total apps/services.
  - Running/stopped/failed/degraded counts.
  - Top CPU consumers.
  - Top memory consumers.
  - Recent lifecycle events.
  - Quick actions.
- KPI cards should click through into filtered pages.
- Dense charts should move below the first viewport or into Monitor.

Acceptance criteria:

- [ ] Overview first viewport answers: what is broken, what is busy, what changed.
- [ ] Failed/degraded services are actionable links.
- [ ] Charts do not dominate the first viewport.
- [ ] Layout adapts based on single-node vs multi-node topology.

### Apps Page `/apps`

Purpose: manage app groups and app-level operations.

Required UX:

- Add search.
- Add sort: name, status, created/updated, service count.
- Add grid/list toggle.
- Add multi-select.
- Add bulk import/export:
  - Export selected apps.
  - Export visible filtered apps.
  - Export all apps.
  - Import apps from a file.
- Keep app health visible: running/total services, failed count, last activity.

Suggested files:

- `ui/app/routes/apps.tsx`
- `ui/app/hooks/useAppsQueries.ts`
- `ui/app/services/appsApiService.ts`

Acceptance criteria:

- [ ] User can select one, many, visible, or all apps.
- [ ] Export produces a clear JSON payload with metadata.
- [ ] Import reports success/failure with actionable errors.
- [ ] Search and sort work with keyboard input.

### App Workspace `/apps/:appSlug`

Purpose: focused app operations.

Required UX:

- Show app header, health, environment, services, quick actions, and recent events.
- Include tabs or sections: Services, Logs, Metrics, Config, Snapshots.
- Include breadcrumbs.

Acceptance criteria:

- [ ] User can understand app health without opening each service.
- [ ] User can start/stop/restart all app services with confirmation.
- [ ] App-level logs and events are visible.

### Service Workspace `/apps/:appSlug/services/:serviceSlug`

Purpose: focused service operations.

Required UX:

- Show service state, config, logs, metrics, files, versions, env, args.
- Keep side panel visible on desktop.
- Make modes explicit: view, edit, add.
- Inline validation errors in service forms.

Suggested files:

- `ui/app/components/ServiceConfigForm.tsx`
- `ui/app/components/ServiceConsole.tsx`
- `ui/app/components/SidePanel.tsx`

Acceptance criteria:

- [ ] User sees clear view/edit/add state.
- [ ] Invalid fields show inline errors next to the field.
- [ ] Logs and metrics update live for running services.

### Services Page `/services`

Purpose: global inventory, not a duplicate dashboard.

Required UX:

- Table/card toggle.
- Filters by app, status, machine, external/native/container.
- Bulk start/stop/restart/export.
- Saved views such as Failed, Running, High Memory, Recently Restarted.

Acceptance criteria:

- [ ] User can find a service quickly in large datasets.
- [ ] Bulk actions require confirmation.
- [ ] Filters are reflected in URL query params.

### Machines Page `/machines`

Purpose: infrastructure/node view.

Required UX:

- Replace or redirect `/infrastructure`.
- Show local and remote machines/nodes.
- Show capacity, agent health, service placement, and last heartbeat.

Acceptance criteria:

- [ ] `/infrastructure` redirects to `/machines`.
- [ ] Page content is about machines/nodes, not generic services.

### Monitor Page `/monitor`

Purpose: realtime system and process monitoring.

Required UX:

- Use SignalR as primary live transport.
- Add process search.
- Add pinned watched processes.
- Add CSV export for metrics history.
- Make sort indicators obvious.

Acceptance criteria:

- [ ] No duplicate polling while SignalR is connected.
- [ ] Search filters process table instantly.
- [ ] Metrics export works from current range.

### Explorer And Files

Purpose: file manager plus transfer queue.

Required UX:

- Merge `/files` into `/explorer?tab=transfers`.
- Add transfer queue with progress, retry, cancel, and history.
- Add preview panel for text/images where possible.
- Add draggable split panes.

Acceptance criteria:

- [ ] `/files` redirects to Explorer transfers.
- [ ] Upload/download operations show persistent progress.
- [ ] User can retry failed transfers.

### Terminal

Purpose: browser terminal sessions.

Required UX:

- Fix Go/.NET terminal event compatibility.
- Persist tabs in session storage.
- Show real SignalR connection state.
- Add working directory selector per tab.

Acceptance criteria:

- [ ] Terminal create/write/resize/close works on both backends.
- [ ] Status bar reflects real connection state.
- [ ] Refreshing the page restores tab metadata where safe.

### Proxy

Purpose: reverse proxy route management.

Required UX:

- Add upstream health badges.
- Add generated URL preview and copy.
- Group routes by domain/prefix.
- Keep delete confirmation.
- Show loading state for health checks.

Acceptance criteria:

- [ ] Health check button shows pending and result states.
- [ ] Generated URLs are visible and copyable.

### Automation

Purpose: scheduled jobs and cron.

Required UX:

- Rename or alias `/scheduling` to `/automation`.
- Add human-readable cron preview.
- Add timezone selector.
- Add next 5 runs preview.
- Add dry-run/test action.
- Add run history.

Acceptance criteria:

- [ ] User can understand schedule without reading cron syntax.
- [ ] User can test a job before saving or enabling.

### Settings And Environments

Purpose: configuration, users, system, environments.

Required UX:

- Add unsaved-change guard.
- Move environments under `/settings/environments`, keeping `/envs` alias.
- Environment editor should become a matrix:
  - Environments as columns.
  - Variables as rows.
  - Secret masking.
  - Duplicate key warnings.
  - Diff between environments.
  - Used-by-services hints.

Acceptance criteria:

- [ ] Leaving settings with unsaved changes warns the user.
- [ ] Environment variable differences are easy to compare.
- [ ] Secrets are masked by default.

### Hierarchy And Snapshots

Purpose: app topology and state snapshots.

Required UX:

- Move under Apps or app workspace.
- Add snapshot compare.
- Add rollback preview.
- Add branch start/stop impact summary.

Acceptance criteria:

- [ ] User can compare two snapshots before rollback.
- [ ] User sees affected services before branch operations.

---

## Work Package 3: SignalR Contract Alignment

### Canonical Events

All backends should emit these event names and payload shapes.

```typescript
type LogEntry = {
  serviceId: string;
  sessionId?: string;
  type: "stdout" | "stderr";
  line: string;
  timestamp: string;
};

type ServiceLifecycleChanged = {
  serviceId: string;
  status: "Starting" | "Running" | "Stopping" | "Stopped" | "Failed" | "Exited" | "Unknown";
  sessionId?: string;
  exitCode?: number;
  timestamp: string;
};

type EntityChanged = {
  entity: "app" | "service" | "environment" | "settings";
  action: "created" | "updated" | "deleted" | "reordered" | "imported";
  id?: string;
  slug?: string;
  timestamp: string;
};
```

Required hub events:

```text
ReceiveLog(logEntry)
ReplayLogs(logEntries[])
StatusUpdated(serviceId, status)
ServiceLifecycleChanged(payload)
SystemMetrics(snapshot)
AllProcessMetrics(snapshot[])
ProcessMetrics(snapshot)
AppChanged(payload)
ServiceChanged(payload)
EnvironmentChanged(payload)
```

### Go Backend Changes

Update `api-go/internal/hubs/log_hub.go`:

- Change `BroadcastLog` to send `ReceiveLog`, not `LogEntry`.
- Add explicit broadcasts for `SystemMetrics`, `AllProcessMetrics`, and `ProcessMetrics`.
- Keep `MetricsUpdate` only as deprecated if existing clients depend on it.
- Add `BroadcastStatusUpdated(serviceID, status)`.
- Add `BroadcastServiceLifecycleChanged(payload)`.

Update `api-go/cmd/server/main.go`:

- Replace or supplement `ServiceStarted` / `ServiceStopped` with `StatusUpdated` and `ServiceLifecycleChanged`.
- Wire metrics collector ticks to SignalR broadcasts.

Update `api-go/internal/hubs/terminal_hub.go`:

- Make terminal event signatures match React and .NET:
  - `TerminalData(terminalId, data)`
  - `TerminalExit(terminalId, exitCode)`
  - `TerminalError(terminalId, error)`
- Make `CreateTerminal` match UI arguments or update UI adapter:
  - `CreateTerminal(workingDirectory?: string, cols?: number, rows?: number)`

Acceptance criteria:

- [ ] Go emits all canonical event names.
- [ ] React receives logs from Go without listening to `LogEntry`.
- [ ] React receives service status changes from Go without polling.
- [ ] Terminal works against Go with the same React service used for .NET.

### .NET Backend Changes

Review and keep alignment in:

- `api/Innovatek.Parallel.MiniCluster.Api/Hubs/LogHub.cs`
- `api/Innovatek.Parallel.MiniCluster.Api/Services/ServiceProcessManager.cs`
- `api/Innovatek.Parallel.MiniCluster.Api/Services/AutoRestartService.cs`
- `api/Innovatek.Parallel.MiniCluster.Api/Services/ProcessMetricsCollectionService.cs`

Acceptance criteria:

- [ ] .NET emits the canonical event names.
- [ ] Any additional legacy event names are documented or removed after compatibility period.

### React Changes

Update `ui/app/context/SignalRConnectionContext.tsx`:

- Centralize event registration.
- Add typed event handlers.
- Add subscriptions for `StatusUpdated`, `SystemMetrics`, `AllProcessMetrics`, `ProcessMetrics`, and entity changed events.
- Ensure reconnect rejoins groups and triggers one HTTP reconciliation fetch.

Update `ui/app/hooks/useServiceStatus.ts` and `ui/app/context/AppStatusContext.tsx`:

- Use SignalR status events as primary source.
- Keep `/api/services/statuses` as initial load and reconnect fallback.

Acceptance criteria:

- [ ] Status UI updates immediately after backend emits `StatusUpdated`.
- [ ] Reconnect performs exactly one reconciliation fetch for status.
- [ ] Event handlers are not duplicated on re-render.

---

## Work Package 4: Reduce REST Polling

### Current Polling To Replace Or Reduce

- `ui/app/context/AppStatusContext.tsx`: `/api/services/statuses` every 10 seconds.
- `ui/app/hooks/useSystemMetricsHistory.ts`: `/api/metrics/system` every 5 seconds.
- `ui/app/components/TaskManager.tsx`: `/api/metrics/live`, `/api/metrics/system`, and process polling every 5 seconds.
- `ui/app/context/ConnectionContext.tsx`: `/api/health` every 10 seconds. This can remain low-frequency health monitoring.

### Target Pattern

- Initial page load: HTTP snapshot.
- Connected SignalR: live updates only.
- Reconnect: one HTTP reconciliation fetch.
- Hidden tab: no high-frequency HTTP polling.
- SignalR disconnected: fallback to conservative polling if page is visible.

Acceptance criteria:

- [ ] No status polling while SignalR is connected and authenticated.
- [ ] No system metrics polling while receiving `SystemMetrics` events.
- [ ] TaskManager does not run duplicate HTTP polling and SignalR updates at the same time.
- [ ] Tests prove reduced HTTP call count after SignalR connects.

---

## Work Package 5: REST Route Naming And Compatibility

### Canonical API Routes

Use lowercase plural resources:

```text
/api/apps
/api/services
/api/envs
/api/metrics
/api/machines
/api/proxy-routes
/api/proxy-settings
/api/cron or /api/jobs
/api/explorer
/api/settings
```

Service lifecycle canonical pattern:

```text
POST /api/services/{id}/exec/start
POST /api/services/{id}/exec/stop
POST /api/services/{id}/exec/restart
GET  /api/services/{id}/exec/status
```

Compatibility aliases may remain temporarily:

```text
POST /api/services/{id}/start
POST /api/services/{id}/stop
POST /api/services/{id}/restart
```

Service versions/history:

```text
GET  /api/services/{id}/versions
POST /api/services/{id}/versions
GET  /api/services/{id}/versions/{versionId}
GET  /api/services/{id}/versions/{versionId}/diff
POST /api/services/{id}/versions/{versionId}/rollback
```

Deprecated alias:

```text
/api/services/{id}/history -> /api/services/{id}/versions
```

Acceptance criteria:

- [ ] UI uses canonical routes only.
- [ ] Go and .NET expose matching canonical routes.
- [ ] Deprecated aliases are covered by route tests and marked for future removal.
- [ ] Route parity tests pass for both backends.

---

## Work Package 6: Style System Refinement

### Direction

Keep the dark operational style, but reduce visual noise and make state clearer.

Rules:

- Use fewer gradients. Reserve gradients for brand and primary action moments.
- Use slate surfaces with semantic accents.
- Keep dense operational controls compact.
- Use consistent status colors:
  - Running: green/emerald.
  - Degraded/warning: amber.
  - Failed/error: red/rose.
  - Stopped/inactive: slate.
  - Info/neutral action: blue/cyan.
- Avoid nesting cards inside cards for page layout.
- Prefer full-width bands/toolbars and repeated cards only for repeated entities.

### Shared UI Primitives

Create or standardize:

- `PageHeader`
- `Toolbar`
- `StatusBadge`
- `MetricTile`
- `BulkActionBar`
- `FilterBar`
- `EmptyState`
- `SectionTabs`
- `ConnectionStateBadge`

Acceptance criteria:

- [ ] New pages use shared primitives instead of one-off page chrome.
- [ ] Status colors are consistent across apps, services, monitor, and dashboard.
- [ ] Text does not overflow buttons/cards at mobile widths.
- [ ] Primary actions are visually consistent across pages.

---

## Work Package 7: Tests

### E2E Tests

Add or update Playwright tests in `e2e/tests`.

Required coverage:

- Route redirects:
  - `/dashboard/...` redirects to new workspace routes.
  - `/infrastructure` redirects to `/machines`.
  - `/files` redirects to Explorer transfers.
  - `/envs` redirects or aliases to settings environments.
- Navigation:
  - Active nav state is visible.
  - Mobile drawer opens and navigates.
- SignalR:
  - Logs stream with `ReceiveLog`.
  - Status updates with `StatusUpdated`.
  - Metrics update with `SystemMetrics` and `AllProcessMetrics`.
  - Terminal create/write/resize/close works on .NET and Go.
- Polling reduction:
  - After SignalR connects, status and metrics HTTP calls do not continue at high frequency.
- Apps import/export:
  - Export selected apps.
  - Export all apps.
  - Import valid file.
  - Show actionable error for invalid file.

### Backend Tests

Add parity tests for .NET and Go API route naming:

- Services CRUD.
- Services statuses.
- Services exec routes.
- Versions/history canonical and alias routes.
- Environments canonical and alias routes.
- Import/export routes.

Acceptance criteria:

- [ ] `go test ./...` passes for Go changes.
- [ ] `.NET` test suite passes for API changes.
- [ ] Playwright e2e tests pass against both Go and .NET where practical.

---

## Suggested Implementation Order

1. SignalR contract alignment for Go, .NET verification, and React typed event handling.
2. Polling reduction after SignalR is reliable.
3. App shell navigation and route redirects.
4. Apps page bulk import/export and search/sort.
5. Services/global inventory refinements.
6. Monitor realtime refinements.
7. Files/Explorer merge.
8. Remaining page polish: Proxy, Automation, Settings, Environments, Hierarchy.
9. Route parity and e2e test hardening.

---

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing deep links | Keep redirects and compatibility aliases during migration. |
| SignalR event mismatch between Go and .NET | Define shared TypeScript event contract and backend parity tests. |
| Removing polling too early | Keep HTTP snapshot and reconnect fallback until realtime tests pass. |
| Large UX change becomes too broad | Implement shell/routes first, then page-by-page improvements. |
| Mobile regressions | Add Playwright screenshot/navigation checks for mobile viewports. |

---

## Definition Of Done

- [ ] The app has a clear primary navigation model.
- [ ] Top-level routes have distinct ownership and no confusing duplicates.
- [ ] SignalR event names and payloads match across .NET, Go, and React.
- [ ] Live status and metrics no longer rely on unnecessary polling while connected.
- [ ] API route naming is canonical, with documented aliases.
- [ ] Apps support bulk import/export.
- [ ] Page UX improvements are implemented or tracked as follow-up tasks.
- [ ] Route parity, SignalR, terminal, import/export, and mobile navigation tests are added.
