# Spec3: Post-Refactor Incremental Evolution

**Created:** January 31, 2026  
**Status:** Planning Phase  
**Philosophy:** Step-by-step feature delivery with user feedback loops

---

## Overview

This folder contains specifications for MiniCluster's next evolution phase following the successful Service Refactor. We use an **incremental approach** rather than big-bang releases.

## Strategy: Validate → Build → Evolve

Instead of jumping to complex hierarchical structures (Feature 008), we build features incrementally:

1. **Ship simple version** → Get user feedback
2. **Iterate based on feedback** → Improve UX
3. **Add complexity when needed** → Solve real problems

---

## Evolution Roadmap

### Current State (✅ Complete)
```
Flat Service List
├─ Service A
├─ Service B
├─ Service C
└─ Service D
```
**Pain Point:** All services in one long list, hard to organize

---

### **Step 1: Simple App Tabs** (📋 Next - 1-2 weeks)
```
App Tabs: [E-Commerce] [Monitoring] [Database] [+]
           ↓
App: "E-Commerce"
├─ Service: API Gateway
├─ Service: Product Service
└─ Service: Order Service
```

**Value:**
- ✅ Group related services together
- ✅ Switch between apps with tabs
- ✅ Create new apps with + button
- ✅ Simple mental model (folder-like)

**Scope:**
- Flat app structure (no nesting)
- Apps contain services (1:N relationship)
- Tab navigation UI
- App cards view
- Minimal DB changes (AppId foreign key)

**See:** [015-simple-app-tabs/](015-simple-app-tabs/)

---

### **Step 2: App Groups** (🔜 Future - 1 week)
```
Production/
├─ App: E-Commerce
│   └─ Services...
└─ App: Monitoring
    └─ Services...

Development/
└─ App: E-Commerce (Dev)
    └─ Services...
```

**Value:**
- ✅ Environment separation (Prod/Dev/Test)
- ✅ Logical organization
- ✅ Group-level settings

**Scope:**
- Groups contain apps (1:N)
- Apps still flat (no parent-child)
- Group cards view
- Color coding

---

### **Step 3: App Hierarchy** (🔜 Future - 2-3 weeks)
```
Platform App (Parent)
├─ Frontend App (Child)
│   ├─ Service: Web Server
│   └─ Service: CDN
└─ Backend App (Child)
    ├─ API App (Child)
    │   └─ Services...
    └─ Worker App (Child)
        └─ Services...
```

**Value:**
- ✅ True composite applications
- ✅ Cascade start/stop
- ✅ Variable inheritance
- ✅ Startup dependencies

**Scope:**
- Apps can contain apps (parent-child)
- Tree view UI
- Recursive operations
- Full Feature 008 implementation

---

### **Step 4: Advanced Features** (🔮 Later)
- Startup plans & dependencies
- Health checks cascade
- Cross-app service discovery
- Marketplace templates

---

## Why This Approach?

### ❌ Big Bang Approach (Feature 008 Now)
```
Week 1-4: Build everything
Week 5: Test
Week 6: Deploy
Week 7: User feedback → "Actually we wanted simpler grouping"
Week 8: Rewrite
```
**Risk:** Build wrong thing, discover late

### ✅ Incremental Approach (Step-by-step)
```
Week 1-2: Simple app tabs
Week 3: User feedback → "Perfect! But we want dev/prod separation"
Week 4: Add groups
Week 5: User feedback → "Now we need nested apps"
Week 6-8: Add hierarchy
```
**Benefit:** Build right thing, validate early

---

## Folder Structure

```
spec3/
├── README.md (this file)
│
├── 000-current-state/
│   ├── REFACTOR_SUMMARY.md
│   ├── ARCHITECTURE.md
│   └── DATABASE_SCHEMA.md
│
├── 015-simple-app-tabs/
│   ├── spec.md (full specification)
│   ├── database-changes.md
│   ├── api-endpoints.md
│   ├── ui-mockups.md
│   └── implementation-plan.md
│
├── 016-app-groups/ (future)
│   └── spec.md
│
└── 017-app-hierarchy/ (future)
    └── spec.md
```

---

## Implementation Principles

### 1. **Backward Compatibility**
- Existing services work without apps (null AppId)
- Old URLs still work
- Gradual migration, no forced changes

### 2. **Database Evolution**
- Additive changes only (no breaking migrations)
- Nullable foreign keys (existing data works)
- Indexes for performance

### 3. **API Versioning**
- New endpoints alongside old ones
- Old endpoints marked deprecated (not removed)
- Client can adopt at their pace

### 4. **UI Progressive Enhancement**
- New UI available immediately
- Old UI still accessible
- Users choose when to migrate

### 5. **Testing Each Step**
- Unit tests for new features
- Integration tests for workflows
- Manual testing with real scenarios
- Production validation before next step

---

## Success Metrics

### Step 1 (Simple App Tabs)
- [ ] Can create apps via UI
- [ ] Can add services to apps
- [ ] Tab navigation works smoothly
- [ ] App cards view functional
- [ ] Performance: <100ms tab switch
- [ ] User feedback: "Easy to organize services"

### Step 2 (App Groups)
- [ ] Can create groups
- [ ] Can assign apps to groups
- [ ] Environment separation clear
- [ ] User feedback: "Dev/Prod separation works"

### Step 3 (App Hierarchy)
- [ ] Can nest apps
- [ ] Cascade start/stop works
- [ ] Tree view intuitive
- [ ] User feedback: "Manages complex apps easily"

---

## Decision Log

### Why not jump to Feature 008 (Hierarchy)?

**Decision:** Start with simple flat apps + tabs  
**Date:** January 31, 2026  
**Reasons:**
1. **Complexity:** Feature 008 introduces parent-child relationships, cascade operations, variable inheritance - all at once
2. **Risk:** Users might not need full hierarchy immediately
3. **Validation:** Simple version proves the grouping concept first
4. **Time to Value:** 1-2 weeks vs 3-4 weeks
5. **Feedback:** Can pivot based on real usage before investing in hierarchy

**Trade-offs:**
- Migration effort later (add hierarchy columns)
- UI changes later (tabs → tree view)
- Worth it for reduced risk and faster validation

---

## Next Steps

1. ✅ Create spec3 folder structure
2. ✅ Document evolution roadmap
3. 📝 Write Feature 015 specification
4. 📝 Design database schema changes
5. 📝 API endpoints specification
6. 🎨 UI mockups and flows
7. 📅 Sprint planning (break into stories)
8. 💻 Implementation

---

## References

- **Previous Refactor:** [000-current-state/REFACTOR_SUMMARY.md](000-current-state/REFACTOR_SUMMARY.md)
- **Feature 008 (Future):** [../spec/008-hierarchical-apps/spec.md](../spec/008-hierarchical-apps/spec.md)
- **Feature 005 (Reliability):** [../spec/005-reliability-orchestration/spec.md](../spec/005-reliability-orchestration/spec.md)

---

*Philosophy: Ship small, learn fast, iterate based on feedback.*
