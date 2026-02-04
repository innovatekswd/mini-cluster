# 009: Service Versioning & App Snapshots

**Status:** 📋 Spec Ready (0% Complete)  
**Phase:** 5 - Hierarchy & Organization  
**Priority:** 🟢 MEDIUM  
**Effort:** 2-3 weeks  
**Original Spec:** [../spec/009-service-versioning/spec.md](../../spec/009-service-versioning/spec.md)

---

## Summary

Extend versioning to individual services within apps, enabling granular rollbacks and atomic app snapshots. Allows updating a single microservice without affecting others.

## Alignment with Core Concepts

This feature builds on the **008: Machines, Apps & Services** model:

| Concept | Versioning Capability |
|---------|----------------------|
| **Machine** | No versioning (infrastructure) |
| **App** | App Snapshots (bundle of service versions) |
| **Service** | Individual version history |

---

## Key Features ⬜

### 1. Service-Level Versions (1 week)
- ⬜ Version individual services independently
- ⬜ Track service configuration changes
- ⬜ Service version history
- ⬜ Automatic version on config change (optional)

### 2. Granular Rollback (1 week)
- ⬜ Rollback single service without affecting others
- ⬜ Rollback multiple services in app
- ⬜ Rollback across machines (service may run on remote)
- ⬜ Service-level version diff

### 3. App Snapshots (1 week)
- ⬜ **Atomic app version** - Snapshot of all service versions
- ⬜ Example: App v2.0 = API v1.5 + Worker v3.2 + DB v10
- ⬜ Restore entire app to exact state
- ⬜ Compare current state vs snapshot

### 4. Version History UI (3 days)
- ⬜ Service version history panel
- ⬜ Version diff viewer
- ⬜ App snapshot management
- ⬜ One-click rollback

---

## Why This Matters

**Without Service Versioning:**
- ❌ Must rollback entire app even for single service issue
- ❌ Can't track which service version caused problem
- ❌ Hard to coordinate multi-service deployments
- ❌ No "known good" state to restore

**With Service Versioning:**
- ✅ Rollback only the problematic service
- ✅ Track service versions independently
- ✅ Coordinate multi-machine deployments
- ✅ Atomic app snapshots for compliance

---

## Example Use Case

### E-Commerce Platform (Multi-Machine)

```
App: E-Commerce v2.0 (Snapshot)
├── api-server     v1.5.0   (prod-vm-1, process)
├── worker-queue   v3.2.1   (prod-vm-1, process)
├── websocket      v2.1.0   (prod-vm-1, process)
├── web-ui         v4.0.0   (prod-vm-1, process)
├── postgres       v15.0    (prod-vm-2, container)
└── redis          v7.0     (prod-vm-2, container)

Deployment Scenario:
1. Worker v3.2.1 → v4.0.0 (major update on prod-vm-1)
   - If issues → Rollback worker only
   - Other services on both machines unaffected
   
2. Create App Snapshot: E-Commerce v2.1
   - Records all service versions across all machines
   - Can restore this exact state later
```

---

## UI/UX Design

### 1. Service Version History (Service Detail Panel)

When viewing a service, the Versions tab shows:

```
┌─────────────────────────────────────────────────────────────────┐
│ ← E-Commerce │ 🔧 api-server                               ✕   │
├─────────────────────────────────────────────────────────────────┤
│ [Config] [Logs] [Metrics] [Versions]                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Machine: prod-vm-1    Type: process    Status: ● Running      │
│                                                                 │
│  Current Version: v1.5.1                    [Create Version]    │
│                                                                 │
│  Version History:                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Version │ Date       │ Author  │ Status   │ Actions     │   │
│  ├─────────┼────────────┼─────────┼──────────┼─────────────┤   │
│  │ v1.5.1  │ Jan 30     │ John    │ ● Active │ 📋 ↩️        │   │
│  │ v1.5.0  │ Jan 28     │ Jane    │          │ 📋 ↩️        │   │
│  │ v1.4.2  │ Jan 25     │ John    │          │ 📋 ↩️        │   │
│  │ v1.4.1  │ Jan 20     │ System  │          │ 📋 ↩️        │   │
│  │ v1.4.0  │ Jan 15     │ Jane    │ ○ Rolled │ 📋 ↩️        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📋 = View diff    ↩️ = Rollback to this version               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Version Diff View

```
┌─────────────────────────────────────────────────────────────────┐
│ Compare: v1.5.0 → v1.5.1                                   ✕   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Service: api-server                                            │
│  Machine: prod-vm-1                                             │
│  Changed by: John D. on Jan 30, 2026                           │
│  Message: "Fixed memory leak in connection pool"                │
│                                                                 │
│  ┌─ Configuration Changes ─────────────────────────────────┐   │
│  │                                                          │   │
│  │  Arguments:                                              │   │
│  │  - server.js --port 3000                                 │   │
│  │  + server.js --port 3000 --max-connections 100          │   │
│  │                                                          │   │
│  │  Environment Variables:                                  │   │
│  │  + POOL_SIZE = 50                                        │   │
│  │  ~ LOG_LEVEL: debug → info                               │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Legend: + Added  - Removed  ~ Modified                         │
│                                                                 │
│                          [Close]  [↩️ Rollback to v1.5.0]       │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Rollback Confirmation

```
┌───────────────────────────────────────────────────────┐
│ ⚠️ Rollback Service                              ✕    │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Service:  api-server                                 │
│  Machine:  prod-vm-1                                  │
│  Current:  v1.5.1                                     │
│  Target:   v1.5.0                                     │
│                                                       │
│  This will:                                           │
│  • Stop the service on prod-vm-1                      │
│  • Restore configuration from v1.5.0                  │
│  • Restart the service                                │
│                                                       │
│  ⚠️ Other services will NOT be affected.              │
│                                                       │
│  ☑️ Create backup version before rollback             │
│                                                       │
│              [Cancel]  [⚠️ Rollback to v1.5.0]        │
└───────────────────────────────────────────────────────┘
```

---

### 4. App Snapshots (App Detail Panel)

Access from App → Versions tab:

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Apps │ 📱 E-Commerce                                         │
├─────────────────────────────────────────────────────────────────┤
│ [Overview] [Services] [Config] [Variables] [Logs] [Versions]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  App Snapshots                              [📸 Create Snapshot]│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Snapshot         │ Date       │ Services          │     │   │
│  ├───────────────────┼────────────┼───────────────────┼─────┤   │
│  │ v2.1-production   │ Jan 30     │ 6 services        │ 👁️ ↩️│   │
│  │                   │            │ across 2 machines │     │   │
│  ├───────────────────┼────────────┼───────────────────┼─────┤   │
│  │ v2.0-stable       │ Jan 15     │ 6 services        │ 👁️ ↩️│   │
│  │                   │            │ across 2 machines │     │   │
│  ├───────────────────┼────────────┼───────────────────┼─────┤   │
│  │ v1.9-before-refac │ Dec 20     │ 5 services        │ 👁️ ↩️│   │
│  │                   │            │ across 1 machine  │     │   │
│  └───────────────────┴────────────┴───────────────────┴─────┘   │
│                                                                 │
│  👁️ = View details    ↩️ = Restore entire app to snapshot      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Snapshot Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│ Snapshot: v2.1-production                                  ✕   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  App: E-Commerce                                                │
│  Created: Jan 30, 2026 by John D.                              │
│  Description: "Production release with payment fix"             │
│                                                                 │
│  Services in snapshot:                                          │
│  ┌──────────────┬─────────┬────────────┬─────────┬──────────┐  │
│  │ Service      │ Version │ Machine    │ Current │ Status   │  │
│  ├──────────────┼─────────┼────────────┼─────────┼──────────┤  │
│  │ api-server   │ v1.5.1  │ prod-vm-1  │ v1.5.1  │ ✓ Same   │  │
│  │ worker-queue │ v4.0.0  │ prod-vm-1  │ v4.0.0  │ ✓ Same   │  │
│  │ websocket    │ v2.1.0  │ prod-vm-1  │ v2.2.0  │ ⚠️ Diff  │  │
│  │ web-ui       │ v4.0.0  │ prod-vm-1  │ v4.1.0  │ ⚠️ Diff  │  │
│  │ postgres     │ v15.0   │ prod-vm-2  │ v15.0   │ ✓ Same   │  │
│  │ redis        │ v7.0    │ prod-vm-2  │ v7.0    │ ✓ Same   │  │
│  └──────────────┴─────────┴────────────┴─────────┴──────────┘  │
│                                                                 │
│  ⚠️ 2 services have changed since this snapshot                 │
│                                                                 │
│       [Close]  [↩️ Restore All Services to This Snapshot]       │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Create Snapshot Modal

```
┌───────────────────────────────────────────────────────┐
│ 📸 Create App Snapshot                           ✕    │
├───────────────────────────────────────────────────────┤
│                                                       │
│  App: E-Commerce                                      │
│                                                       │
│  Snapshot Name:                                       │
│  [v2.2-hotfix                                    ]    │
│                                                       │
│  Description:                                         │
│  [Fixed critical payment gateway timeout issue   ]    │
│                                                       │
│  Services to include:                                 │
│                                                       │
│  prod-vm-1:                                           │
│  ☑️ api-server       (v1.5.1)                         │
│  ☑️ worker-queue     (v4.0.0)                         │
│  ☑️ websocket        (v2.2.0)                         │
│  ☑️ web-ui           (v4.1.0)                         │
│                                                       │
│  prod-vm-2:                                           │
│  ☑️ postgres         (v15.0)                          │
│  ☑️ redis            (v7.0)                           │
│                                                       │
│  ☑️ Include sub-apps (if any)                         │
│                                                       │
│                    [Cancel]  [📸 Create Snapshot]     │
└───────────────────────────────────────────────────────┘
```

### 7. Restore Snapshot Confirmation

```
┌───────────────────────────────────────────────────────┐
│ ⚠️ Restore App Snapshot                          ✕    │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Restore E-Commerce to: v2.1-production               │
│                                                       │
│  This will restore 2 services that have changed:      │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Service      │ Machine     │ Current → Target   │ │
│  ├──────────────┼─────────────┼────────────────────┤ │
│  │ websocket    │ prod-vm-1   │ v2.2.0 → v2.1.0    │ │
│  │ web-ui       │ prod-vm-1   │ v4.1.0 → v4.0.0    │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Services will be stopped and restarted.              │
│                                                       │
│  ☑️ Create backup snapshot before restore             │
│                                                       │
│              [Cancel]  [⚠️ Restore Snapshot]          │
└───────────────────────────────────────────────────────┘
```

---

## Technical Design

### Database Schema

```sql
-- Service versions
CREATE TABLE ServiceVersions (
  Id INTEGER PRIMARY KEY,
  ServiceId INTEGER NOT NULL,
  Version VARCHAR(50),         -- v1.5.0
  ConfigSnapshot TEXT,         -- JSON: full service config at this version
  DeployedBy VARCHAR(100),
  DeployedAt DATETIME,
  Changelog TEXT,
  Status VARCHAR(20),          -- 'active', 'inactive', 'rolled-back'
  
  FOREIGN KEY (ServiceId) REFERENCES Services(Id)
);

-- App snapshots (atomic versions)
CREATE TABLE AppSnapshots (
  Id INTEGER PRIMARY KEY,
  AppId INTEGER NOT NULL,
  Version VARCHAR(50),         -- v2.0
  Name VARCHAR(255),           -- "Production Release 2024-01"
  Description TEXT,
  CreatedBy VARCHAR(100),
  CreatedAt DATETIME,
  
  FOREIGN KEY (AppId) REFERENCES Apps(Id)
);

-- Snapshot-Service mapping (which service versions in snapshot)
CREATE TABLE AppSnapshotServices (
  AppSnapshotId INTEGER NOT NULL,
  ServiceId INTEGER NOT NULL,
  ServiceVersionId INTEGER NOT NULL,
  MachineId INTEGER NOT NULL,  -- Machine at time of snapshot
  
  PRIMARY KEY (AppSnapshotId, ServiceId),
  
  FOREIGN KEY (AppSnapshotId) REFERENCES AppSnapshots(Id),
  FOREIGN KEY (ServiceId) REFERENCES Services(Id),
  FOREIGN KEY (ServiceVersionId) REFERENCES ServiceVersions(Id),
  FOREIGN KEY (MachineId) REFERENCES Machines(Id)
);
```

### API Endpoints

```
-- Service versions
GET    /api/services/:id/versions              - Service version history
POST   /api/services/:id/versions              - Create service version
GET    /api/services/:id/versions/:verId       - Get version details
GET    /api/services/:id/versions/:verId/diff  - Diff with current
POST   /api/services/:id/rollback/:verId       - Rollback service

-- App snapshots
GET    /api/apps/:id/snapshots                 - List app snapshots
POST   /api/apps/:id/snapshots                 - Create snapshot
GET    /api/apps/:id/snapshots/:snapId         - Snapshot details
GET    /api/apps/:id/snapshots/:snapId/compare - Compare with current
POST   /api/apps/:id/snapshots/:snapId/restore - Restore entire app
DELETE /api/apps/:id/snapshots/:snapId         - Delete snapshot
```

---

## Implementation Phases

### Dependency

This feature depends on:
- **008: Machines, Apps & Services** (Services must exist)
- **007: App Versioning** (Versioning foundation - Phase 4)

```
Phase 4                  Phase 5
┌─────────────┐         ┌──────────────────┐
│ 007 App     │────────→│ 009 Service      │
│ Versioning  │         │     Versioning   │
└─────────────┘         └────────┬─────────┘
                                 │
┌─────────────┐                  │
│ 008 Machines│──────────────────┘
│ Apps Svc    │
└─────────────┘
```

### Task Breakdown

| Task | Effort | Notes |
|------|--------|-------|
| ServiceVersions table + migration | 1 day | |
| Service version CRUD API | 2 days | |
| Auto-version on config save | 1 day | Optional feature |
| Version diff calculation | 1 day | |
| Granular rollback (single service) | 2 days | Handle remote machines |
| AppSnapshots table + migration | 1 day | |
| Snapshot CRUD API | 2 days | |
| Snapshot restore (all services) | 2 days | Cross-machine restore |
| Service version history UI | 1 day | |
| Diff viewer component | 1 day | |
| Snapshot management UI | 1 day | |
| Restore confirmation UI | 0.5 day | |

**Total: 2-3 weeks**

---

## UX Design Decisions

### Open Questions

| # | Question | Options | Decision |
|---|----------|---------|----------|
| 1 | Auto-version on config change? | A) Always B) Prompt user C) Manual only | TBD |
| 2 | Version naming convention? | A) Semantic (v1.2.3) B) Date-based C) Custom | TBD |
| 3 | Max versions to keep? | A) Unlimited B) Per service limit C) Global limit | TBD |
| 4 | Rollback behavior? | A) Stop→Restore→Start B) Hot swap C) User choice | TBD |
| 5 | Cross-machine restore order? | A) All parallel B) By machine C) By dependency | TBD |

---

## Workflow Scenarios

### Scenario 1: Quick Fix Rollback (Single Service)

```
1. Notice api-server has errors on prod-vm-1
2. Open E-Commerce → Services → api-server → Versions
3. See v1.5.0 was working yesterday
4. Click ↩️ Rollback → Confirm
5. Service restored on prod-vm-1 in ~5 seconds
6. Other services on both machines unaffected
```

### Scenario 2: Full App Restore (Multi-Machine)

```
1. Multiple services have issues after deploy
2. Open E-Commerce → Versions → Snapshots
3. Find last known good snapshot (v2.0-stable)
4. Click ↩️ Restore All
5. System restores:
   - 4 services on prod-vm-1
   - 2 services on prod-vm-2
6. App back to exact previous state
```

### Scenario 3: Pre-deployment Snapshot

```
1. About to deploy major update
2. Create snapshot "v2.1-before-deploy"
3. Deploy new versions across machines
4. If issues → Restore to snapshot
5. If success → Create new snapshot "v2.2-post-deploy"
```

---

## Dependencies

- **Required:** 008 Machines, Apps & Services (services must exist)
- **Required:** 007 App Versioning (versioning foundation)

## Related Features

- **Builds on:** 007 App Versioning
- **Works with:** 006 Container Support (version container images per service)

---

For complete details, see the [full service versioning spec](../../spec/009-service-versioning/spec.md).
