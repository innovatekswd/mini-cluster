# 014: App Update Manager & Staged Rollouts

**Status:** 📋 Spec Ready (0% Complete)  
**Phase:** 8 - Intelligence  
**Priority:** ⚪ LOW  
**Effort:** 8 weeks  
**Original Spec:** [../spec/014-app-update-manager/spec.md](../../spec/014-app-update-manager/spec.md)

---

## Summary

Built-in update manager for safe, auditable, and zero-downtime updates across single or multiple machines. Updates are staged in a central registry, planned, and rolled out with health checks, rollback, and full audit logging. **Enterprise-grade deployment safety.**

## Key Features ⬜

### 1. Update Store/Registry (2 weeks)
- ⬜ **Central registry** - Store all update packages
- ⬜ **Package storage** - Binaries, configs, manifests
- ⬜ **Metadata** - Version, changelog, target apps, dependencies
- ⬜ **Multi-version support** - Keep multiple versions available
- ⬜ **Artifact checksums** - Verify integrity
- ⬜ **Upload/download** - Package management

### 2. Planned & Targeted Rollouts (2 weeks)
- ⬜ **Target selection** - Specific machines, groups, or all
- ⬜ **Scheduling** - Plan updates for maintenance windows
- ⬜ **Approval workflows** - Require approval before deployment
- ⬜ **Progressive rollout** - 5% → 25% → 50% → 100%
- ⬜ **Pause/resume** - Halt rollout, resume later
- ⬜ **Batch size** - Update N machines at a time

### 3. Staged & Safe Deployment (2 weeks)
- ⬜ **Download & stage** - Prepare update without applying
- ⬜ **Blue/green deployment** - New version on different port/process
- ⬜ **Health checks** - Validate before switching
- ⬜ **Traffic switching** - Cut over to new version
- ⬜ **Automatic rollback** - Revert if health checks fail
- ⬜ **Canary deployment** - Test on subset first

### 4. Audit & Change Log (1 week)
- ⬜ **Immutable log** - Every update action recorded
- ⬜ **Who, what, when** - User, action, timestamp
- ⬜ **Success/failure status** - Outcome of each update
- ⬜ **Queryable history** - Search and filter logs
- ⬜ **Exportable reports** - For compliance/audit
- ⬜ **Change notifications** - Email, Slack, Teams

### 5. Manual & Automatic Triggers (1 week)
- ⬜ **Manual triggers** - Admin initiates update
- ⬜ **Scheduled triggers** - Run at specific time
- ⬜ **Policy-based triggers** - Auto-update after X% success
- ⬜ **Git webhooks** - Auto-deploy on push
- ⬜ **CI/CD integration** - Trigger from Jenkins, GitHub Actions

## Why This Matters

**Without Update Manager:**
- ❌ Updates are risky, can cause downtime
- ❌ Hard to coordinate across many machines
- ❌ No audit trail of changes
- ❌ Rollback is manual and error-prone
- ❌ Can't meet compliance requirements

**With Update Manager:**
- ✅ Staged, health-checked, reversible rollouts
- ✅ Central registry, planned/scheduled deployments
- ✅ Full change log and audit history
- ✅ One-click rollback
- ✅ Compliance-ready (who/what/when tracking)
- ✅ Zero-downtime deployments

## Example Workflow

### Scenario: Update E-Commerce API Across 50 Servers

1. **Admin uploads new version** to update registry
   - Version: v2.5.0
   - Changelog: "Performance improvements, bug fixes"
   - Target: api-service on all production nodes

2. **Plan rollout**
   - Target: 50 production servers
   - Schedule: Saturday 2:00 AM (maintenance window)
   - Strategy: Progressive (5 servers → 15 servers → 30 servers → all)
   - Approval: Requires ops manager approval

3. **Scheduled time arrives**
   - Agents on first 5 servers download and stage update
   - New version runs on alternate port (8081 vs 8080)
   - Health checks run: HTTP GET /health, expect 200 OK
   
4. **Health checks pass**
   - System switches reverse proxy to port 8081
   - Old version kept running (instant rollback option)
   - Monitor for 15 minutes

5. **First batch successful**
   - Proceed to next 10 servers (total 15)
   - Repeat health checks and monitoring
   
6. **Continue rolling out**
   - If any batch fails, automatic rollback
   - If all succeed, complete deployment to all 50 servers
   
7. **Audit log records**
   - "User: admin@company.com"
   - "Action: Update api-service to v2.5.0"
   - "Nodes: 50/50 successful"
   - "Duration: 45 minutes"
   - "Status: Success"

## Technical Design

### Update Registry

**Storage Options:**
- Filesystem (local or NFS)
- Object storage (S3, Azure Blob, MinIO)
- Artifact repository (Nexus, Artifactory)

**Package Structure:**
```
update-package.zip
├── manifest.json         (metadata)
├── binaries/            (executables)
├── configs/             (configuration files)
├── scripts/             (pre/post install)
└── checksum.txt         (integrity verification)
```

### Database Schema
```sql
-- Update packages
CREATE TABLE UpdatePackages (
  Id INTEGER PRIMARY KEY,
  Name VARCHAR(255),
  Version VARCHAR(50),
  TargetApp VARCHAR(255),
  Changelog TEXT,
  PackageUrl VARCHAR(1024),
  Checksum VARCHAR(128),
  UploadedBy VARCHAR(100),
  UploadedAt DATETIME,
  Status VARCHAR(20) -- Available, Archived, Deleted
);

-- Rollout plans
CREATE TABLE Rollouts (
  Id INTEGER PRIMARY KEY,
  PackageId INTEGER,
  Name VARCHAR(255),
  Strategy VARCHAR(20), -- Progressive, AllAtOnce, Canary
  ScheduledAt DATETIME,
  Status VARCHAR(20), -- Planned, Running, Paused, Completed, Failed
  ApprovedBy VARCHAR(100),
  ApprovedAt DATETIME,
  TargetNodes TEXT, -- JSON array of node IDs
  BatchSize INT,
  FOREIGN KEY (PackageId) REFERENCES UpdatePackages(Id)
);

-- Rollout status per node
CREATE TABLE RolloutNodes (
  Id INTEGER PRIMARY KEY,
  RolloutId INTEGER,
  NodeId INTEGER,
  Status VARCHAR(20), -- Pending, Downloading, Staged, HealthCheck, Active, Failed, RolledBack
  StartedAt DATETIME,
  CompletedAt DATETIME,
  Error TEXT,
  FOREIGN KEY (RolloutId) REFERENCES Rollouts(Id),
  FOREIGN KEY (NodeId) REFERENCES Nodes(Id)
);

-- Audit log
CREATE TABLE UpdateAuditLog (
  Id INTEGER PRIMARY KEY,
  RolloutId INTEGER,
  NodeId INTEGER,
  Timestamp DATETIME,
  Action VARCHAR(100), -- Downloaded, Staged, HealthCheckPassed, Activated, RolledBack
  PerformedBy VARCHAR(100),
  Details TEXT,
  FOREIGN KEY (RolloutId) REFERENCES Rollouts(Id)
);
```

### API Endpoints

**Update Registry:**
```
GET    /api/updates/packages             - List update packages
POST   /api/updates/packages             - Upload new package
GET    /api/updates/packages/:id         - Package details
DELETE /api/updates/packages/:id         - Delete package
```

**Rollouts:**
```
POST   /api/rollouts                     - Plan new rollout
GET    /api/rollouts/:id                 - Rollout status
POST   /api/rollouts/:id/approve         - Approve rollout
POST   /api/rollouts/:id/start           - Start rollout
POST   /api/rollouts/:id/pause           - Pause rollout
POST   /api/rollouts/:id/resume          - Resume rollout
POST   /api/rollouts/:id/rollback        - Rollback entire rollout
GET    /api/rollouts/:id/nodes           - Per-node status
```

**Audit:**
```
GET    /api/updates/audit                - Query audit log
GET    /api/updates/audit/export         - Export for compliance
```

### Agent Workflow

**Agent on each node:**
1. **Poll for updates** - Check assigned rollouts
2. **Download package** - Fetch from registry
3. **Verify checksum** - Ensure integrity
4. **Stage deployment** - Prepare without applying
5. **Run pre-install scripts** - Database migrations, etc.
6. **Deploy** - Start new version on alternate port
7. **Health check** - Validate new version
8. **Switch traffic** - Update proxy/port binding
9. **Monitor** - Watch for errors
10. **Report status** - Update central controller

## Implementation Phases

| Phase | Features | Weeks |
|-------|----------|-------|
| 1 | Update registry, package management | 2 |
| 2 | Planned & targeted rollouts | 2 |
| 3 | Staged/blue-green deployment | 2 |
| 4 | Health checks, automatic rollback | 1 |
| 5 | Audit log & change tracking | 1 |
| 6 | Approval workflows, scheduling | 1 |
| 7 | UI for rollout management | 1 |

**Total:** 8 weeks

## Use Cases

### MSP: Update 100 Client Servers
- Upload update once
- Target all client-a nodes
- Schedule for 3:00 AM Sunday
- Progressive rollout (10 at a time)
- Auto-rollback if >10% fail

### SaaS: Zero-Downtime Deployment
- Blue/green deployment
- All 20 API servers updated
- Health checks before switching
- Old version kept as instant fallback

### Compliance: Audit Trail
- Who deployed what, when
- Every action logged immutably
- Export for SOC 2 audit
- Prove controlled change management

## Dependencies

- **Required:** 010 Multi-Node Cluster (agent coordination)
- **Required:** 013 Analytics (health checks, metrics)
- **Recommended:** 007 App Versioning (version tracking)

## Related Features

- **Builds on:** 007 App Versioning
- **Enhanced by:** 013 Analytics (deployment metrics)

---

For complete details, see the [full app update manager spec](../../spec/014-app-update-manager/spec.md).
