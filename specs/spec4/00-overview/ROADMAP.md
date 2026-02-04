# MiniCluster Development Roadmap

> **Version:** 1.0  
> **Last Updated:** February 2, 2026  
> **Planning Horizon:** 18 months

---

## Release Timeline

```
2026                                                           2027
Q1          Q2          Q3          Q4          Q1          Q2
│           │           │           │           │           │
├───────────┼───────────┼───────────┼───────────┼───────────┤
│           │           │           │           │           │
│  v1.1     │  v1.2     │  v1.3     │  v1.4     │  v2.0     │
│  CLI +    │  Reliability│ Scale    │  Plugins  │  Full     │
│  Security │  + Deploy  │          │           │  Platform │
│           │           │           │           │           │
└───────────┴───────────┴───────────┴───────────┴───────────┘
```

---

## Version Milestones

### v1.0.x (Current) - Foundation ✅
**Status:** Released  
**Focus:** Core platform stability

- ✅ Process management (services)
- ✅ File explorer & editing
- ✅ Reverse proxy (YARP)
- ✅ JWT authentication
- ✅ Apps & service grouping
- ✅ Variable groups
- ✅ System process monitoring
- ✅ Real-time metrics (SignalR)

---

### v1.1.0 (Q1 2026) - CLI & Security
**Target:** March 2026  
**Theme:** DevOps automation & production readiness

#### CLI Tool (4 weeks)
- [ ] App management (`mc app list/create/delete/start/stop`)
- [ ] Service management (`mc service list/create/update/logs`)
- [ ] Deployment commands (`mc deploy blue-green/rollback`)
- [ ] Batch operations (`mc batch run deployment.yaml`)
- [ ] Configuration export/import
- [ ] JSON/YAML/table output formats
- [ ] Shell completion (bash/zsh/powershell)

#### Security Enhancement (3 weeks)
- [ ] API key generation and management
- [ ] Role-based access control (RBAC)
- [ ] User management UI
- [ ] Audit logging for all operations
- [ ] Session management

#### Health Checks (1 week)
- [ ] HTTP endpoint health probes
- [ ] TCP port health probes
- [ ] Process health (responding check)
- [ ] Health status in dashboard

**Release Criteria:**
- All CLI commands functional
- API keys work for CI/CD
- RBAC enforced on all endpoints
- Health checks run on schedule

---

### v1.2.0 (Q2 2026) - Reliability & Deployment
**Target:** June 2026  
**Theme:** Production reliability & zero-downtime

#### Auto-Restart Policies (2 weeks)
- [ ] Restart policies: Never, OnFailure, Always, UnlessStopped
- [ ] Exponential backoff with jitter
- [ ] Max restart attempts configuration
- [ ] Restart history tracking

#### Blue-Green Deployment (2 weeks)
- [ ] Deploy new version alongside existing
- [ ] Health check validation before switch
- [ ] Automatic traffic routing
- [ ] Rollback on failure
- [ ] CLI: `mc deploy blue-green`

#### Versioning & Rollback (4 weeks)
- [ ] App version history
- [ ] Configuration snapshots
- [ ] One-click rollback to previous version
- [ ] Service-level versioning
- [ ] Diff view between versions
- [ ] CLI: `mc deploy rollback`

**Release Criteria:**
- Zero-downtime deployment demonstrated
- Rollback completes in <30 seconds
- Auto-restart recovers crashed services
- All deployable via CLI

---

### v1.3.0 (Q3 2026) - Scale & Organization
**Target:** September 2026  
**Theme:** Multi-server & complex app support

#### Hierarchical Apps (3 weeks)
- [ ] Nested app structure (parent-child)
- [ ] Cascade start/stop operations
- [ ] Variable inheritance
- [ ] Tree view UI
- [ ] Drag-drop reorganization

#### Startup Plans (2 weeks)
- [ ] Dependency graph definition
- [ ] Ordered startup sequences
- [ ] Parallel startup where possible
- [ ] Failure handling policies

#### Multi-Node Cluster - Phase 1 (5 weeks)
- [ ] Agent binary for each node
- [ ] Agent registration with controller
- [ ] Central dashboard for all nodes
- [ ] Cross-node service status
- [ ] Node health monitoring

**Release Criteria:**
- 5+ level app hierarchy works
- 10+ node cluster demonstrated
- Startup plans execute correctly
- Cross-node visibility complete

---

### v1.4.0 (Q4 2026) - Extensibility
**Target:** December 2026  
**Theme:** Plugin ecosystem

#### Plugin System (12 weeks)
- [ ] Backend SDK (IPlugin interface)
- [ ] Frontend SDK (React components)
- [ ] Plugin manifest format
- [ ] Permission system
- [ ] Plugin isolation (AssemblyLoadContext)
- [ ] Hot-reload for development
- [ ] Plugin CLI (`mc plugin new/build/publish`)

#### Marketplace (4 weeks)
- [ ] Plugin discovery UI
- [ ] One-click install
- [ ] Plugin updates
- [ ] Ratings and reviews
- [ ] Publisher verification

**Release Criteria:**
- 5+ example plugins working
- Marketplace browsable
- Third-party can publish plugins
- Security review passed

---

### v2.0.0 (Q1 2027) - Full Platform
**Target:** March 2027  
**Theme:** Enterprise ready

#### Multi-Node Cluster - Phase 2 (8 weeks)
- [ ] Cross-node deployment
- [ ] Service discovery
- [ ] Load balancing
- [ ] Impersonation contexts
- [ ] mTLS authentication

#### Observability (4 weeks)
- [ ] OTLP receiver for traces
- [ ] Centralized log aggregation
- [ ] Custom metrics collection
- [ ] TimescaleDB integration
- [ ] Grafana dashboards

#### Enterprise Features
- [ ] AD/LDAP integration
- [ ] SSO (SAML/OIDC)
- [ ] Complete audit trail
- [ ] Compliance reporting
- [ ] SLA monitoring

**Release Criteria:**
- 50+ node cluster validated
- Enterprise customer pilot
- Security audit complete
- Documentation complete

---

## Feature Priority Matrix

### Must Have (P0)
| Feature | Target Version | Effort |
|---------|----------------|--------|
| CLI Tool | v1.1 | 4 weeks |
| API Keys | v1.1 | 1 week |
| RBAC | v1.1 | 2 weeks |
| Health Checks | v1.1 | 1 week |
| Blue-Green Deploy | v1.2 | 2 weeks |
| Versioning | v1.2 | 3 weeks |
| Rollback | v1.2 | 1 week |

### Should Have (P1)
| Feature | Target Version | Effort |
|---------|----------------|--------|
| Auto-Restart | v1.2 | 2 weeks |
| Hierarchical Apps | v1.3 | 3 weeks |
| Multi-Node (Basic) | v1.3 | 5 weeks |
| Plugin System | v1.4 | 12 weeks |

### Nice to Have (P2)
| Feature | Target Version | Effort |
|---------|----------------|--------|
| Marketplace | v1.4 | 4 weeks |
| Container Support | v2.0+ | 6 weeks |
| Cron Scheduling | v1.3 | 2 weeks |
| Git Integration | v2.0+ | 2 weeks |

### Future (P3)
| Feature | Target Version | Effort |
|---------|----------------|--------|
| Analytics/AI | v2.0+ | 8 weeks |
| Update Manager | v2.0+ | 4 weeks |
| Secrets Management | v2.0+ | 3 weeks |

---

## Resource Planning

### Team Composition (Recommended)
- 2 Backend developers (.NET)
- 1 Frontend developer (React)
- 1 DevOps/QA (testing, CI/CD)
- 0.5 Product/UX (part-time)

### Effort by Quarter

| Quarter | Features | Total Weeks |
|---------|----------|-------------|
| Q1 2026 | CLI, Security, Health | 8 weeks |
| Q2 2026 | Reliability, Deploy | 8 weeks |
| Q3 2026 | Hierarchy, Multi-Node | 10 weeks |
| Q4 2026 | Plugins, Marketplace | 16 weeks |
| Q1 2027 | Enterprise, Observability | 12 weeks |

---

## Risk Mitigation

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Plugin isolation complexity | High | Spike first, prototype before commit |
| Multi-node state sync | High | Use proven patterns (Raft, CRDT) |
| Performance at scale | Medium | Load test each release |

### Business Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Low adoption | High | Early beta program, user feedback |
| Competition | Medium | Focus on Windows niche |
| Plugin ecosystem empty | Medium | Build first-party plugins |

---

## Success Criteria by Version

### v1.1 Success
- [ ] 10+ users using CLI in CI/CD
- [ ] No security incidents with API keys
- [ ] Health checks prevent 50% of incidents

### v1.2 Success
- [ ] Zero-downtime deploy used by 50% of users
- [ ] Rollback used successfully 10+ times
- [ ] Auto-restart prevents 80% of manual restarts

### v1.3 Success
- [ ] 5+ users with 3+ node clusters
- [ ] Hierarchical apps used by complex deployments
- [ ] Startup plans reduce deployment time 50%

### v1.4 Success
- [ ] 3+ third-party plugins published
- [ ] Marketplace has 10+ plugins
- [ ] Plugin installation <1 minute

### v2.0 Success
- [ ] 1+ enterprise customer in production
- [ ] 50+ node cluster validated
- [ ] Full documentation and training

---

## Feedback Loops

### Continuous
- GitHub issues and discussions
- User interviews (monthly)
- Usage analytics (opt-in)

### Per Release
- Beta program (2 weeks before GA)
- Release notes survey
- Post-mortem review

---

*This roadmap is a living document. Update monthly based on feedback and learnings.*
