# 008: Machines, Apps & Services

**Status:** 📋 Spec Ready (0% Complete)  
**Phase:** 5 - Hierarchy & Organization  
**Priority:** 🔴 CRITICAL  
**Effort:** 3-4 weeks  
**Original Spec:** [../spec/008-hierarchical-apps/spec.md](../../spec/008-hierarchical-apps/spec.md)

---

## Summary

Introduce a dual-perspective architecture where users can view their system either by **Machines** (infrastructure view) or by **Apps** (logical view). Services can be processes, containers, or pods running on any machine.

## Core Concepts

| Concept | Definition | Example |
|---------|------------|---------|
| **Machine** | Physical/virtual server where services run | `prod-vm-1`, `localhost`, `aws-ec2-xyz` |
| **App** | Logical grouping of services | `E-Commerce`, `CRM`, `Analytics` |
| **Service** | Running thing (process \| container \| pod) | `node server.js`, `docker:nginx`, `pod:api` |
| **Group** | Optional tag for organizing apps | `Production`, `Staging`, `Databases` |

### Key Principles

1. **Services run on Machines** — A service is always tied to a specific machine
2. **Apps contain Services** — An app groups services that form a logical application
3. **Apps span Machines** — An app's services can run on multiple machines
4. **Groups are filters** — Groups help organize, not structure
5. **Sub-apps are optional** — Apps can nest for complex systems

---

## Dual View Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  [🖥️ Machines View]    [📱 Apps View]                          │
└─────────────────────────────────────────────────────────────────┘

MACHINES VIEW                      APPS VIEW
─────────────────                  ─────────────────
Infrastructure perspective         Logical perspective
"Where are things running?"        "What applications do I have?"

┌─────────┐ ┌─────────┐           ┌─────────┐ ┌─────────┐
│ VM-1    │ │ VM-2    │           │ E-Comm  │ │ CRM     │
│ ● 5 svc │ │ ● 3 svc │           │ ● 8 svc │ │ ● 4 svc │
│ 45% CPU │ │ 23% CPU │           │ Running │ │ Partial │
└─────────┘ └─────────┘           └─────────┘ └─────────┘
```

---

## Key Features ⬜

### 1. Machines Management (1 week)
- ⬜ Register local machine automatically
- ⬜ Add remote machines (SSH/agent-based)
- ⬜ Machine health monitoring (CPU, RAM, disk)
- ⬜ Machine status (online, offline, degraded)
- ⬜ List services running on each machine

### 2. Services (Running Things) (1 week)
- ⬜ Service types: process, container, pod
- ⬜ Service belongs to an App AND a Machine
- ⬜ Service lifecycle: start, stop, restart
- ⬜ Service status and metrics
- ⬜ Service logs (unified across types)

### 3. Apps (Logical Grouping) (1 week)
- ⬜ Apps group related services
- ⬜ Apps can contain sub-apps (optional nesting)
- ⬜ App-level start/stop (cascade to all services)
- ⬜ App status aggregation (3/5 running)
- ⬜ App-level configuration & variables

### 4. Groups (Tags/Filters) (3 days)
- ⬜ Create groups: Production, Staging, Dev
- ⬜ Create groups: Databases, Web Servers, Workers
- ⬜ Assign apps to groups (many-to-many)
- ⬜ Filter apps by group in UI
- ⬜ Hierarchical groups (optional)

### 5. Variable Inheritance (3 days)
- ⬜ Groups define variables (NODE_ENV=production)
- ⬜ Apps inherit from groups
- ⬜ Apps override/add variables
- ⬜ Services inherit from apps
- ⬜ Services can override locally

---

## UI/UX Design

### 1. View Toggle (Header)

```
┌─────────────────────────────────────────────────────────────────┐
│  MiniCluster                   [🖥️ Machines] [📱 Apps]  👤 User │
└─────────────────────────────────────────────────────────────────┘
```

User toggles between infrastructure and application views.

---

### 2. Machines View

**Machine Cards:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 🖥️ Machines                                    [+ Add Machine]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  │ 🖥️ prod-vm-1     │  │ 🖥️ prod-vm-2     │  │ 🖥️ localhost     │
│  │ ● Online         │  │ ● Online         │  │ ● Online         │
│  │                  │  │                  │  │                  │
│  │ CPU  ━━━━━ 45%   │  │ CPU  ━━━   23%   │  │ CPU  ━━    12%   │
│  │ RAM  ━━━━  8/16G │  │ RAM  ━━   4/8G   │  │ RAM  ━    2/4G   │
│  │ Disk ━━━   120G  │  │ Disk ━━    60G   │  │ Disk ━     30G   │
│  │                  │  │                  │  │                  │
│  │ 🔧 5 services    │  │ 🔧 3 services    │  │ 🔧 2 services    │
│  │                  │  │                  │  │                  │
│  │ [View Services]  │  │ [View Services]  │  │ [View Services]  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Machine Detail (Click on Machine):**
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Machines │ 🖥️ prod-vm-1                                      │
├─────────────────────────────────────────────────────────────────┤
│ [Overview] [Services] [Metrics] [Terminal]                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Status: ● Online    IP: 192.168.1.10    OS: Ubuntu 22.04      │
│                                                                 │
│  ┌─ Resources ─────────────────────────────────────────────┐   │
│  │ CPU:  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 45%    │   │
│  │ RAM:  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 8.2GB / 16GB  │   │
│  │ Disk: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 120GB / 250GB        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Services on this machine:                                      │
│  ┌────────────────┬──────────┬─────────────┬───────┬────────┐  │
│  │ Service        │ App      │ Status      │ CPU   │ Actions│  │
│  ├────────────────┼──────────┼─────────────┼───────┼────────┤  │
│  │ api-server     │ E-Comm   │ ● Running   │ 12%   │ ■ ⟳ 📋│  │
│  │ worker-1       │ E-Comm   │ ● Running   │ 8%    │ ■ ⟳ 📋│  │
│  │ worker-2       │ E-Comm   │ ● Running   │ 7%    │ ■ ⟳ 📋│  │
│  │ crm-api        │ CRM      │ ● Running   │ 5%    │ ■ ⟳ 📋│  │
│  │ crm-worker     │ CRM      │ ○ Stopped   │ 0%    │ ▶ ⟳ 📋│  │
│  └────────────────┴──────────┴─────────────┴───────┴────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. Apps View

**App Cards:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📱 Apps                              [Groups ▾]  [+ Create App] │
├─────────────────────────────────────────────────────────────────┤
│ Groups: [All] [Production] [Staging] [Databases]                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  │ 📱 E-Commerce    │  │ 📱 CRM System    │  │ 📱 Analytics     │
│  │ ● 6/8 Running    │  │ ● 4/4 Running    │  │ ○ Stopped        │
│  │                  │  │                  │  │                  │
│  │ 🖥️ 2 machines    │  │ 🖥️ 1 machine     │  │ 🖥️ 1 machine     │
│  │                  │  │                  │  │                  │
│  │ Services:        │  │ Services:        │  │ Services:        │
│  │ api, worker x2   │  │ api, worker,     │  │ collector,       │
│  │ postgres, redis  │  │ scheduler, db    │  │ dashboard        │
│  │                  │  │                  │  │                  │
│  │ [▶ Start] [■] [⚙]│  │ [■ Stop] [⟳] [⚙]│  │ [▶ Start] [⚙]   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ 📱 Monitoring    │  │ 📱 Auth Service  │                     │
│  │ ◐ 1/2 Running    │  │ ● 2/2 Running    │                     │
│  │                  │  │                  │                     │
│  │ 🖥️ 1 machine     │  │ 🖥️ 2 machines    │                     │
│  │                  │  │                  │                     │
│  │ Services:        │  │ Services:        │                     │
│  │ prometheus,      │  │ auth-api,        │                     │
│  │ grafana          │  │ auth-db          │                     │
│  │                  │  │                  │                     │
│  │ [▶ Start] [■] [⚙]│  │ [■ Stop] [⟳] [⚙]│                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**App Detail (Click on App Card) — Similar to Current UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Apps │ 📱 E-Commerce                   [▶ Start All] [■ Stop] │
├─────────────────────────────────────────────────────────────────┤
│ [Overview] [Services] [Config] [Variables] [Logs] [Versions]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Status: 6/8 services running                                   │
│  Groups: Production, Web                                        │
│                                                                 │
│  Services:                                                      │
│  ┌────────────────┬──────────┬────────────┬───────┬─────────┐  │
│  │ Name           │ Type     │ Machine    │Status │ Actions │  │
│  ├────────────────┼──────────┼────────────┼───────┼─────────┤  │
│  │ api-server     │ process  │ prod-vm-1  │● Run  │ ■ ⟳ 📋 │  │
│  │ worker-1       │ process  │ prod-vm-1  │● Run  │ ■ ⟳ 📋 │  │
│  │ worker-2       │ process  │ prod-vm-1  │○ Stop │ ▶ ⟳ 📋 │  │
│  │ websocket      │ process  │ prod-vm-1  │○ Stop │ ▶ ⟳ 📋 │  │
│  │ postgres       │ container│ prod-vm-2  │● Run  │ ■ ⟳ 📋 │  │
│  │ redis          │ container│ prod-vm-2  │● Run  │ ■ ⟳ 📋 │  │
│  │ web-ui         │ process  │ prod-vm-1  │● Run  │ ■ ⟳ 📋 │  │
│  │ nginx          │ container│ prod-vm-2  │● Run  │ ■ ⟳ 📋 │  │
│  └────────────────┴──────────┴────────────┴───────┴─────────┘  │
│                                                                 │
│  Sub-apps (optional):                                           │
│  ┌────────────────┬───────────────┬─────────────────────────┐  │
│  │ 📁 backend     │ 4 services    │ api, worker-1, worker-2 │  │
│  │ 📁 frontend    │ 2 services    │ web-ui, nginx           │  │
│  │ 📁 data        │ 2 services    │ postgres, redis         │  │
│  └────────────────┴───────────────┴─────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. Add Service Modal

```
┌───────────────────────────────────────────────────────┐
│ Add Service to E-Commerce                        ✕    │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Name:         [cache-worker                    ]     │
│                                                       │
│  Type:         ( ) Process                            │
│                (●) Container                          │
│                ( ) Pod                                │
│                                                       │
│  Machine:      [prod-vm-2                       ▾]    │
│                                                       │
│  ┌─ Container Config ─────────────────────────────┐  │
│  │ Image:      [redis:7-alpine                   ]│  │
│  │ Ports:      [6380:6379                        ]│  │
│  │ Volumes:    [/data/cache:/data                ]│  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  Sub-app:      [None (root level)              ▾]    │
│                ├── None (root level)                  │
│                ├── backend                            │
│                ├── frontend                           │
│                └── data                               │
│                                                       │
│  Environment Variables:                               │
│  ┌────────────────────────────────────────────────┐  │
│  │ REDIS_PORT = 6380                         [🗑️] │  │
│  │ [+ Add Variable]                               │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  ☑️ Inherit variables from app                        │
│  ☐ Auto-start with app                               │
│                                                       │
│                    [Cancel]  [Add Service]            │
└───────────────────────────────────────────────────────┘
```

---

### 5. Add Machine Modal

```
┌───────────────────────────────────────────────────────┐
│ Add Machine                                      ✕    │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Name:         [staging-vm-1                    ]     │
│                                                       │
│  Connection:   (●) SSH                                │
│                ( ) Agent (install MiniCluster agent)  │
│                ( ) Local (this machine)               │
│                                                       │
│  ┌─ SSH Config ───────────────────────────────────┐  │
│  │ Host:       [192.168.1.50                     ]│  │
│  │ Port:       [22                               ]│  │
│  │ Username:   [deploy                           ]│  │
│  │ Auth:       (●) SSH Key  ( ) Password          │  │
│  │ Key Path:   [~/.ssh/id_rsa               ] [📁]│  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  Groups:       [Staging, Web Servers            ▾]   │
│                                                       │
│                [Cancel]  [Test Connection]  [Add]    │
└───────────────────────────────────────────────────────┘
```

---

### 6. Group Management (Sidebar or Modal)

```
┌───────────────────────────────────────────────────────┐
│ Manage Groups                                    ✕    │
├───────────────────────────────────────────────────────┤
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ Group           │ Apps │ Actions               │  │
│  ├─────────────────┼──────┼───────────────────────┤  │
│  │ 🌐 Production   │ 3    │ ✏️ 🗑️                 │  │
│  │ 🧪 Staging      │ 2    │ ✏️ 🗑️                 │  │
│  │ 💻 Development  │ 5    │ ✏️ 🗑️                 │  │
│  │ ─────────────── │      │                       │  │
│  │ 🔧 Databases    │ 4    │ ✏️ 🗑️                 │  │
│  │ 🌐 Web Servers  │ 3    │ ✏️ 🗑️                 │  │
│  │ ⚙️ Workers      │ 6    │ ✏️ 🗑️                 │  │
│  └─────────────────┴──────┴───────────────────────┘  │
│                                                       │
│  [+ Add Group]                                        │
│                                                       │
│  Note: Groups are tags. An app can belong to         │
│  multiple groups (e.g., "Production" + "Databases")  │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

### 7. Cascade Start/Stop Modal

When user clicks "Start All" on an App:

```
┌───────────────────────────────────────────────────────┐
│ Start E-Commerce                                 ✕    │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Starting 8 services...                                │
│                                                       │
│ ✅ postgres         prod-vm-2    Started (2.1s)       │
│ ✅ redis            prod-vm-2    Started (0.8s)       │
│ ✅ api-server       prod-vm-1    Started (3.2s)       │
│ ⏳ worker-1         prod-vm-1    Starting...          │
│ ○  worker-2         prod-vm-1    Waiting...           │
│ ○  websocket        prod-vm-1    Waiting...           │
│ ○  web-ui           prod-vm-1    Waiting...           │
│ ○  nginx            prod-vm-2    Waiting...           │
│                                                       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 40%              │
│                                                       │
│ Start order: (●) Sequential (respect dependencies)    │
│              ( ) Parallel (all at once)               │
│                                                       │
│                                        [Cancel]       │
└───────────────────────────────────────────────────────┘
```

---

## Technical Design

### Database Schema

```sql
-- Machines table (new)
CREATE TABLE Machines (
  Id INTEGER PRIMARY KEY,
  Name VARCHAR(255) NOT NULL,
  Host VARCHAR(255),           -- IP or hostname
  Port INT DEFAULT 22,
  ConnectionType VARCHAR(20),  -- 'local', 'ssh', 'agent'
  SshUsername VARCHAR(100),
  SshKeyPath VARCHAR(500),
  Status VARCHAR(20),          -- 'online', 'offline', 'degraded'
  LastSeen DATETIME,
  Metadata TEXT,               -- JSON: OS, CPU cores, RAM, etc.
  CreatedAt DATETIME,
  UpdatedAt DATETIME
);

-- Apps table (modify existing)
ALTER TABLE Apps ADD ParentAppId INTEGER;     -- For sub-apps
ALTER TABLE Apps ADD IsComposite BOOLEAN DEFAULT 0;
ALTER TABLE Apps ADD OrderIndex INT DEFAULT 0;

-- Services table (new - replaces process info in Apps)
CREATE TABLE Services (
  Id INTEGER PRIMARY KEY,
  AppId INTEGER NOT NULL,
  MachineId INTEGER NOT NULL,
  Name VARCHAR(255) NOT NULL,
  Type VARCHAR(20) NOT NULL,   -- 'process', 'container', 'pod'
  
  -- Process config
  ExecutablePath VARCHAR(1024),
  Arguments TEXT,
  WorkingDirectory VARCHAR(1024),
  
  -- Container config
  Image VARCHAR(500),
  ContainerName VARCHAR(255),
  Ports TEXT,                  -- JSON: ["8080:80", "443:443"]
  Volumes TEXT,                -- JSON: ["/host:/container"]
  
  -- Common
  EnvironmentVariables TEXT,   -- JSON
  Status VARCHAR(20),          -- 'running', 'stopped', 'error', 'starting'
  ProcessId INT,
  ContainerId VARCHAR(100),
  OrderIndex INT DEFAULT 0,
  
  CreatedAt DATETIME,
  UpdatedAt DATETIME,
  
  FOREIGN KEY (AppId) REFERENCES Apps(Id),
  FOREIGN KEY (MachineId) REFERENCES Machines(Id)
);

-- Groups table (new)
CREATE TABLE Groups (
  Id INTEGER PRIMARY KEY,
  Name VARCHAR(255) NOT NULL,
  Description TEXT,
  Icon VARCHAR(50),            -- Emoji or icon name
  Color VARCHAR(20),           -- Hex color
  ParentGroupId INTEGER,       -- Optional hierarchy
  OrderIndex INT DEFAULT 0,
  
  FOREIGN KEY (ParentGroupId) REFERENCES Groups(Id)
);

-- App-Group many-to-many
CREATE TABLE AppGroups (
  AppId INTEGER NOT NULL,
  GroupId INTEGER NOT NULL,
  PRIMARY KEY (AppId, GroupId),
  
  FOREIGN KEY (AppId) REFERENCES Apps(Id),
  FOREIGN KEY (GroupId) REFERENCES Groups(Id)
);

-- Group variables (inherited by apps in group)
CREATE TABLE GroupVariables (
  Id INTEGER PRIMARY KEY,
  GroupId INTEGER NOT NULL,
  Key VARCHAR(255) NOT NULL,
  Value TEXT,
  IsSecret BOOLEAN DEFAULT 0,
  
  FOREIGN KEY (GroupId) REFERENCES Groups(Id)
);
```

### API Endpoints

```
-- Machines
GET    /api/machines                    - List all machines
POST   /api/machines                    - Add machine
GET    /api/machines/:id                - Get machine details
PUT    /api/machines/:id                - Update machine
DELETE /api/machines/:id                - Remove machine
GET    /api/machines/:id/services       - List services on machine
GET    /api/machines/:id/metrics        - Get machine metrics
POST   /api/machines/:id/test           - Test connection

-- Apps (enhanced)
GET    /api/apps                        - List all apps (flat or tree)
POST   /api/apps                        - Create app
GET    /api/apps/:id                    - Get app with services
PUT    /api/apps/:id                    - Update app
DELETE /api/apps/:id                    - Delete app
POST   /api/apps/:id/start              - Start all services
POST   /api/apps/:id/stop               - Stop all services
POST   /api/apps/:id/restart            - Restart all services
GET    /api/apps/:id/status             - Aggregated status

-- Services
GET    /api/services                    - List all services
POST   /api/apps/:appId/services        - Add service to app
GET    /api/services/:id                - Get service details
PUT    /api/services/:id                - Update service
DELETE /api/services/:id                - Delete service
POST   /api/services/:id/start          - Start service
POST   /api/services/:id/stop           - Stop service
POST   /api/services/:id/restart        - Restart service
GET    /api/services/:id/logs           - Get service logs
GET    /api/services/:id/metrics        - Get service metrics

-- Groups
GET    /api/groups                      - List all groups
POST   /api/groups                      - Create group
PUT    /api/groups/:id                  - Update group
DELETE /api/groups/:id                  - Delete group
POST   /api/apps/:appId/groups/:groupId - Assign app to group
DELETE /api/apps/:appId/groups/:groupId - Remove app from group
GET    /api/groups/:id/variables        - Get group variables
PUT    /api/groups/:id/variables        - Set group variables
```

---

## Implementation Phases

### Substage Breakdown

```
5a: Core Foundation (Machines + Services)
 │
 ├──→ 5b: Apps Enhancement (sub-apps, cascade)
 │
 ├──→ 5c: Groups & Variables
 │
 └──→ 5d: UI (Dual View)
```

### 5a: Core Foundation (1.5 weeks)

| Task | Effort | Notes |
|------|--------|-------|
| Machines table + migration | 1 day | |
| Machines CRUD API | 2 days | |
| Local machine auto-registration | 1 day | |
| SSH connection handling | 2 days | |
| Services table + migration | 1 day | Replaces process fields in Apps |
| Services CRUD API | 2 days | |
| Service lifecycle (start/stop) | 2 days | Handle process + container |

### 5b: Apps Enhancement (1 week)

| Task | Effort | Notes |
|------|--------|-------|
| Sub-apps (ParentAppId) | 2 days | Optional nesting |
| Cascade start/stop | 2 days | Start all services in app |
| Start order (dependencies) | 1 day | Sequential or parallel |
| App status aggregation | 1 day | "3/5 running" |

### 5c: Groups & Variables (3-4 days)

| Task | Effort | Notes |
|------|--------|-------|
| Groups table + CRUD | 1 day | |
| App-Group assignments | 1 day | Many-to-many |
| Group variables | 1 day | |
| Variable inheritance | 1 day | Group → App → Service |

### 5d: UI (1 week)

| Task | Effort | Notes |
|------|--------|-------|
| View toggle (Machines/Apps) | 0.5 day | |
| Machines view (cards + detail) | 2 days | |
| Apps view (cards + detail) | 2 days | Enhance existing |
| Add Service modal (all types) | 1 day | |
| Add Machine modal | 0.5 day | |
| Group management UI | 1 day | |
| Cascade modal | 0.5 day | |

**Total: 3-4 weeks**

---

## UX Design Decisions

### Open Questions

| # | Question | Options | Decision |
|---|----------|---------|----------|
| 1 | Default view on login? | A) Machines B) Apps C) Last used D) User preference | TBD |
| 2 | App card info density? | A) Minimal (name + status) B) Medium (+ machine count) C) Full (+ service list) | TBD |
| 3 | Sub-apps display? | A) Always show B) Expandable C) Separate tab | TBD |
| 4 | Group assignment UI? | A) Dropdown in app edit B) Drag to group C) Tag input | TBD |
| 5 | Service type icons? | A) 📦 ⚙️ 🔷 (process/container/pod) B) Colors only C) None | TBD |

### Status Indicators

| Status | Icon | Color | Description |
|--------|------|-------|-------------|
| All Running | ● | Green (#22c55e) | All services healthy |
| Partial | ◐ | Yellow (#eab308) | Some services running |
| All Stopped | ○ | Gray (#6b7280) | All services stopped |
| Error | ● | Red (#ef4444) | One or more services failed |
| Starting | ⏳ | Blue (#3b82f6) | Services starting up |
| Machine Online | ● | Green | Machine reachable |
| Machine Offline | ● | Red | Machine unreachable |
| Machine Degraded | ◐ | Yellow | Machine has issues |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `1` | Switch to Machines view |
| `2` | Switch to Apps view |
| `Ctrl+N` | Create new (app/machine based on view) |
| `Ctrl+S` | Start selected |
| `Ctrl+X` | Stop selected |
| `Ctrl+R` | Restart selected |
| `/` | Focus search |
| `g` | Open groups filter |

---

## Migration Strategy

### Existing Apps

Current apps (which are individual processes) will be migrated as:
- Create a default "localhost" Machine
- Convert App → App with one Service
- Service inherits process config from old App

```
Before:                     After:
App (api-server)    →      App (api-server)
  - executable              └── Service (api-server)
  - args                        - executable
  - workingDir                  - args
                                - Machine: localhost
```

### Breaking Changes

**None.** All changes are additive:
- Old apps work as single-service apps
- Machines view is new
- Groups are optional
- Sub-apps are optional

---

## Dependencies

- **None** (foundational feature)

## Related Features

- **Required by:** 009 Service-Level Versioning
- **Required by:** 011 Cron Scheduling  
- **Enhanced by:** 006 Container Support (service type: container)
- **Enhanced by:** Phase 6 Distribution (remote machines)

---

For complete details, see the [full hierarchical apps spec](../../spec/008-hierarchical-apps/spec.md).
