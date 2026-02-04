# 007: App Versioning & Deployment

**Status:** 📋 Spec Ready (0% Complete)  
**Phase:** 4 - Containers & Deployment  
**Priority:** 🟡 HIGH  
**Effort:** 4-6 weeks  
**Original Spec:** [../spec/007-app-versioning/spec.md](../../spec/007-app-versioning/spec.md)

---

## Summary

Track application versions, enable rollbacks, and support deployment strategies like blue-green and canary deployments. Essential for production change management and compliance.

## Key Features ⬜

### 1. Version History (1 week)
- ⬜ Track every deployment with timestamp
- ⬜ Capture metadata: who deployed, why, changelog
- ⬜ Tag versions (v1.0.0, v1.0.1, etc.)
- ⬜ Automatic version numbering
- ⬜ Version comparison (diff view)

### 2. Configuration Snapshots (1 week)
- ⬜ Save complete app configuration per version
- ⬜ Include: executable path, args, env vars, files
- ⬜ Store file checksums (detect drift)
- ⬜ Compress snapshots for storage efficiency

### 3. One-Click Rollback (1 week)
- ⬜ Revert to any previous version
- ⬜ Restore configuration from snapshot
- ⬜ Automatic backup before rollback
- ⬜ Rollback history (can rollback a rollback)
- ⬜ Confirmation UI with version diff

### 4. Blue-Green Deployments (1-2 weeks)
- ⬜ **Blue:** Current production version
- ⬜ **Green:** New version running on different port
- ⬜ Run both versions simultaneously
- ⬜ Switch traffic/port binding after validation
- ⬜ Instant rollback by switching back
- ⬜ Zero-downtime deployments

### 5. Canary Deployments (1 week)
- ⬜ Gradual traffic shifting (5% → 25% → 50% → 100%)
- ⬜ Monitor metrics during rollout
- ⬜ Automatic rollback on errors
- ⬜ Manual approval gates

### 6. Git Integration (1 week)
- ⬜ Deploy from git repository
- ⬜ Webhook support (auto-deploy on push)
- ⬜ Branch/tag selection
- ⬜ Commit SHA tracking
- ⬜ Link version to git commit

## Why This Matters

**Without Versioning:**
- ❌ Can't undo bad deployments
- ❌ No audit trail of changes
- ❌ Risky deployments (no safety net)
- ❌ Manual rollback is error-prone
- ❌ Downtime during updates

**With Versioning:**
- ✅ One-click rollback to safety
- ✅ Full audit trail (compliance)
- ✅ Safe deployments (validation before commit)
- ✅ Automated rollbacks on failure
- ✅ Zero-downtime updates

## Technical Design

### Database Schema
```sql
-- App versions
CREATE TABLE AppVersions (
  Id INTEGER PRIMARY KEY,
  AppId INTEGER,
  Version VARCHAR(50), -- v1.0.0
  GitCommitSha VARCHAR(40),
  DeployedBy VARCHAR(100),
  DeployedAt DATETIME,
  Changelog TEXT,
  ConfigSnapshot TEXT, -- JSON
  Status VARCHAR(20) -- Active, Inactive, Rolled Back
);

-- Deployment history
CREATE TABLE Deployments (
  Id INTEGER PRIMARY KEY,
  AppId INTEGER,
  VersionId INTEGER,
  Strategy VARCHAR(20), -- Direct, BlueGreen, Canary
  Status VARCHAR(20), -- Pending, InProgress, Success, Failure
  StartedAt DATETIME,
  CompletedAt DATETIME,
  Error TEXT
);
```

### API Endpoints
```
GET    /api/apps/:id/versions           - List versions
POST   /api/apps/:id/versions           - Create new version
GET    /api/apps/:id/versions/:verId    - Version details
POST   /api/apps/:id/rollback/:verId    - Rollback to version
POST   /api/apps/:id/deploy/bluegreen   - Blue-green deployment
POST   /api/apps/:id/deploy/canary      - Canary deployment
POST   /api/apps/:id/deploy/switch      - Switch blue<->green
GET    /api/apps/:id/deployments        - Deployment history
```

## Implementation Phases

| Phase | Features | Weeks |
|-------|----------|-------|
| 1 | Version history & snapshots | 1 |
| 2 | Configuration snapshots & storage | 1 |
| 3 | One-click rollback | 1 |
| 4 | Blue-green deployments | 1-2 |
| 5 | Canary deployments | 1 |
| 6 | Git integration | 1 |

**Total:** 4-6 weeks

## Use Cases

### Example 1: Rollback After Bad Deployment
1. Deploy new version (v2.0.0)
2. App starts crashing
3. One-click rollback to v1.5.0
4. System restored in < 1 minute

### Example 2: Zero-Downtime Deployment
1. Current app running on port 8080 (Blue)
2. Deploy new version on port 8081 (Green)
3. Run health checks on Green
4. Switch reverse proxy to port 8081
5. Keep Blue running as instant rollback option

### Example 3: Git-Based Deployment
1. Push code to `main` branch
2. Webhook triggers MiniCluster
3. MiniCluster pulls latest code
4. Builds and deploys automatically
5. Version tagged with commit SHA

## Dependencies

- **Recommended:** 005 Reliability (health checks for validation)
- **Optional:** 006 Container Support (version container images)

## Related Features

- **Foundation for:** 009 Service-Level Versioning
- **Enhanced by:** 013 Analytics (deployment metrics)

---

For complete details, see the [full app versioning spec](../../spec/007-app-versioning/spec.md).
