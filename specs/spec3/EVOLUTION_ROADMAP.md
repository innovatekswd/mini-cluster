# MiniCluster Evolution Roadmap

**Strategic Approach:** Incremental Feature Delivery  
**Philosophy:** Validate → Build → Evolve  
**Status:** Post-Refactor, Ready for Next Phase

---

## Visual Roadmap

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     MINICLUSTER EVOLUTION PATH                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ✅ CURRENT STATE: Flat Service List                                    │
│  ┌────────────────────────────────────────────┐                         │
│  │ Services:                                  │                         │
│  │  • API Gateway        [running]            │                         │
│  │  • Product Service    [running]            │                         │
│  │  • Order Service      [stopped]            │                         │
│  │  • Database           [running]            │                         │
│  │  • Seq                [running]            │                         │
│  │  • Grafana            [running]            │                         │
│  └────────────────────────────────────────────┘                         │
│  Pain: All services mixed together, hard to find                        │
│                                                                          │
│  ↓ (1-2 weeks)                                                          │
│                                                                          │
│  📋 STEP 1: Simple App Tabs                                             │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │ Tabs: [E-Commerce] [Monitoring] [Database] [+]            │         │
│  │                                                             │         │
│  │ Selected: "E-Commerce"                                      │         │
│  │ Services:                                                   │         │
│  │  • API Gateway        [running]                             │         │
│  │  • Product Service    [running]                             │         │
│  │  • Order Service      [stopped]                             │         │
│  │                                                             │         │
│  │ [Start All] [Stop All] [Configure App]                     │         │
│  └────────────────────────────────────────────────────────────┘         │
│  Value: ✅ Organize services  ✅ Quick navigation  ✅ Bulk ops          │
│                                                                          │
│  ↓ (1 week)                                                             │
│                                                                          │
│  🔜 STEP 2: App Groups                                                  │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │ Groups: [Production] [Development] [Staging]               │         │
│  │                                                             │         │
│  │ Group: "Production"                                         │         │
│  │   📦 E-Commerce                                             │         │
│  │      ├─ API Gateway        [running]                        │         │
│  │      ├─ Product Service    [running]                        │         │
│  │      └─ Order Service      [running]                        │         │
│  │   📊 Monitoring                                             │         │
│  │      ├─ Seq                [running]                        │         │
│  │      └─ Grafana            [running]                        │         │
│  └────────────────────────────────────────────────────────────┘         │
│  Value: ✅ Environment separation  ✅ Team organization               │
│                                                                          │
│  ↓ (2-3 weeks)                                                          │
│                                                                          │
│  🔮 STEP 3: App Hierarchy                                               │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │ Tree View:                                                  │         │
│  │                                                             │         │
│  │ Production/                                                 │         │
│  │ └─ 📦 E-Commerce Platform                                  │         │
│  │     ├─ 📦 Frontend                                         │         │
│  │     │   ├─ Web Server        [running]                     │         │
│  │     │   └─ CDN               [running]                     │         │
│  │     └─ 📦 Backend                                          │         │
│  │         ├─ 📦 API                                          │         │
│  │         │   ├─ Gateway       [running]                     │         │
│  │         │   └─ Auth          [running]                     │         │
│  │         └─ 📦 Workers                                      │         │
│  │             ├─ Order Proc    [running]                     │         │
│  │             └─ Email         [running]                     │         │
│  │                                                             │         │
│  │ [Start Tree] [Stop Tree] [Cascade Health Check]            │         │
│  └────────────────────────────────────────────────────────────┘         │
│  Value: ✅ Complex apps  ✅ Cascade ops  ✅ Dependencies               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Timeline

### ✅ Phase 0: Service Refactor (COMPLETE)
**Duration:** 1 week  
**Status:** ✅ Done  
**Branch:** `feature/phase5-service-refactor` (FE), `feature/phase-5-machines-apps-services` (BE)

**Deliverables:**
- [x] App → Service terminology across codebase
- [x] 8 files renamed (components, hooks, types)
- [x] SignalR optimization (single connection)
- [x] Database split (control.db + logs.db)
- [x] AutoStart feature validated
- [x] Production build successful

**Current State:**
- Services managed individually
- Flat list view
- No grouping mechanism
- Working foundation for next features

---

### 📋 Phase 1: Simple App Tabs (NEXT)
**Duration:** 1-2 weeks  
**Effort:** 40-60 hours  
**Priority:** 🔴 HIGH  
**Target:** February 15, 2026

**User Story:**
> "As a DevOps engineer, I want to group related services into apps so I can organize and manage them together."

**Deliverables:**
- [ ] Database: `Apps` table, `AppId` FK on `Services`
- [ ] Backend: `AppsController` with CRUD endpoints
- [ ] Frontend: Tab navigation UI component
- [ ] Frontend: App cards view (browse all apps)
- [ ] Frontend: Create app modal with form
- [ ] UI: Bulk operations (Start/Stop all in app)
- [ ] Migration: Existing services get default app or null
- [ ] Tests: Unit + integration tests
- [ ] Documentation: API docs, user guide

**Success Criteria:**
- ✅ Can create apps via UI
- ✅ Can assign services to apps
- ✅ Tab switching <100ms
- ✅ Backward compatible (existing services work)
- ✅ Zero breaking changes to API
- ✅ User feedback: "Easy to organize"

**Risk Mitigation:**
- Feature flag: Enable/disable new UI
- API versioning: New endpoints, old ones unchanged
- Database: Nullable AppId (no forced migration)
- Rollback plan: Remove FK, hide UI

---

### 🔜 Phase 2: App Groups (FUTURE)
**Duration:** 1 week  
**Effort:** 30-40 hours  
**Priority:** 🟡 MEDIUM  
**Target:** March 2026

**User Story:**
> "As a team lead, I want to separate production and development apps so environments don't get mixed up."

**Deliverables:**
- [ ] Database: `AppGroups` table, `GroupId` FK on `Apps`
- [ ] Backend: `AppGroupsController`
- [ ] Frontend: Group selector/filter
- [ ] Frontend: Group cards view
- [ ] UI: Color coding per group
- [ ] Default groups: Production, Development, Staging

**Success Criteria:**
- ✅ Can create custom groups
- ✅ Can assign apps to groups
- ✅ Environment separation clear
- ✅ Group-level settings work

**Dependencies:**
- Phase 1 (Simple App Tabs) must be complete

---

### 🔮 Phase 3: App Hierarchy (FUTURE)
**Duration:** 2-3 weeks  
**Effort:** 80-100 hours  
**Priority:** 🟢 MEDIUM  
**Target:** April 2026

**User Story:**
> "As an architect, I want to model complex multi-tier applications with parent-child relationships so I can manage them as a unit."

**Deliverables:**
- [ ] Database: `ParentAppId` self-referencing FK
- [ ] Backend: Tree traversal logic
- [ ] Backend: Cascade operations (start/stop tree)
- [ ] Backend: Variable inheritance
- [ ] Frontend: Tree view component
- [ ] Frontend: Drag-drop reorganization
- [ ] UI: Recursive health checks
- [ ] Startup dependencies
- [ ] Advanced: Directed acyclic graph (DAG) validation

**Success Criteria:**
- ✅ Can nest apps arbitrarily deep
- ✅ Cascade start/stop works correctly
- ✅ Tree view intuitive and performant
- ✅ Variable inheritance tested
- ✅ Circular dependency prevention

**Dependencies:**
- Phase 1 (Simple App Tabs) complete
- Phase 2 (App Groups) recommended

**This is Feature 008 from original specs!**

---

## Comparison: Big Bang vs Incremental

| Aspect | Big Bang (Feature 008 Now) | Incremental (3 Steps) |
|--------|----------------------------|----------------------|
| **Time to First Value** | 3-4 weeks | 1-2 weeks ✅ |
| **User Feedback** | After 4 weeks | After each phase ✅ |
| **Risk** | High (might build wrong thing) | Low (validate early) ✅ |
| **Pivot Cost** | High (rewrite) | Low (next step) ✅ |
| **Complexity** | High (all at once) | Low → Medium → High ✅ |
| **Testing** | Complex (many interactions) | Simple (isolated features) ✅ |
| **Rollback** | Hard (many changes) | Easy (one feature) ✅ |

---

## Feature Flags Strategy

Each phase has a feature flag for safe rollout:

```typescript
// Backend: appsettings.json
{
  "Features": {
    "SimpleAppTabs": true,      // Phase 1
    "AppGroups": false,          // Phase 2 (not ready)
    "AppHierarchy": false        // Phase 3 (not ready)
  }
}

// Frontend: feature toggles
const features = {
  simpleAppTabs: useFeatureFlag('SimpleAppTabs'),
  appGroups: useFeatureFlag('AppGroups'),
  appHierarchy: useFeatureFlag('AppHierarchy')
};

// Conditional rendering
{features.simpleAppTabs && <AppTabsView />}
{features.appGroups && <GroupsFilter />}
{features.appHierarchy && <TreeView />}
```

**Benefits:**
- Enable for testing/staging first
- Gradual rollout to production
- Quick disable if issues found
- A/B testing possible

---

## Migration Path for Users

### Current Users (Flat Services)
```
Step 1: Keep using service list (nothing changes)
Step 2: System creates "Default App" automatically
Step 3: Services auto-assigned to "Default App"
Step 4: User creates custom apps when ready
Step 5: User moves services between apps
```

### Power Users (Want Organization)
```
Step 1: Enable Simple App Tabs immediately
Step 2: Create apps for their workflows
Step 3: When Groups arrive, organize by environment
Step 4: When Hierarchy arrives, model complex systems
```

---

## Technical Architecture Evolution

### Phase 1: Simple App Tabs
```sql
CREATE TABLE Apps (
    Id UUID PRIMARY KEY,
    Name TEXT NOT NULL,
    Description TEXT,
    CreatedAt DATETIME,
    ModifiedAt DATETIME
);

ALTER TABLE Services ADD AppId UUID NULL
    REFERENCES Apps(Id) ON DELETE SET NULL;
```

### Phase 2: App Groups
```sql
CREATE TABLE AppGroups (
    Id UUID PRIMARY KEY,
    Name TEXT NOT NULL,
    Color TEXT,
    ...
);

ALTER TABLE Apps ADD GroupId UUID NULL
    REFERENCES AppGroups(Id) ON DELETE SET NULL;
```

### Phase 3: App Hierarchy
```sql
ALTER TABLE Apps ADD ParentAppId UUID NULL
    REFERENCES Apps(Id) ON DELETE SET NULL;

-- Prevent cycles
CREATE TRIGGER prevent_app_cycles ...
```

---

## Success Metrics by Phase

### Phase 1 Metrics
- **Adoption:** % of users creating apps
- **Usage:** Average services per app
- **Performance:** Tab switch latency <100ms
- **Satisfaction:** User feedback score 4+/5

### Phase 2 Metrics
- **Adoption:** % of users using groups
- **Org:** Average apps per group
- **Clarity:** Environment separation satisfaction

### Phase 3 Metrics
- **Complexity:** Average tree depth
- **Operations:** Cascade success rate
- **Performance:** Tree render time <500ms

---

## Decision Points

After each phase, we review and decide:

### After Phase 1
**Question:** Do users need groups?  
**Go:** Users request environment separation  
**No-Go:** Users satisfied with flat apps → Skip to hierarchy or other features

### After Phase 2
**Question:** Do users need hierarchy?  
**Go:** Users manage complex multi-tier apps  
**No-Go:** Flat apps + groups sufficient → Focus on other features (reliability, containers)

**This is LEAN product development!**

---

## References

- **Phase 1 Spec:** [015-simple-app-tabs/spec.md](015-simple-app-tabs/spec.md)
- **Phase 3 Original:** [../spec/008-hierarchical-apps/spec.md](../spec/008-hierarchical-apps/spec.md)
- **Refactor Summary:** [000-current-state/REFACTOR_SUMMARY.md](000-current-state/REFACTOR_SUMMARY.md)

---

*Next: Write detailed Feature 015 specification for Simple App Tabs.*
